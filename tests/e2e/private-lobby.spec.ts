import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

type LobbyApiResponse = {
  match: {
    id: string;
    status: string;
    players: Record<string, { name: string }>;
    solution?: unknown;
  };
};

async function readPuzzle(page: Page): Promise<number[]> {
  const cells = await page.locator('.own-board-panel .cell').evaluateAll((elements) =>
    elements.map((element) => ({
      text: element.textContent?.trim() ?? '',
      label: element.getAttribute('aria-label') ?? '',
    })),
  );
  return cells.map(({ text, label }) => {
    const clue = /Puzzle clue ([1-9])/.exec(label);
    return Number(clue?.[1] ?? (/^[1-9]$/.test(text) ? text : 0));
  });
}

function findBlankPair(puzzle: number[], direction: 'row' | 'column' | 'box'): [number, number] {
  for (let unit = 0; unit < 9; unit += 1) {
    const indices = Array.from({ length: 9 }, (_, offset) => {
      if (direction === 'row') return unit * 9 + offset;
      if (direction === 'column') return offset * 9 + unit;
      const boxRow = Math.floor(unit / 3) * 3;
      const boxCol = (unit % 3) * 3;
      return (boxRow + Math.floor(offset / 3)) * 9 + boxCol + (offset % 3);
    });
    const blanks = indices.filter((index) => puzzle[index] === 0);
    if (blanks.length >= 2) return [blanks[0], blanks[1]];
  }
  throw new Error(`The generated Puzzle has no pair of editable cells in a ${direction}.`);
}

function getCandidates(puzzle: number[], index: number): number[] {
  const row = Math.floor(index / 9);
  const col = index % 9;
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  const used = new Set<number>();
  for (let offset = 0; offset < 9; offset += 1) {
    used.add(puzzle[row * 9 + offset]);
    used.add(puzzle[offset * 9 + col]);
    used.add(puzzle[(boxRow + Math.floor(offset / 3)) * 9 + boxCol + (offset % 3)]);
  }
  return Array.from({ length: 9 }, (_, digitIndex) => digitIndex + 1)
    .filter((digit) => !used.has(digit));
}

function findArrowSkip(puzzle: number[]): { from: number; to: number; direction: string } | null {
  for (let from = 0; from < puzzle.length; from += 1) {
    if (puzzle[from] !== 0) continue;
    for (const { direction, step } of [
      { direction: 'ArrowRight', step: 1 },
      { direction: 'ArrowDown', step: 9 },
    ]) {
      let next = from + step;
      let skippedClue = false;
      while (
        next < puzzle.length
        && (step === 1 ? Math.floor(next / 9) === Math.floor(from / 9) : true)
      ) {
        if (puzzle[next] === 0) {
          if (skippedClue) return { from, to: next, direction };
          break;
        }
        skippedClue = true;
        next += step;
      }
    }
  }
  return null;
}

test('match API creates a private lobby and lets a guest join by room code', async ({ request }) => {
  const hostId = `api-host-${randomUUID()}`;
  const guestId = `api-guest-${randomUUID()}`;
  const createResponse = await request.post('/api/matches', {
    data: { playerId: hostId, name: 'API Host' },
  });

  expect(createResponse.status()).toBe(201);
  const created: LobbyApiResponse = await createResponse.json();
  const roomCode = created.match.id;
  expect(roomCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  expect(created.match).not.toHaveProperty('solution');
  expect(created.match.players[hostId].name).toBe('API Host');

  const joinResponse = await request.post(`/api/matches/${roomCode.toLowerCase()}/join`, {
    data: { playerId: guestId, name: 'API Guest' },
  });
  expect(joinResponse.status()).toBe(200);
  const joined: LobbyApiResponse = await joinResponse.json();

  expect(joined.match.id).toBe(roomCode);
  expect(joined.match.status).toBe('lobby');
  expect(Object.values(joined.match.players).map((player: { name: string }) => player.name))
    .toEqual(['API Host', 'API Guest']);
});

test('host and invited guest reach the same private lobby in separate sessions', async ({ browser }) => {
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  try {
    await hostContext.grantPermissions(['clipboard-read', 'clipboard-write']);
    await host.goto('/');
    await host.getByLabel('Nickname').fill('Host');
    await host.getByRole('button', { name: 'Save nickname' }).click();
    await host.getByRole('button', { name: 'Create private Match' }).click();
    await expect(host).toHaveURL(/\/room\/[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);

    const roomCode = await host.locator('.room-code').textContent();
    expect(roomCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    await expect(host.getByRole('heading', { name: 'Quick guide' })).toBeVisible();
    await expect(host.getByText('The first player to check a complete, correct Board wins.')).toBeVisible();
    await host.getByRole('button', { name: 'Copy invite' }).click();
    const copiedInvite = await host.evaluate(() => navigator.clipboard.readText());
    expect(new URL(copiedInvite).pathname).toBe(`/room/${roomCode}`);
    await host.getByRole('button', { name: 'Dismiss' }).click();
    await expect(host.getByRole('heading', { name: 'Quick guide' })).toHaveCount(0);

    const inviteLink = host.url();
    await host.reload();
    await expect(host.locator('.player-name')).toHaveText(['Host']);
    await expect(host.getByRole('heading', { name: 'Quick guide' })).toHaveCount(0);

    await guest.goto('/');
    await guest.getByLabel('Nickname').fill('Guest');
    await guest.getByRole('button', { name: 'Save nickname' }).click();
    await guest.goto(inviteLink);
    await expect(guest).toHaveURL(new RegExp(`/room/${roomCode}$`));
    await expect(host.locator('.player-name')).toHaveText(['Host', 'Guest']);
    await expect(guest.locator('.player-name')).toHaveText(['Host', 'Guest']);
    await expect(host.locator('.player-card').filter({ hasText: 'Guest' }))
      .toContainText('Guest · Waiting · Online');
    await expect(guest.locator('.player-card').filter({ hasText: 'Host' }))
      .toContainText('Host · Waiting · Online');

    const hasHorizontalOverflow = await guest.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});

test('a guest can join a private lobby with its room-code fallback on tablet and mobile', async ({ browser }) => {
  const hostContext = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const guestContext = await browser.newContext({ viewport: { width: 320, height: 740 } });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  try {
    await host.goto('/');
    await host.getByLabel('Nickname').fill('Code Host');
    await host.getByRole('button', { name: 'Save nickname' }).click();
    await host.getByRole('button', { name: 'Create private Match' }).click();
    await expect(host).toHaveURL(/\/room\/[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    const roomCode = (await host.locator('.room-code').textContent())?.trim();
    if (!roomCode) throw new Error('The host lobby did not show a room code.');
    expect(roomCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);

    await guest.goto('/');
    await guest.getByLabel('Nickname').fill('Code Guest');
    await guest.getByRole('button', { name: 'Save nickname' }).click();
    await guest.getByLabel('Room code').fill(roomCode.toLowerCase());
    await guest.getByRole('button', { name: 'Join Match' }).click();

    await expect(guest).toHaveURL(new RegExp(`/room/${roomCode}$`));
    await expect(host.locator('.player-name')).toHaveText(['Code Host', 'Code Guest']);
    await expect(guest.locator('.player-name')).toHaveText(['Code Host', 'Code Guest']);

    for (const page of [host, guest]) {
      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(hasHorizontalOverflow).toBe(false);
    }
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});

test('players agree on a Difficulty, ready up, and start together on the same Puzzle', async ({ browser }) => {
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  try {
    await host.goto('/');
    await host.getByLabel('Nickname').fill('Host');
    await host.getByRole('button', { name: 'Save nickname' }).click();
    await host.getByRole('button', { name: 'Create private Match' }).click();
    await expect(host).toHaveURL(/\/room\/[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    const roomCode = (await host.locator('.room-code').textContent())?.trim();
    if (!roomCode) throw new Error('The host lobby did not show a room code.');

    await guest.goto('/');
    await guest.getByLabel('Nickname').fill('Guest');
    await guest.getByRole('button', { name: 'Save nickname' }).click();
    await guest.goto(`/room/${roomCode}`);
    await expect(guest.locator('.player-name')).toHaveText(['Host', 'Guest']);

    await host.getByLabel('Propose difficulty').selectOption('hard');
    await expect(host.getByRole('status')).toContainText('You proposed Hard');
    await expect(guest.getByRole('status')).toContainText('Host proposed Hard');
    await expect(guest.getByRole('button', { name: 'Accept difficulty' })).toBeVisible();
    await guest.getByLabel('Counter-propose difficulty').selectOption('medium');
    await expect(guest.getByRole('status')).toContainText('You proposed Medium');
    await expect(host.getByRole('status')).toContainText('Guest proposed Medium');
    await expect(host.getByRole('button', { name: 'Accept difficulty' })).toBeVisible();
    await host.getByRole('button', { name: 'Accept difficulty' }).click();
    await expect(host.getByText('Both players agreed on Medium. Mark ready when you are prepared.'))
      .toBeVisible();
    await expect(guest.getByText('Both players agreed on Medium. Mark ready when you are prepared.'))
      .toBeVisible();

    await host.getByRole('button', { name: 'Mark ready' }).click();
    await guest.getByRole('button', { name: 'Mark ready' }).click();
    await expect(host).toHaveURL(new RegExp(`/game/${roomCode}$`));
    await expect(guest).toHaveURL(new RegExp(`/game/${roomCode}$`));
    await expect(host.locator('.own-board-panel .cell')).toHaveCount(81);
    await expect(guest.locator('.own-board-panel .cell')).toHaveCount(81);

    const hostPuzzle = await host.locator('.own-board-panel .cell').allTextContents();
    const guestPuzzle = await guest.locator('.own-board-panel .cell').allTextContents();
    expect(hostPuzzle).toEqual(guestPuzzle);
    expect(hostPuzzle.filter((value) => value.trim() === '')).toHaveLength(45);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});

test('players solve on private Boards with notes, conflicts, and explicit solution checks', async ({ browser }) => {
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  try {
    await host.goto('/');
    await host.getByRole('button', { name: 'Create private Match' }).click();
    await expect(host).toHaveURL(/\/room\/[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    const roomCode = (await host.locator('.room-code').textContent())?.trim();
    if (!roomCode) throw new Error('The host lobby did not show a room code.');

    await guest.goto('/');
    await guest.getByLabel('Nickname').fill('Board Guest');
    await guest.getByRole('button', { name: 'Save nickname' }).click();
    await guest.goto(`/room/${roomCode}`);
    await expect(guest.locator('.player-name')).toHaveText(['Guest', 'Board Guest']);

    await guest.getByRole('button', { name: 'Accept difficulty' }).click();
    await host.getByRole('button', { name: 'Mark ready' }).click();
    await guest.getByRole('button', { name: 'Mark ready' }).click();
    await expect(host).toHaveURL(new RegExp(`/game/${roomCode}$`));
    await expect(guest).toHaveURL(new RegExp(`/game/${roomCode}$`));
    await expect(host.getByRole('button', { name: 'Pencil: off' })).toBeVisible();
    await expect(guest.getByRole('button', { name: 'Pencil: off' })).toBeVisible();

    const puzzle = await readPuzzle(host);
    expect(await readPuzzle(guest)).toEqual(puzzle);
    const hostCells = host.locator('.own-board-panel .cell');
    const guestCells = guest.locator('.own-board-panel .cell');
    const hostOpponentCells = host.locator('.opponent-board-panel .cell');
    const guestOpponentCells = guest.locator('.opponent-board-panel .cell');
    const firstClue = puzzle.findIndex((value) => value !== 0);
    const firstBlank = puzzle.findIndex((value) => value === 0);
    const secondBlank = puzzle.findIndex((value, index) => value === 0 && index !== firstBlank);
    await expect(host.getByRole('button', { name: 'Check solution' })).toHaveCount(0);

    await hostCells.nth(firstClue).click();
    await expect(hostCells.nth(firstClue)).not.toHaveClass(/selected/);
    await expect(hostCells.nth(firstClue)).toHaveText(String(puzzle[firstClue]));

    await hostCells.nth(firstBlank).click();
    await expect(hostCells.nth(firstBlank)).toHaveClass(/selected/);
    await host.getByRole('button', { name: '1', exact: true }).click();
    await expect(hostCells.nth(firstBlank)).toHaveText('1');
    await expect(guestOpponentCells.nth(firstBlank)).toHaveText('?');
    await expect(guestCells.nth(firstBlank)).toHaveText('');

    await guestCells.nth(firstBlank).tap();
    await expect(guestCells.nth(firstBlank)).toHaveClass(/selected/);
    await guest.getByRole('button', { name: '2', exact: true }).click();
    await expect(guestCells.nth(firstBlank)).toHaveText('2');
    await expect(hostCells.nth(firstBlank)).toHaveText('1');
    await expect(hostOpponentCells.nth(firstBlank)).toHaveText('?');

    await host.keyboard.press('3');
    await expect(hostCells.nth(firstBlank)).toHaveText('3');
    await expect(guestOpponentCells.nth(firstBlank)).toHaveText('?');
    await host.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(hostCells.nth(firstBlank)).toHaveText('');

    const candidateCell = puzzle.findIndex((value, index) => value === 0 && getCandidates(puzzle, index).length > 0);
    if (candidateCell < 0) throw new Error('The Puzzle did not offer a conflict-free entry candidate.');
    await hostCells.nth(candidateCell).click();
    await expect(hostCells.nth(candidateCell)).toHaveClass(/selected/);
    await host.getByRole('button', { name: String(getCandidates(puzzle, candidateCell)[0]), exact: true }).click();
    await expect(host.locator('.own-board-panel .incorrect')).toHaveCount(0);
    await expect(host.locator('.check-feedback')).toHaveCount(0);
    await host.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(hostCells.nth(candidateCell)).toHaveText('');

    await host.getByRole('button', { name: 'Pencil: off' }).click();
    await hostCells.nth(secondBlank).click();
    await expect(hostCells.nth(secondBlank)).toHaveClass(/selected/);
    await host.getByRole('button', { name: '4', exact: true }).click();
    await expect(hostCells.nth(secondBlank).locator('.pencil-grid')).toContainText('4');
    await expect(guestOpponentCells.nth(secondBlank)).toHaveText('');
    await host.getByRole('button', { name: '4', exact: true }).click();
    await expect(hostCells.nth(secondBlank)).toHaveText('');
    await expect(guestOpponentCells.nth(secondBlank)).toHaveText('');
    await host.getByRole('button', { name: 'Pencil: on' }).click();

    const edgeBlank = puzzle.findIndex((value, index) =>
      value === 0 && (index < 9 || index >= 72 || index % 9 === 0 || index % 9 === 8),
    );
    if (edgeBlank < 0) throw new Error('The generated Puzzle has no editable edge cell.');
    const edgeDirection = edgeBlank < 9
      ? 'ArrowUp'
      : edgeBlank >= 72
        ? 'ArrowDown'
        : edgeBlank % 9 === 0
          ? 'ArrowLeft'
          : 'ArrowRight';
    await hostCells.nth(edgeBlank).click();
    await expect(hostCells.nth(edgeBlank)).toHaveClass(/selected/);
    await host.keyboard.press(edgeDirection);
    await expect(hostCells.nth(edgeBlank)).toHaveClass(/selected/);

    const arrowSkip = findArrowSkip(puzzle);
    if (arrowSkip) {
      await hostCells.nth(arrowSkip.from).click();
      await expect(hostCells.nth(arrowSkip.from)).toHaveClass(/selected/);
      await host.keyboard.press(arrowSkip.direction);
      await expect(hostCells.nth(arrowSkip.to)).toHaveClass(/selected/);
    }

    for (const direction of ['row', 'column', 'box'] as const) {
      const [first, second] = findBlankPair(puzzle, direction);
      await hostCells.nth(first).click();
      await expect(hostCells.nth(first)).toHaveClass(/selected/);
      await host.getByRole('button', { name: '5', exact: true }).click();
      await expect(hostCells.nth(first)).toHaveText('5');
      await hostCells.nth(second).click();
      await expect(hostCells.nth(second)).toHaveClass(/selected/);
      await host.getByRole('button', { name: '5', exact: true }).click();
      await expect(hostCells.nth(second)).toHaveText('5');
      await expect(hostCells.nth(first)).toHaveClass(/conflict/);
      await expect(hostCells.nth(second)).toHaveClass(/conflict/);
      await hostCells.nth(first).click();
      await expect(hostCells.nth(first)).toHaveClass(/selected/);
      await host.getByRole('button', { name: 'Clear', exact: true }).click();
      await expect(hostCells.nth(first)).toHaveText('');
      await hostCells.nth(second).click();
      await expect(hostCells.nth(second)).toHaveClass(/selected/);
      await host.getByRole('button', { name: 'Clear', exact: true }).click();
      await expect(hostCells.nth(second)).toHaveText('');
    }

    for (const index of puzzle.flatMap((value, cellIndex) => value === 0 ? [cellIndex] : [])) {
      await hostCells.nth(index).click();
      await expect(hostCells.nth(index)).toHaveClass(/selected/);
      await host.keyboard.press('1');
      await expect(hostCells.nth(index)).toHaveText('1');
    }
    await expect(host.getByRole('button', { name: 'Check solution' })).toBeVisible();
    await host.getByRole('button', { name: 'Check solution' }).click();
    await expect(host.locator('.check-feedback')).toContainText('Incorrect entries are highlighted');
    await expect(host.locator('.own-board-panel .incorrect').first()).toBeVisible();
    await expect(host.getByRole('button', { name: 'Forfeit' })).toBeVisible();
    await expect(guest.locator('.opponent-board-panel .incorrect')).toHaveCount(0);
    await expect(guest.locator('.check-feedback')).toHaveCount(0);

    await hostCells.nth(firstBlank).click();
    await host.keyboard.press('2');
    await expect(host.locator('.own-board-panel .incorrect')).toHaveCount(0);
    await expect(host.locator('.check-feedback')).toHaveCount(0);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});

test('players can follow a masked opponent view and the live elapsed timer', async ({ browser }) => {
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  try {
    await host.goto('/');
    await host.getByRole('button', { name: 'Create private Match' }).click();
    await expect(host).toHaveURL(/\/room\/[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    const roomCode = (await host.locator('.room-code').textContent())?.trim();
    if (!roomCode) throw new Error('The host lobby did not show a room code.');

    await guest.goto('/');
    await guest.getByLabel('Nickname').fill('Timer Guest');
    await guest.getByRole('button', { name: 'Save nickname' }).click();
    await guest.goto(`/room/${roomCode}`);
    await expect(guest.locator('.player-name')).toHaveText(['Guest', 'Timer Guest']);

    await guest.getByRole('button', { name: 'Accept difficulty' }).click();
    await host.getByRole('button', { name: 'Mark ready' }).click();
    await guest.getByRole('button', { name: 'Mark ready' }).click();
    await expect(host).toHaveURL(new RegExp(`/game/${roomCode}$`));
    await expect(guest).toHaveURL(new RegExp(`/game/${roomCode}$`));

    const puzzle = await readPuzzle(host);
    const firstBlank = puzzle.findIndex((value) => value === 0);
    if (firstBlank < 0) throw new Error('The generated Puzzle has no editable cell.');

    await expect(host.locator('#timer')).toContainText(/00:\d{2}/);
    const beforeTimer = await host.locator('#timer').textContent();

    await guest.locator('.own-board-panel .cell').nth(firstBlank).click();
    await guest.getByRole('button', { name: '7', exact: true }).click();
    await expect.poll(async () => await host.locator('.opponent-board-panel .cell').nth(firstBlank).textContent())
      .toBe('?');
    await expect(host.locator('.opponent-board-panel .cell').nth(firstBlank)).toHaveClass(/selected/);

    await host.waitForTimeout(1200);
    const afterTimer = await host.locator('#timer').textContent();
    expect(afterTimer).not.toBe(beforeTimer);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
