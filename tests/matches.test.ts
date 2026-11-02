import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.SUDOKUELL_DB_PATH = ':memory:';

const { getDatabase } = await import('../src/lib/server/database');
const {
  createMatch,
  connectPlayerToMatch,
  getMatchForPlayer,
  joinMatch,
  performMatchAction,
  MatchError,
} = await import('../src/lib/server/matches');
const database = getDatabase();

function expectMatchError(action: () => void, status: number, message: string): void {
  try {
    action();
    throw new Error('Expected the Match action to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(MatchError);
    expect(error).toMatchObject({ status, message: expect.stringContaining(message) });
  }
}

beforeEach(() => {
  database.prepare('DELETE FROM matches').run();
});

type StoredMatch = {
  puzzle: number[][];
  solution: number[][];
  players: Record<string, {
    board: number[][];
    incorrectCells: string[];
    selectedCell: { row: number; col: number } | null;
    solvedAt: number | null;
  }>;
};

function readStoredMatch(code: string): StoredMatch {
  const row = database.prepare('SELECT state_json FROM matches WHERE id = ?').get(code) as
    { state_json: string };
  return JSON.parse(row.state_json) as StoredMatch;
}

function writeStoredMatch(code: string, match: StoredMatch): void {
  database.prepare('UPDATE matches SET state_json = ? WHERE id = ?')
    .run(JSON.stringify(match), code);
}

function createPlayingMatch(): string {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
  try {
    const created = createMatch('host-id', 'Host');
    joinMatch(created.id, 'guest-id', 'Guest');
    performMatchAction(created.id, 'guest-id', { type: 'acceptDifficulty' });
    performMatchAction(created.id, 'host-id', { type: 'ready' });
    performMatchAction(created.id, 'guest-id', { type: 'ready' });
    vi.advanceTimersByTime(3000);
    const { puzzle } = readStoredMatch(created.id);
    const row = puzzle.findIndex((values) => values.includes(0));
    const col = puzzle[row].indexOf(0);
    performMatchAction(created.id, 'host-id', { type: 'selection', row, col });
    return created.id;
  } finally {
    vi.useRealTimers();
  }
}

describe('shared Matches', () => {
  it('creates a room code and lets another guest join the lobby', () => {
    const created = createMatch('host-id', 'Host');
    const joined = joinMatch(created.id.toLowerCase(), 'guest-id', 'Guest');

    expect(created.id).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    expect(joined.id).toBe(created.id);
    expect(joined.status).toBe('lobby');
    expect(Object.keys(joined.players)).toHaveLength(2);
    expect(joined.players['guest-id'].isHost).toBe(false);
    expect(joined).not.toHaveProperty('solution');
  });

  it('masks opponent entries and pencil marks from each public Match view', () => {
    const created = createMatch('host-id', 'Host');
    joinMatch(created.id, 'guest-id', 'Guest');
    const stored = database.prepare('SELECT state_json FROM matches WHERE id = ?').get(created.id) as
      { state_json: string };
    const state = JSON.parse(stored.state_json) as {
      players: Record<string, { board: number[][]; pencilMarks: Record<string, number[]> }>;
    };
    state.players['host-id'].board[0][0] = 5;
    state.players['host-id'].pencilMarks['0-1'] = [4];
    database.prepare('UPDATE matches SET state_json = ? WHERE id = ?')
      .run(JSON.stringify(state), created.id);

    const guestView = joinMatch(created.id, 'guest-id', 'Guest');
    const hostView = joinMatch(created.id, 'host-id', 'Host');
    expect(guestView.players['host-id'].board[0][0]).toBe(1);
    expect(guestView.players['host-id'].pencilMarks).toEqual({});
    expect(hostView.players['host-id'].board[0][0]).toBe(5);
    expect(hostView.players['host-id'].pencilMarks['0-1']).toEqual([4]);
  });

  it('rejects unknown and malformed room codes with actionable errors', () => {
    expectMatchError(() => joinMatch('ABC234', 'guest-id', 'Guest'), 404, 'not found');
    expectMatchError(() => joinMatch('???', 'guest-id', 'Guest'), 400, 'six-character');
  });

  it('limits a Match to two players and allows a known player to reconnect', () => {
    const created = createMatch('host-id', 'Host');
    joinMatch(created.id, 'guest-id', 'Guest');

    expectMatchError(() => joinMatch(created.id, 'third-id', 'Third'), 409, 'two players');

    const reconnected = joinMatch(created.id, 'host-id', 'Host again');
    expect(Object.keys(reconnected.players)).toHaveLength(2);
    expect(reconnected.players['host-id'].name).toBe('Host again');
    expect(reconnected.players['host-id'].connected).toBe(true);
  });

  it('rejects new guests after both players start the countdown', () => {
    const created = createMatch('host-id', 'Host');
    joinMatch(created.id, 'guest-id', 'Guest');
    performMatchAction(created.id, 'guest-id', { type: 'acceptDifficulty' });
    performMatchAction(created.id, 'host-id', { type: 'ready' });
    const started = performMatchAction(created.id, 'guest-id', { type: 'ready' });

    expect(started.status).toBe('countdown');
    expectMatchError(() => joinMatch(created.id, 'third-id', 'Third'), 409, 'already started');
  });

  it('lets players accept and counter-propose the active Difficulty', () => {
    const created = createMatch('host-id', 'Host');
    joinMatch(created.id, 'guest-id', 'Guest');

    const hostProposal = performMatchAction(created.id, 'host-id', {
      type: 'difficulty',
      value: 'hard',
    });
    expect(hostProposal.difficulty).toBe('hard');
    expect(hostProposal.difficultyProposedBy).toBe('host-id');
    expect(hostProposal.difficultyAcceptedBy).toBeNull();

    const accepted = performMatchAction(created.id, 'guest-id', { type: 'acceptDifficulty' });
    expect(accepted.difficultyAcceptedBy).toBe('guest-id');
    const readyBeforeCounter = performMatchAction(created.id, 'host-id', { type: 'ready' });
    expect(readyBeforeCounter.players['host-id'].ready).toBe(true);

    const counterProposal = performMatchAction(created.id, 'guest-id', {
      type: 'difficulty',
      value: 'medium',
    });
    expect(counterProposal.difficulty).toBe('medium');
    expect(counterProposal.difficultyProposedBy).toBe('guest-id');
    expect(counterProposal.difficultyAcceptedBy).toBeNull();
    expect(counterProposal.players['host-id'].ready).toBe(false);
    expect(counterProposal.players['guest-id'].ready).toBe(false);

    const counterAccepted = performMatchAction(created.id, 'host-id', { type: 'acceptDifficulty' });
    expect(counterAccepted.difficultyAcceptedBy).toBe('host-id');
  });

  it('requires agreement and both players to be ready before starting the shared Puzzle', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    try {
      const created = createMatch('host-id', 'Host');
      joinMatch(created.id, 'guest-id', 'Guest');
      performMatchAction(created.id, 'host-id', { type: 'difficulty', value: 'medium' });

      expectMatchError(
        () => performMatchAction(created.id, 'guest-id', { type: 'ready' }),
        409,
        'agree on a difficulty',
      );

      performMatchAction(created.id, 'guest-id', { type: 'acceptDifficulty' });
      performMatchAction(created.id, 'host-id', { type: 'ready' });
      const started = performMatchAction(created.id, 'guest-id', { type: 'ready' });

      expect(started.status).toBe('countdown');
      expect(started.difficulty).toBe('medium');
      expect(started.puzzle).toHaveLength(9);
      expect(started.puzzle.every((row) => row.length === 9)).toBe(true);
      expect(started.puzzle.flat().filter((value) => value === 0)).toHaveLength(45);
      expect(started).not.toHaveProperty('solution');

      const hostView = getMatchForPlayer(created.id, 'host-id');
      const guestView = getMatchForPlayer(created.id, 'guest-id');
      expect(hostView.puzzle).toEqual(guestView.puzzle);
      expect(hostView.countdownEndsAt).toBe(guestView.countdownEndsAt);

      vi.advanceTimersByTime(3000);
      const hostStarted = getMatchForPlayer(created.id, 'host-id');
      const guestStarted = getMatchForPlayer(created.id, 'guest-id');
      expect(hostStarted.status).toBe('playing');
      expect(guestStarted.status).toBe('playing');
      expect(hostStarted.startedAt).toBe(guestStarted.startedAt);
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks a player offline when their last event stream closes', () => {
    const created = createMatch('host-id', 'Host');
    joinMatch(created.id, 'guest-id', 'Guest');
    const releaseFirst = connectPlayerToMatch(created.id, 'host-id');
    const releaseSecond = connectPlayerToMatch(created.id, 'host-id');

    releaseFirst();
    expect(getMatchForPlayer(created.id, 'host-id').players['host-id'].connected).toBe(true);

    releaseSecond();
    const offline = getMatchForPlayer(created.id, 'host-id').players['host-id'];
    expect(offline.connected).toBe(false);
    expect(offline.disconnectedAt).not.toBeNull();
  });

  it('ends a live Match after a disconnected player misses the reconnect grace period', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    try {
      const created = createMatch('host-id', 'Host');
      joinMatch(created.id, 'guest-id', 'Guest');
      performMatchAction(created.id, 'guest-id', { type: 'acceptDifficulty' });
      performMatchAction(created.id, 'host-id', { type: 'ready' });
      performMatchAction(created.id, 'guest-id', { type: 'ready' });
      vi.advanceTimersByTime(3000);
      expect(getMatchForPlayer(created.id, 'host-id').status).toBe('playing');

      performMatchAction(created.id, 'host-id', { type: 'disconnect' });
      vi.advanceTimersByTime(60_000);
      const finished = getMatchForPlayer(created.id, 'host-id');

      expect(finished.status).toBe('finished');
      expect(finished.winnerId).toBe('guest-id');
      expect(finished.resultText).toBe('Guest wins by forfeit');
    } finally {
      vi.useRealTimers();
    }
  });

  it('requires an explicit solution check after all editable cells are filled', () => {
    const code = createPlayingMatch();
    const state = readStoredMatch(code);
    const host = state.players['host-id'];
    let lastEditableCell = { row: 0, col: 0 };

    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        if (state.puzzle[row][col] === 0) {
          host.board[row][col] = state.solution[row][col];
          lastEditableCell = { row, col };
        }
      }
    }
    host.board[lastEditableCell.row][lastEditableCell.col] = 0;
    writeStoredMatch(code, state);

    performMatchAction(code, 'host-id', {
      type: 'selection',
      ...lastEditableCell,
    });
    const afterLastDigit = performMatchAction(code, 'host-id', {
      type: 'digit',
      value: state.solution[lastEditableCell.row][lastEditableCell.col],
    });
    expect(afterLastDigit.status).toBe('playing');
    expect(afterLastDigit.players['host-id'].solvedAt).toBeNull();

    const checked = performMatchAction(code, 'host-id', { type: 'check' });
    expect(checked.status).toBe('finished');
    expect(checked.winnerId).toBe('host-id');
  });

  it('rejects incomplete checks and privately reports wrong entries until an edit', () => {
    const code = createPlayingMatch();
    const state = readStoredMatch(code);
    const host = state.players['host-id'];
    let wrongCell: { row: number; col: number } | null = null;
    let lastEditableCell = { row: 0, col: 0 };

    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        if (state.puzzle[row][col] !== 0) continue;
        host.board[row][col] = state.solution[row][col];
        wrongCell ??= { row, col };
        lastEditableCell = { row, col };
      }
    }
    if (!wrongCell) throw new Error('The generated Puzzle must contain editable cells.');
    host.board[wrongCell.row][wrongCell.col] = (state.solution[wrongCell.row][wrongCell.col] % 9) + 1;
    host.board[lastEditableCell.row][lastEditableCell.col] = 0;
    writeStoredMatch(code, state);

    expectMatchError(
      () => performMatchAction(code, 'host-id', { type: 'check' }),
      409,
      'Fill every editable cell',
    );

    host.board[lastEditableCell.row][lastEditableCell.col] = state.solution[lastEditableCell.row][lastEditableCell.col];
    writeStoredMatch(code, state);
    const failedCheck = performMatchAction(code, 'host-id', { type: 'check' });
    expect(failedCheck.players['host-id'].incorrectCells).toEqual([`${wrongCell.row}-${wrongCell.col}`]);
    expect(failedCheck.players['guest-id'].incorrectCells).toEqual([]);
    expect(failedCheck.status).toBe('playing');

    performMatchAction(code, 'host-id', { type: 'selection', ...wrongCell });
    const afterPencilEdit = performMatchAction(code, 'host-id', {
      type: 'digit',
      value: 1,
      pencil: true,
    });
    expect(afterPencilEdit.players['host-id'].incorrectCells).toEqual([]);

    performMatchAction(code, 'host-id', { type: 'selection', ...wrongCell });
    const afterEdit = performMatchAction(code, 'host-id', {
      type: 'digit',
      value: state.solution[wrongCell.row][wrongCell.col],
    });
    expect(afterEdit.players['host-id'].incorrectCells).toEqual([]);
  });

  it('keeps pencil marks private to the acting player even during a live Match', () => {
    const code = createPlayingMatch();
    const state = readStoredMatch(code);
    let editableCell: { row: number; col: number } | null = null;

    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        if (state.puzzle[row][col] !== 0) continue;
        editableCell = { row, col };
        break;
      }
      if (editableCell) break;
    }
    if (!editableCell) throw new Error('The generated Puzzle must contain editable cells.');

    performMatchAction(code, 'host-id', { type: 'selection', ...editableCell });
    const withMark = performMatchAction(code, 'host-id', {
      type: 'digit',
      value: 3,
      pencil: true,
    });
    const guestView = getMatchForPlayer(code, 'guest-id');

    expect(withMark.players['host-id'].pencilMarks[`${editableCell.row}-${editableCell.col}`]).toEqual([3]);
    expect(guestView.players['host-id'].pencilMarks).toEqual({});
  });

  it('resets the lobby state when both players accept a rematch', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    try {
      const created = createMatch('host-id', 'Host');
      joinMatch(created.id, 'guest-id', 'Guest');
      performMatchAction(created.id, 'guest-id', { type: 'acceptDifficulty' });
      performMatchAction(created.id, 'host-id', { type: 'ready' });
      performMatchAction(created.id, 'guest-id', { type: 'ready' });
      vi.advanceTimersByTime(3000);
      performMatchAction(created.id, 'host-id', { type: 'forfeit' });

      const firstOffer = performMatchAction(created.id, 'host-id', { type: 'rematch' });
      const bothAccepted = performMatchAction(created.id, 'guest-id', { type: 'rematch' });

      expect(firstOffer.status).toBe('finished');
      expect(bothAccepted.status).toBe('lobby');
      expect(bothAccepted.hasStarted).toBe(false);
      expect(bothAccepted.players['host-id'].ready).toBe(false);
      expect(bothAccepted.players['guest-id'].ready).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
