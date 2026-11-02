import { describe, it, expect } from 'vitest';
import { createEmptyBoard, generatePuzzle, getConflictCells, isBoardComplete, isBoardSolved } from '../src/lib/game';

describe('Sudoku helpers', () => {
  it('creates a puzzle and matching solution for a valid board', () => {
    const { puzzle, solution } = generatePuzzle('easy');
    expect(puzzle).toHaveLength(9);
    expect(solution).toHaveLength(9);
    expect(puzzle.flat().filter(Boolean).length).toBeLessThan(81);
    expect(puzzle.flat().every((value) => value === 0 || (value >= 1 && value <= 9))).toBe(true);
  });

  it('detects row, column, and box conflicts', () => {
    const board = [
      [5, 3, 0, 0, 7, 0, 0, 0, 0],
      [6, 0, 0, 1, 9, 5, 0, 0, 0],
      [0, 9, 8, 0, 0, 0, 0, 6, 0],
      [8, 0, 0, 0, 6, 0, 0, 0, 3],
      [4, 0, 0, 8, 0, 3, 0, 0, 1],
      [7, 0, 0, 0, 2, 0, 0, 0, 6],
      [0, 6, 0, 0, 0, 0, 2, 8, 0],
      [0, 0, 0, 4, 1, 9, 0, 0, 5],
      [0, 0, 0, 0, 8, 0, 0, 7, 9],
    ];
    board[0][0] = 5;
    board[0][1] = 5;
    const conflicts = getConflictCells(board);
    expect(conflicts.has('0-0')).toBe(true);
    expect(conflicts.has('0-1')).toBe(true);
  });

  it('recognizes a completed correct board as solved', () => {
    const solution = [
      [5, 3, 4, 6, 7, 8, 9, 1, 2],
      [6, 7, 2, 1, 9, 5, 3, 4, 8],
      [1, 9, 8, 3, 4, 2, 5, 6, 7],
      [8, 5, 9, 7, 6, 1, 4, 2, 3],
      [4, 2, 6, 8, 5, 3, 7, 9, 1],
      [7, 1, 3, 9, 2, 4, 8, 5, 6],
      [9, 6, 1, 5, 3, 7, 2, 8, 4],
      [2, 8, 7, 4, 1, 9, 6, 3, 5],
      [3, 4, 5, 2, 8, 6, 1, 7, 9],
    ];
    expect(isBoardSolved(solution, solution)).toBe(true);

    const wrong = solution.map((row) => [...row]);
    wrong[0][0] = 1;
    expect(isBoardSolved(wrong, solution)).toBe(false);
  });

  it('flags duplicates against puzzle clues as conflicts', () => {
    const puzzle = [
      [5, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];
    const board = createEmptyBoard();
    board[0][1] = 5;

    const conflicts = getConflictCells(board, puzzle);
    expect(conflicts.has('0-1')).toBe(true);
    expect(conflicts.has('0-0')).toBe(true);
  });

  it('considers a Board complete when every editable cell has an entry', () => {
    const puzzle = [
      [5, 0, 0, 0, 0, 0, 0, 0, 0],
      ...Array.from({ length: 8 }, () => Array(9).fill(0)),
    ];
    const board = Array.from({ length: 9 }, () => Array(9).fill(1));
    board[1][0] = 0;

    expect(isBoardComplete(board, puzzle)).toBe(false);
    board[1][0] = 1;
    expect(isBoardComplete(board, puzzle)).toBe(true);
  });
});
