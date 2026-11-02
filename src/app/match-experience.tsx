'use client';

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  DIFFICULTY_LEVELS,
  formatElapsed,
  getConflictCells,
  isBoardComplete,
  type Board,
  type Difficulty,
} from '@/lib/game';
import type { MatchStatus, Player, PublicMatch } from '@/lib/server/matches';

const PLAYER_KEY = 'sudokuell:player-id';
const NICKNAME_KEY = 'sudokuell:nickname';
const GUIDE_KEY = 'sudokuell:hide-guide';
const THEME_KEY = 'sudokuell:theme';
const LEGACY_ROOM_KEY = 'sudokuell:rooms';

function getPreferredTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getDigitClass(value: number): string {
  return `digit-${value}`;
}

type MatchResponse = { match?: PublicMatch; error?: string };

async function postMatch(path: string, body: unknown): Promise<PublicMatch> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json() as MatchResponse;
  if (!response.ok || !result.match) {
    throw new Error(result.error || 'The Match request failed.');
  }
  return result.match;
}

function statusLabel(status: MatchStatus, resultText: string): string {
  switch (status) {
    case 'lobby':
      return 'Lobby';
    case 'countdown':
      return 'Starting';
    case 'playing':
      return 'Match live';
    case 'finished':
      return resultText || 'Finished';
  }
}

function getOpponent(match: PublicMatch, playerId: string): Player | null {
  return Object.values(match.players).find((player) => player.id !== playerId) ?? null;
}

function roomPath(code: string): string {
  return `/room/${encodeURIComponent(code)}`;
}

function gamePath(code: string): string {
  return `/game/${encodeURIComponent(code)}`;
}

function DifficultyControls({
  match,
  player,
  onAction,
}: {
  match: PublicMatch;
  player: Player | null;
  onAction: (type: string, details?: Record<string, unknown>) => void;
}) {
  const difficultyAgreed = Boolean(
    match.difficultyAcceptedBy
    && match.difficultyProposedBy
    && match.difficultyAcceptedBy !== match.difficultyProposedBy,
  );
  const isProposer = match.difficultyProposedBy === player?.id;
  const proposerName = match.players[match.difficultyProposedBy ?? '']?.name ?? 'The other player';
  const otherPlayerName = Object.values(match.players).find((candidate) => candidate.id !== player?.id)?.name
    ?? 'the other player';
  const difficultyName = match.difficulty[0].toUpperCase() + match.difficulty.slice(1);

  return (
    <>
      <label>
        {isProposer ? 'Propose difficulty' : 'Counter-propose difficulty'}
        <select
          aria-label={isProposer ? 'Propose difficulty' : 'Counter-propose difficulty'}
          onChange={(event) => void onAction('difficulty', {
            value: event.target.value as Difficulty,
          })}
          value={match.difficulty}
        >
          {DIFFICULTY_LEVELS.map((difficulty) => (
            <option key={difficulty} value={difficulty}>
              {difficulty[0].toUpperCase() + difficulty.slice(1)}
            </option>
          ))}
        </select>
      </label>
      {!difficultyAgreed && !isProposer && match.difficultyProposedBy && (
        <button
          className="primary-button"
          onClick={() => void onAction('acceptDifficulty')}
          type="button"
        >
          Accept difficulty
        </button>
      )}
      <button
        className="primary-button"
        disabled={!difficultyAgreed}
        onClick={() => void onAction('ready')}
        type="button"
      >
        {player?.ready ? 'Unready' : 'Mark ready'}
      </button>
      <p className="difficulty-status" role="status">
        {difficultyAgreed
          ? `Both players agreed on ${difficultyName}. Mark ready when you are prepared.`
          : isProposer
            ? `You proposed ${difficultyName}. Waiting for ${otherPlayerName} to accept or counter-propose.`
            : `${proposerName} proposed ${difficultyName}. Accept it or counter-propose.`}
      </p>
    </>
  );
}

function BoardGrid({
  board,
  puzzle,
  player,
  isOwnBoard,
  incorrectCells,
  editable,
  onSelect,
}: {
  board: Board;
  puzzle: Board;
  player: Player | null;
  isOwnBoard: boolean;
  incorrectCells?: string[];
  editable: boolean;
  onSelect: (row: number, col: number) => void;
}) {
  const conflicts = getConflictCells(board, puzzle);

  return (
    <div className="board">
      {board.flatMap((rowValues, row) => rowValues.map((value, col) => {
        const clue = puzzle[row][col];
        const selected = player?.selectedCell?.row === row && player.selectedCell.col === col;
        const marks = player?.pencilMarks[`${row}-${col}`] ?? [];
        const renderedValue = clue !== 0
          ? clue
          : isOwnBoard
            ? value
            : value !== 0
              ? '?'
              : 0;
        const displayValue = !isOwnBoard && clue === 0 && value === 0 ? '' : renderedValue;
        const classes = [
          'cell',
          selected ? 'selected' : '',
          isOwnBoard && conflicts.has(`${row}-${col}`) ? 'conflict' : '',
          isOwnBoard && incorrectCells?.includes(`${row}-${col}`) ? 'incorrect' : '',
          !isOwnBoard ? 'masked' : '',
          isOwnBoard && value !== 0 ? 'revealed-clue' : '',
          typeof displayValue === 'number' && displayValue > 0 ? getDigitClass(displayValue) : '',
        ].filter(Boolean).join(' ');

        return (
          <button
            aria-label={`Row ${row + 1}, column ${col + 1}${clue ? `, Puzzle clue ${clue}` : ''}`}
            className={classes}
            key={`${row}-${col}`}
            onClick={() => editable && clue === 0 && onSelect(row, col)}
            type="button"
          >
            {!isOwnBoard
              ? (clue !== 0 ? clue : value !== 0 ? '?' : '')
              : clue !== 0
                ? clue
                : value !== 0
                ? value
                : marks.length > 0 && (
                  <span className="pencil-grid">
                    {Array.from({ length: 9 }, (_, index) => (
                      <span key={index}>{marks.includes(index + 1) ? index + 1 : ''}</span>
                    ))}
                  </span>
                )}
          </button>
        );
      }))}
    </div>
  );
}

type MatchExperienceProps = {
  route: 'home' | 'room' | 'game';
  code?: string;
};

export default function MatchExperience({ route, code }: MatchExperienceProps) {
  const router = useRouter();
  const [playerId, setPlayerId] = useState('');
  const [nickname, setNickname] = useState('Guest');
  const [roomCode, setRoomCode] = useState('');
  const [match, setMatch] = useState<PublicMatch | null>(null);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('');
  const [pencilMode, setPencilMode] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [themeOverride, setThemeOverride] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [initialized, setInitialized] = useState(false);

  const joinMatch = useCallback(async (roomCode: string, id: string, name: string) => {
    const normalizedCode = roomCode.trim().toUpperCase();
    if (!normalizedCode) return null;
    setError('');
    try {
      const joined = await postMatch(
        `/api/matches/${encodeURIComponent(normalizedCode)}/join`,
        { playerId: id, name },
      );
      setMatch(joined);
      setRoomCode(joined.id);
      return joined;
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Unable to join this Match.');
      return null;
    }
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const preferredTheme = getPreferredTheme();
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTheme(savedTheme);
      setThemeOverride(true);
    } else {
      setTheme(preferredTheme);
      setThemeOverride(false);
    }

    const id = localStorage.getItem(PLAYER_KEY) || crypto.randomUUID();
    const savedNickname = localStorage.getItem(NICKNAME_KEY)?.trim() || 'Guest';
    localStorage.setItem(PLAYER_KEY, id);
    localStorage.removeItem(LEGACY_ROOM_KEY);
    setPlayerId(id);
    setNickname(savedNickname);
    setGuideVisible(!localStorage.getItem(GUIDE_KEY));
    setInitialized(true);

    if (route !== 'home' && code) {
      setRoomCode(code);
      void joinMatch(code, id, savedNickname);
    } else if (route === 'home') {
      const inviteCode = new URLSearchParams(window.location.search).get('room');
      if (inviteCode) router.replace(roomPath(inviteCode));
    }
  }, [code, joinMatch, route, router]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    if (themeOverride) {
      localStorage.setItem(THEME_KEY, theme);
    } else {
      localStorage.removeItem(THEME_KEY);
    }
  }, [theme, themeOverride]);

  useEffect(() => {
    if (themeOverride) return undefined;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setTheme(mediaQuery.matches ? 'dark' : 'light');
    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeOverride]);

  useEffect(() => {
    if (!match || !playerId) return undefined;
    setConnectionStatus('Connecting…');
    const source = new EventSource(
      `/api/matches/${encodeURIComponent(match.id)}/events?playerId=${encodeURIComponent(playerId)}`,
    );
    source.onopen = () => setConnectionStatus('Live updates connected');
    source.onmessage = (event) => {
      try {
        setMatch(JSON.parse(event.data) as PublicMatch);
        setConnectionStatus('Live updates connected');
      } catch {
        setError('The server sent an unreadable Match update.');
      }
    };
    source.addEventListener('error', (event) => {
      if (event instanceof MessageEvent && event.data) {
        try {
          const result = JSON.parse(event.data) as { error?: string };
          setError(result.error || 'The Match connection failed.');
        } catch {
          setError('The Match connection failed.');
        }
      }
    });
    source.onerror = () => setConnectionStatus('Reconnecting to live updates…');
    return () => source.close();
  }, [match?.id, playerId]);

  useEffect(() => {
    if (!match) return;
    if (route === 'room' && match.hasStarted) {
      router.replace(gamePath(match.id));
    } else if (route === 'game' && !match.hasStarted) {
      router.replace(roomPath(match.id));
    }
  }, [match?.id, match?.hasStarted, route, router]);

  useEffect(() => {
    if (!match || (match.status !== 'countdown' && match.status !== 'playing')) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [match?.id, match?.status]);

  const sendAction = useCallback(async (type: string, details: Record<string, unknown> = {}) => {
    if (!match || !playerId) return;
    setError('');
    try {
      const updated = await postMatch(
        `/api/matches/${encodeURIComponent(match.id)}/actions`,
        { playerId, action: { type, ...details } },
      );
      setMatch(updated);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'The Match action failed.');
    }
  }, [match?.id, playerId]);

  const createMatch = async () => {
    if (!playerId) return;
    setError('');
    try {
      const created = await postMatch('/api/matches', { playerId, name: nickname });
      setMatch(created);
      setRoomCode(created.id);
      router.push(roomPath(created.id));
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create a Match.');
    }
  };

  const submitJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!playerId) return;
    void joinMatch(roomCode, playerId, nickname).then((joined) => {
      if (joined) router.push(roomPath(joined.id));
    });
  };

  const saveNickname = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const savedNickname = nickname.trim().slice(0, 24) || 'Guest';
    localStorage.setItem(NICKNAME_KEY, savedNickname);
    setNickname(savedNickname);
  };

  const copyInvite = async () => {
    if (!match) return;
    try {
      const invite = new URL(roomPath(match.id), window.location.origin);
      await navigator.clipboard.writeText(invite.toString());
      setError('');
    } catch {
      setError('Could not copy the invite link. Copy the room code instead.');
    }
  };

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
      return;
    }
    if (!match || match.status !== 'playing') return;
    const player = match.players[playerId];
    if (!player?.selectedCell) return;

    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      void sendAction('clear');
      return;
    }

    if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      let row = player.selectedCell.row;
      let col = player.selectedCell.col;
      if (event.key === 'ArrowUp') row -= 1;
      if (event.key === 'ArrowDown') row += 1;
      if (event.key === 'ArrowLeft') col -= 1;
      if (event.key === 'ArrowRight') col += 1;
      while (
        row >= 0
        && row < 9
        && col >= 0
        && col < 9
        && match.puzzle[row][col] !== 0
      ) {
        if (event.key === 'ArrowUp') row -= 1;
        if (event.key === 'ArrowDown') row += 1;
        if (event.key === 'ArrowLeft') col -= 1;
        if (event.key === 'ArrowRight') col += 1;
      }
      if (row >= 0 && row < 9 && col >= 0 && col < 9) {
        void sendAction('selection', { row, col });
      }
      return;
    }

    const digit = Number(event.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= 9) {
      void sendAction('digit', { value: digit, pencil: pencilMode });
    }
  }, [match, playerId, pencilMode, sendAction]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!initialized) {
    return <main id="app" aria-busy="true">Loading Sudokuell…</main>;
  }

  const me = match?.players[playerId] ?? null;
  const opponent = match ? getOpponent(match, playerId) : null;
  const boardComplete = match && me ? isBoardComplete(me.board, match.puzzle) : false;
  const countdown = match?.countdownEndsAt
    ? Math.max(0, Math.ceil((match.countdownEndsAt - now) / 1000))
    : 0;
  const elapsed = match?.startedAt ? formatElapsed(now - match.startedAt) : '00:00';

  return (
    <main id="app">
      <header>
        <h1>Sudokuell</h1>
        <div className="top-actions">
          <button
            aria-label="Toggle theme"
            className="small-button theme-toggle"
            onClick={() => {
              const nextTheme = theme === 'dark' ? 'light' : 'dark';
              setTheme(nextTheme);
              setThemeOverride(true);
            }}
            type="button"
          >
            Theme: {theme === 'dark' ? 'Dark' : 'Light'}
          </button>
          <div id="room-status">
            {match
              ? match.status === 'lobby' && match.hasStarted
                ? 'Rematch setup'
                : statusLabel(match.status, match.resultText)
              : 'Ready'}
          </div>
        </div>
      </header>

      {error && <div className="notice error-notice" role="alert">{error}</div>}

      {route === 'home' && !match && (
        <section className="panel">
          <form onSubmit={saveNickname}>
            <input
              aria-label="Nickname"
              maxLength={24}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="Nickname"
              type="text"
              value={nickname}
            />
            <button className="primary-button" type="submit">Save nickname</button>
          </form>
          <form onSubmit={submitJoin}>
            <input
              aria-label="Room code"
              autoCapitalize="characters"
              maxLength={6}
              onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
              placeholder="Room code"
              type="text"
              value={roomCode}
            />
            <button className="primary-button" disabled={!roomCode.trim()} type="submit">Join Match</button>
            <button className="small-button" onClick={() => void createMatch()} type="button">Create private Match</button>
          </form>
        </section>
      )}

      {route !== 'home' && !match && (
        <section className="panel route-status">
          {error
            ? <button className="ghost-button" onClick={() => router.push('/')} type="button">Return to Sudokuell</button>
            : <p>Loading Match…</p>}
        </section>
      )}

      {route === 'home' && match && (
        <section className="panel route-status"><p>Opening Room…</p></section>
      )}

      {route === 'room' && match && !match.hasStarted && (
        <section className="panel room-screen">
          <div className="top-actions">
            <div className="room-code">{match.id}</div>
            <button className="small-button" onClick={() => void copyInvite()} type="button">Copy invite</button>
          </div>

          <div className="players-row">
            {Object.values(match.players).map((player) => (
              <div className={`player-card ${player.ready ? 'ready' : ''}`} key={player.id}>
                <div className="player-name">{player.name}</div>
                <div className="player-meta">
                  {player.isHost ? 'Host' : 'Guest'} · {player.ready ? 'Ready' : 'Waiting'} · {player.connected ? 'Online' : 'Disconnected'}
                </div>
              </div>
            ))}
          </div>

          <div className="controls">
            <DifficultyControls match={match} onAction={sendAction} player={me} />
            <button className="ghost-button" onClick={() => void sendAction('disconnect')} type="button">Disconnect</button>
            <button className="ghost-button" onClick={() => void sendAction('reconnect')} type="button">Reconnect</button>
          </div>
          {connectionStatus && <p className="connection-status" aria-live="polite">{connectionStatus}</p>}

          {!match.hasStarted && guideVisible && (
            <div className="guide">
              <h3>Quick guide</h3>
              <ul>
                <li>Select a cell, then type digits or use the number pad.</li>
                <li>Pencil mode keeps your notes private.</li>
                <li>The opponent view masks digits as ? and highlights the active square.</li>
                <li>The first player to check a complete, correct Board wins.</li>
              </ul>
              <button
                className="small-button"
                onClick={() => {
                  localStorage.setItem(GUIDE_KEY, 'true');
                  setGuideVisible(false);
                }}
                type="button"
              >
                Dismiss
              </button>
            </div>
          )}
        </section>
      )}

      {route === 'room' && match?.hasStarted && (
        <section className="panel route-status"><p>Match started. Opening Game…</p></section>
      )}

      {route === 'game' && match && (
        <div className="game-view">
          {(match.status === 'countdown' || match.status === 'playing' || match.status === 'finished') && (
            <div className="game-timer" id="timer" aria-live="off">
              {match.status === 'countdown' ? `Starts in ${countdown}` : elapsed}
            </div>
          )}

          <section className="panel game-screen">
            <div className="top-actions">
              <div className="room-code">{match.id}</div>
              <button className="small-button" onClick={() => void copyInvite()} type="button">Copy invite</button>
            </div>

            {match.status === 'lobby' && (
              <>
                <div className="players-row">
                  {Object.values(match.players).map((player) => (
                    <div className={`player-card ${player.ready ? 'ready' : ''}`} key={player.id}>
                      <div className="player-name">{player.name}</div>
                      <div className="player-meta">
                        {player.isHost ? 'Host' : 'Guest'} · {player.ready ? 'Ready' : 'Waiting'} · {player.connected ? 'Online' : 'Disconnected'}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="controls">
                  <DifficultyControls match={match} onAction={sendAction} player={me} />
                </div>
              </>
            )}

            <div className="controls game-actions">
              {match.status === 'playing' && (
                <>
                  <button className="ghost-button" onClick={() => setPencilMode((enabled) => !enabled)} type="button">
                    Pencil: {pencilMode ? 'on' : 'off'}
                  </button>
                  <button className="danger-button" onClick={() => void sendAction('forfeit')} type="button">Forfeit</button>
                </>
              )}
              <button className="ghost-button" onClick={() => void sendAction('disconnect')} type="button">Disconnect</button>
              <button className="ghost-button" onClick={() => void sendAction('reconnect')} type="button">Reconnect</button>
            </div>
            {connectionStatus && <p className="connection-status" aria-live="polite">{connectionStatus}</p>}

            {match.status !== 'lobby' && (
              <>
                <div className="match-layout">
                  <div className="board-panel own-board-panel">
                    <h3>{me?.name || 'Player'} board</h3>
                    <BoardGrid
                      board={me?.board ?? match.puzzle}
                      editable={match.status === 'playing'}
                      incorrectCells={me?.incorrectCells ?? []}
                      isOwnBoard
                      onSelect={(row, col) => void sendAction('selection', { row, col })}
                      player={me}
                      puzzle={match.puzzle}
                    />
                  </div>
                  <div className="board-panel opponent-board-panel">
                    <h3>{opponent?.name || 'Opponent'} board</h3>
                    <BoardGrid
                      board={opponent?.board ?? match.puzzle}
                      editable={false}
                      isOwnBoard={false}
                      onSelect={() => {}}
                      player={opponent}
                      puzzle={match.puzzle}
                    />
                  </div>
                </div>

                {match.status === 'playing' && (
                  <>
                    {me?.incorrectCells.length ? (
                      <p className="check-feedback" role="status">
                        Incorrect entries are highlighted. Edit any entry to try again.
                      </p>
                    ) : null}
                    <div className="game-bottom-controls">
                      {boardComplete && (
                        <button className="primary-button" onClick={() => void sendAction('check')} type="button">
                          Check solution
                        </button>
                      )}
                      <div id="number-pad">
                        {Array.from({ length: 9 }, (_, index) => (
                          <button
                            className={`digit-button ${getDigitClass(index + 1)}`}
                            disabled={!me?.selectedCell}
                            key={index + 1}
                            onClick={() => void sendAction('digit', { value: index + 1, pencil: pencilMode })}
                            type="button"
                          >
                            {index + 1}
                          </button>
                        ))}
                        <button
                          className="digit-button clear-button"
                          disabled={!me?.selectedCell}
                          onClick={() => void sendAction('clear')}
                          type="button"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </section>

          {match.status === 'finished' && (
            <section className="panel result-box">
              <h2>{match.draw ? 'Draw' : (match.winnerId ? match.players[match.winnerId]?.name || 'Winner' : 'Winner')}</h2>
              <p>{match.resultText || 'Match complete'}</p>
              <p>Time: {elapsed}</p>
              <button className="primary-button" onClick={() => void sendAction('rematch')} type="button">Offer rematch</button>
              {me?.rematchAccepted && <p>Waiting for the other player to accept.</p>}
            </section>
          )}
        </div>
      )}
    </main>
  );
}
