export const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'] as const;

export type Difficulty = (typeof DIFFICULTY_LEVELS)[number];
export type Board = number[][];
export type Cell = { row: number; col: number };

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function createEmptyBoard(): Board {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

export function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function isPlacementValid(board: Board, row: number, col: number, value: number): boolean {
  for (let i = 0; i < 9; i += 1) {
    if (i !== col && board[row][i] === value) return false;
    if (i !== row && board[i][col] === value) return false;
  }

  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r += 1) {
    for (let c = boxCol; c < boxCol + 3; c += 1) {
      if ((r !== row || c !== col) && board[r][c] === value) return false;
    }
  }

  return true;
}

export function generateSolvedBoard(): Board {
  const board = createEmptyBoard();

  function fillBoard() {
    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        if (board[row][col] !== 0) continue;
        const candidates = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        for (const value of candidates) {
          if (!isPlacementValid(board, row, col, value)) continue;
          board[row][col] = value;
          if (fillBoard()) return true;
          board[row][col] = 0;
        }
        return false;
      }
    }
    return true;
  }

  fillBoard();
  return board;
}

export function generatePuzzle(level: Difficulty = 'easy'): { puzzle: Board; solution: Board } {
  const solution = generateSolvedBoard();
  const puzzle = cloneBoard(solution);
  const targetBlanks = { easy: 36, medium: 45, hard: 54 }[level];
  const positions = shuffle(Array.from({ length: 81 }, (_, index) => index));

  for (let index = 0; index < targetBlanks && index < positions.length; index += 1) {
    const position = positions[index];
    const row = Math.floor(position / 9);
    const col = position % 9;
    puzzle[row][col] = 0;
  }

  return { puzzle, solution };
}

export function getConflictCells(board: Board, puzzle: Board = createEmptyBoard()): Set<string> {
  const conflictKeys = new Set<string>();
  const mergedBoard = board.map((row, rowIndex) => row.map((value, colIndex) => {
    if (value !== 0) return value;
    return puzzle[rowIndex]?.[colIndex] ?? 0;
  }));

  for (let row = 0; row < 9; row += 1) {
    const seen = new Map();
    for (let col = 0; col < 9; col += 1) {
      const value = mergedBoard[row][col];
      if (!value) continue;
      if (!seen.has(value)) {
        seen.set(value, { row, col });
      } else {
        const first = seen.get(value);
        conflictKeys.add(`${first.row}-${first.col}`);
        conflictKeys.add(`${row}-${col}`);
      }
    }
  }

  for (let col = 0; col < 9; col += 1) {
    const seen = new Map();
    for (let row = 0; row < 9; row += 1) {
      const value = mergedBoard[row][col];
      if (!value) continue;
      if (!seen.has(value)) {
        seen.set(value, { row, col });
      } else {
        const first = seen.get(value);
        conflictKeys.add(`${first.row}-${first.col}`);
        conflictKeys.add(`${row}-${col}`);
      }
    }
  }

  for (let boxRow = 0; boxRow < 9; boxRow += 3) {
    for (let boxCol = 0; boxCol < 9; boxCol += 3) {
      const seen = new Map();
      for (let row = boxRow; row < boxRow + 3; row += 1) {
        for (let col = boxCol; col < boxCol + 3; col += 1) {
          const value = mergedBoard[row][col];
          if (!value) continue;
          if (!seen.has(value)) {
            seen.set(value, { row, col });
          } else {
            const first = seen.get(value);
            conflictKeys.add(`${first.row}-${first.col}`);
            conflictKeys.add(`${row}-${col}`);
          }
        }
      }
    }
  }

  return conflictKeys;
}

export function isBoardSolved(board: Board, solution: Board): boolean {
  if (!Array.isArray(board) || board.length !== 9) return false;

  for (let row = 0; row < 9; row += 1) {
    if (!Array.isArray(board[row]) || board[row].length !== 9) return false;
    for (let col = 0; col < 9; col += 1) {
      if (board[row][col] !== solution[row][col]) return false;
    }
  }

  return true;
}

export function isBoardComplete(board: Board, puzzle: Board): boolean {
  return board.every((row, rowIndex) =>
    row.every((value, colIndex) => puzzle[rowIndex][colIndex] !== 0 || value !== 0),
  );
}

export function boardHasAnyProgress(board: Board): boolean {
  return board.some((row) => row.some((value) => value !== 0));
}

export function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
