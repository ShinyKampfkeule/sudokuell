import { randomInt } from 'node:crypto';
import {
  createEmptyBoard,
  generatePuzzle,
  isBoardComplete,
  type Board,
  type Cell,
  type Difficulty,
} from '../game';
import { getDatabase } from './database';

export type MatchStatus = 'lobby' | 'countdown' | 'playing' | 'finished';

export type Player = {
  id: string;
  name: string;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  disconnectedAt: number | null;
  board: Board;
  pencilMarks: Record<string, number[]>;
  selectedCell: Cell | null;
  proposedDifficulty: Difficulty;
  solvedAt: number | null;
  incorrectCells: string[];
  rematchAccepted: boolean;
};

export type Match = {
  id: string;
  createdAt: number;
  difficulty: Difficulty;
  difficultyProposedBy: string | null;
  difficultyAcceptedBy: string | null;
  status: MatchStatus;
  hasStarted: boolean;
  puzzle: Board;
  solution: Board;
  startedAt: number | null;
  countdownEndsAt: number | null;
  resultText: string;
  winnerId: string | null;
  draw: boolean;
  players: Record<string, Player>;
};

export type PublicMatch = Omit<Match, 'solution'>;

type MatchListener = (match: Match) => void;
type PublicMatchListener = (match: PublicMatch) => void;
type ListenerMap = Map<string, Set<MatchListener>>;
type ConnectionMap = Map<string, Map<string, number>>;

const globalForSudokuell = globalThis as typeof globalThis & {
  sudokuellListeners?: ListenerMap;
  sudokuellConnections?: ConnectionMap;
};
const listeners = globalForSudokuell.sudokuellListeners ?? new Map<string, Set<MatchListener>>();
globalForSudokuell.sudokuellListeners = listeners;
const connections = globalForSudokuell.sudokuellConnections ?? new Map<string, Map<string, number>>();
globalForSudokuell.sudokuellConnections = connections;

export class MatchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'MatchError';
  }
}

function normalizeCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(normalized)) {
    throw new MatchError('Enter a valid six-character room code.', 400);
  }
  return normalized;
}

function normalizePlayer(id: unknown, name: unknown): { id: string; name: string } {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    throw new MatchError('A valid guest player ID is required.', 400);
  }
  const cleanName = typeof name === 'string' ? name.trim().slice(0, 24) : '';
  return { id, name: cleanName || 'Guest' };
}

function loadMatch(code: string): Match {
  const row = getDatabase().prepare('SELECT state_json FROM matches WHERE id = ?').get(code) as
    | { state_json: string }
    | undefined;
  if (!row) {
    throw new MatchError('Match not found. Check the room code and try again.', 404);
  }
  const match = JSON.parse(row.state_json) as Match;
  match.hasStarted ??= match.status !== 'lobby' || match.startedAt !== null;
  if (match.difficultyProposedBy === undefined) {
    match.difficultyProposedBy = Object.values(match.players).find((player) => player.isHost)?.id ?? null;
    match.difficultyAcceptedBy = null;
    for (const player of Object.values(match.players)) {
      player.ready = false;
    }
  }
  match.difficultyAcceptedBy ??= null;
  for (const player of Object.values(match.players)) {
    player.incorrectCells ??= [];
  }
  return match;
}

function toPublicMatch(match: Match, viewerId: string): PublicMatch {
  const { solution: _solution, ...publicMatch } = structuredClone(match);
  for (const player of Object.values(publicMatch.players)) {
    if (player.id !== viewerId) {
      player.board = player.board.map((row) => row.map((value) => (value === 0 ? 0 : 1)));
      player.pencilMarks = {};
      player.incorrectCells = [];
    }
  }
  return publicMatch;
}

function persist(match: Match): void {
  getDatabase().prepare(`
    INSERT INTO matches (id, created_at, state_json)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json
  `).run(match.id, match.createdAt, JSON.stringify(match));
  publish(match);
}

function publish(match: Match): void {
  const matchListeners = listeners.get(match.id);
  if (!matchListeners) return;
  for (const listener of matchListeners) {
    listener(match);
  }
}

export function subscribeToMatch(code: string, playerId: string, listener: PublicMatchListener): () => void {
  const normalized = normalizeCode(code);
  const matchListeners = listeners.get(normalized) ?? new Set<MatchListener>();
  const scopedListener: MatchListener = (match) => listener(toPublicMatch(match, playerId));
  matchListeners.add(scopedListener);
  listeners.set(normalized, matchListeners);
  return () => {
    matchListeners.delete(scopedListener);
    if (matchListeners.size === 0) listeners.delete(normalized);
  };
}

export function connectPlayerToMatch(code: string, playerId: string): () => void {
  const normalizedCode = normalizeCode(code);
  requirePlayer(loadMatch(normalizedCode), playerId);
  performMatchAction(normalizedCode, playerId, { type: 'reconnect' });

  const matchConnections = connections.get(normalizedCode) ?? new Map<string, number>();
  matchConnections.set(playerId, (matchConnections.get(playerId) ?? 0) + 1);
  connections.set(normalizedCode, matchConnections);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const currentConnections = connections.get(normalizedCode);
    if (!currentConnections) return;

    const remaining = (currentConnections.get(playerId) ?? 1) - 1;
    if (remaining > 0) {
      currentConnections.set(playerId, remaining);
      return;
    }

    currentConnections.delete(playerId);
    if (currentConnections.size === 0) connections.delete(normalizedCode);
    const currentMatch = loadMatch(normalizedCode);
    if (currentMatch.players[playerId]?.connected) {
      performMatchAction(normalizedCode, playerId, { type: 'disconnect' });
    }
  };
}

function saveAndReturn(match: Match, viewerId: string): PublicMatch {
  persist(match);
  return toPublicMatch(match, viewerId);
}

function createPlayer(id: string, name: string, isHost: boolean, difficulty: Difficulty = 'easy'): Player {
  return {
    id,
    name,
    isHost,
    ready: false,
    connected: true,
    disconnectedAt: null,
    board: createEmptyBoard(),
    pencilMarks: {},
    selectedCell: null,
    proposedDifficulty: difficulty,
    solvedAt: null,
    incorrectCells: [],
    rematchAccepted: false,
  };
}

function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
}

export function createMatch(playerId: unknown, playerName: unknown): PublicMatch {
  const player = normalizePlayer(playerId, playerName);
  let id = generateRoomCode();
  while (getDatabase().prepare('SELECT 1 FROM matches WHERE id = ?').get(id)) {
    id = generateRoomCode();
  }
  const now = Date.now();
  const match: Match = {
    id,
    createdAt: now,
    difficulty: 'easy',
    difficultyProposedBy: player.id,
    difficultyAcceptedBy: null,
    status: 'lobby',
    hasStarted: false,
    puzzle: createEmptyBoard(),
    solution: createEmptyBoard(),
    startedAt: null,
    countdownEndsAt: null,
    resultText: '',
    winnerId: null,
    draw: false,
    players: { [player.id]: createPlayer(player.id, player.name, true) },
  };
  return saveAndReturn(match, player.id);
}

export function joinMatch(code: string, playerId: unknown, playerName: unknown): PublicMatch {
  const normalizedCode = normalizeCode(code);
  const guest = normalizePlayer(playerId, playerName);
  const match = loadMatch(normalizedCode);
  const existingPlayer = match.players[guest.id];

  if (!existingPlayer) {
    if (match.status !== 'lobby') {
      throw new MatchError('This Match has already started or ended.', 409);
    }
    if (Object.keys(match.players).length >= 2) {
      throw new MatchError('This Match already has two players.', 409);
    }
    match.players[guest.id] = createPlayer(guest.id, guest.name, false, match.difficulty);
  } else {
    existingPlayer.name = guest.name;
    existingPlayer.connected = true;
    existingPlayer.disconnectedAt = null;
  }

  return saveAndReturn(match, guest.id);
}

export function getMatchForPlayer(code: string, playerId: string): PublicMatch {
  const normalizedCode = normalizeCode(code);
  const match = loadMatch(normalizedCode);
  advanceMatch(match);
  requirePlayer(match, playerId);
  return toPublicMatch(match, playerId);
}

function requirePlayer(match: Match, playerId: string): Player {
  const player = match.players[playerId];
  if (!player) {
    throw new MatchError('You are not a player in this Match.', 403);
  }
  return player;
}

function finishForfeit(match: Match, winner: Player | undefined): void {
  match.status = 'finished';
  match.countdownEndsAt = null;
  match.winnerId = winner?.id ?? null;
  match.draw = false;
  match.resultText = winner ? `${winner.name} wins by forfeit` : 'Match ended';
}

function advanceMatch(match: Match): boolean {
  const now = Date.now();
  let changed = false;

  if (match.status === 'countdown' && match.countdownEndsAt !== null && now >= match.countdownEndsAt) {
    match.status = 'playing';
    match.startedAt = now;
    match.countdownEndsAt = null;
    match.resultText = '';
    match.winnerId = null;
    match.draw = false;
    changed = true;
  }

  if (match.status === 'playing') {
    const players = Object.values(match.players);
    const disconnected = players.find((player) =>
      !player.connected
      && player.disconnectedAt !== null
      && now - player.disconnectedAt >= 60_000,
    );
    if (disconnected) {
      finishForfeit(match, players.find((player) => player.id !== disconnected.id));
      changed = true;
    }
  }

  if (changed) persist(match);
  return changed;
}

function startCountdownIfReady(match: Match): void {
  const players = Object.values(match.players);
  if (
    match.status !== 'lobby'
    || players.length !== 2
    || !match.difficultyAcceptedBy
    || match.difficultyAcceptedBy === match.difficultyProposedBy
    || !players.every((player) => player.ready)
    || new Set(players.map((player) => player.proposedDifficulty)).size !== 1
  ) {
    return;
  }

  match.difficulty = players[0].proposedDifficulty;
  const { puzzle, solution } = generatePuzzle(match.difficulty);
  match.puzzle = puzzle;
  match.solution = solution;
  match.status = 'countdown';
  match.hasStarted = true;
  match.countdownEndsAt = Date.now() + 3000;
  match.startedAt = null;
  for (const player of players) {
    player.board = createEmptyBoard();
    player.pencilMarks = {};
    player.selectedCell = null;
    player.solvedAt = null;
    player.incorrectCells = [];
    player.rematchAccepted = false;
  }
}

function finishSolvedMatch(match: Match): void {
  const completed = Object.values(match.players)
    .filter((player) => player.solvedAt !== null)
    .sort((left, right) => (left.solvedAt ?? 0) - (right.solvedAt ?? 0));
  if (completed.length === 0) return;

  const first = completed[0];
  match.status = 'finished';
  match.countdownEndsAt = null;
  match.draw = false;
  match.winnerId = first.id;
  match.resultText = `${first.name} wins`;
}

function requirePlaying(match: Match): void {
  if (match.status !== 'playing') {
    throw new MatchError('This action is only available during a live Match.', 409);
  }
}

function requireLobby(match: Match): void {
  if (match.status !== 'lobby') {
    throw new MatchError('Match settings can only be changed in the lobby.', 409);
  }
}

function requireCell(row: unknown, col: unknown): Cell {
  if (
    typeof row !== 'number'
    || !Number.isInteger(row)
    || row < 0
    || row > 8
    || typeof col !== 'number'
    || !Number.isInteger(col)
    || col < 0
    || col > 8
  ) {
    throw new MatchError('Choose a valid Sudoku cell.', 400);
  }
  return { row, col };
}

function requireDigit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 9) {
    throw new MatchError('Choose a digit from 1 to 9.', 400);
  }
  return value;
}

export function performMatchAction(code: string, playerId: unknown, input: unknown): PublicMatch {
  const normalizedCode = normalizeCode(code);
  if (typeof playerId !== 'string') {
    throw new MatchError('A valid guest player ID is required.', 400);
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new MatchError('A valid Match action is required.', 400);
  }
  const action = input as Record<string, unknown>;
  if (typeof action.type !== 'string') {
    throw new MatchError('A valid Match action is required.', 400);
  }

  const match = loadMatch(normalizedCode);
  advanceMatch(match);
  const player = requirePlayer(match, playerId);

  switch (action.type) {
    case 'difficulty': {
      requireLobby(match);
      if (action.value !== 'easy' && action.value !== 'medium' && action.value !== 'hard') {
        throw new MatchError('Choose Easy, Medium, or Hard difficulty.', 400);
      }
      player.proposedDifficulty = action.value;
      match.difficulty = player.proposedDifficulty;
      match.difficultyProposedBy = player.id;
      match.difficultyAcceptedBy = null;
      for (const candidate of Object.values(match.players)) {
        candidate.ready = false;
      }
      break;
    }
    case 'acceptDifficulty': {
      requireLobby(match);
      if (!match.difficultyProposedBy || match.difficultyProposedBy === player.id) {
        throw new MatchError('Only the other player can accept this difficulty proposal.', 409);
      }
      match.difficultyAcceptedBy = player.id;
      player.proposedDifficulty = match.difficulty;
      break;
    }
    case 'ready':
      requireLobby(match);
      if (!match.difficultyAcceptedBy || match.difficultyAcceptedBy === match.difficultyProposedBy) {
        throw new MatchError('Both players must agree on a difficulty before getting ready.', 409);
      }
      player.ready = !player.ready;
      startCountdownIfReady(match);
      break;
    case 'selection': {
      requirePlaying(match);
      const { row, col } = requireCell(action.row, action.col);
      if (match.puzzle[row][col] !== 0) {
        throw new MatchError('Puzzle clues cannot be selected.', 409);
      }
      player.selectedCell = { row, col };
      break;
    }
    case 'digit': {
      requirePlaying(match);
      const value = requireDigit(action.value);
      const selection = player.selectedCell;
      if (!selection || match.puzzle[selection.row][selection.col] !== 0) {
        throw new MatchError('Select an empty cell first.', 409);
      }
      const key = `${selection.row}-${selection.col}`;
      if (action.pencil === true) {
        const marks = new Set(player.pencilMarks[key] ?? []);
        if (marks.has(value)) marks.delete(value);
        else marks.add(value);
        if (marks.size === 0) delete player.pencilMarks[key];
        else player.pencilMarks[key] = [...marks];
        player.incorrectCells = [];
      } else {
        player.board[selection.row][selection.col] = value;
        delete player.pencilMarks[key];
        player.incorrectCells = [];
      }
      break;
    }
    case 'clear': {
      requirePlaying(match);
      const selection = player.selectedCell;
      if (!selection || match.puzzle[selection.row][selection.col] !== 0) {
        throw new MatchError('Select an empty cell first.', 409);
      }
      player.board[selection.row][selection.col] = 0;
      delete player.pencilMarks[`${selection.row}-${selection.col}`];
      player.incorrectCells = [];
      break;
    }
    case 'check': {
      requirePlaying(match);
      if (!isBoardComplete(player.board, match.puzzle)) {
        throw new MatchError('Fill every editable cell before checking the solution.', 409);
      }

      player.incorrectCells = [];
      for (let row = 0; row < 9; row += 1) {
        for (let col = 0; col < 9; col += 1) {
          if (match.puzzle[row][col] === 0 && player.board[row][col] !== match.solution[row][col]) {
            player.incorrectCells.push(`${row}-${col}`);
          }
        }
      }
      if (player.incorrectCells.length === 0) {
        player.solvedAt = Date.now();
        finishSolvedMatch(match);
      }
      break;
    }
    case 'forfeit': {
      requirePlaying(match);
      const opponent = Object.values(match.players).find((candidate) => candidate.id !== player.id);
      finishForfeit(match, opponent);
      break;
    }
    case 'disconnect':
      player.connected = false;
      player.disconnectedAt = Date.now();
      break;
    case 'reconnect':
      player.connected = true;
      player.disconnectedAt = null;
      break;
    case 'rematch': {
      if (match.status !== 'finished') {
        throw new MatchError('A rematch can only be offered after a Match ends.', 409);
      }
      const players = Object.values(match.players);
      if (players.length !== 2) {
        throw new MatchError('A rematch requires both players.', 409);
      }
      player.rematchAccepted = !player.rematchAccepted;
      if (players.every((candidate) => candidate.rematchAccepted)) {
        match.status = 'lobby';
        match.hasStarted = false;
        match.resultText = '';
        match.startedAt = null;
        match.countdownEndsAt = null;
        match.winnerId = null;
        match.draw = false;
        match.difficulty = player.proposedDifficulty || match.difficulty;
        match.difficultyProposedBy = players.find((candidate) => candidate.isHost)?.id ?? null;
        match.difficultyAcceptedBy = null;
        for (const candidate of players) {
          candidate.ready = false;
          candidate.board = createEmptyBoard();
          candidate.pencilMarks = {};
          candidate.selectedCell = null;
          candidate.solvedAt = null;
          candidate.incorrectCells = [];
          candidate.proposedDifficulty = match.difficulty;
          candidate.rematchAccepted = false;
        }
      }
      break;
    }
    default:
      throw new MatchError('Unsupported Match action.', 400);
  }

  return saveAndReturn(match, player.id);
}
