import { describe, expect, it } from 'vitest';
import { CELLS, COLS, ROWS, WIN, emptyBoard, place, roundState, turnOf, windows, type Board } from '@/lib/caro/rules';

// X1-X5: a 20x20 board, five in a row wins, X starts, occupied cells and finished rounds do nothing.

/** A board from a string of CELLS characters: 'X', 'O' or '.' per cell, row by row. */
const board = (s: string): Board => [...s].map((c) => (c === 'X' ? 'X' : c === 'O' ? 'O' : null));
const at = (cells: number[], mark: 'X' | 'O') => {
  const b = emptyBoard();
  for (const i of cells) b[i] = mark;
  return b;
};

describe('caro rules (X1-X5)', () => {
  it('a 20x20 board where five in a row wins', () => {
    expect(COLS).toBe(20);
    expect(ROWS).toBe(20);
    expect(WIN).toBe(5);
    expect(emptyBoard()).toHaveLength(400);
    expect(CELLS).toBe(400);
  });

  it('counts every window of five: rows, columns and both diagonals', () => {
    const rows = ROWS * (COLS - (WIN - 1));
    const cols = COLS * (ROWS - (WIN - 1));
    const diagonals = 2 * (ROWS - (WIN - 1)) * (COLS - (WIN - 1));
    expect(windows()).toHaveLength(rows + cols + diagonals);
  });

  it('X starts, then the players alternate by the number of marks', () => {
    expect(turnOf(emptyBoard())).toBe('X');
    expect(turnOf(board('X' + '.'.repeat(CELLS - 1)))).toBe('O');
    expect(turnOf(board('XO' + '.'.repeat(CELLS - 2)))).toBe('X');
  });

  it('places a mark on an empty cell and hands the turn over', () => {
    const b = place(emptyBoard(), 210);
    expect(b).not.toBeNull();
    expect(b![210]).toBe('X');
    expect(turnOf(b!)).toBe('O');
  });

  it('ignores a press on an occupied cell and a cell outside the board', () => {
    const b = board('X' + '.'.repeat(CELLS - 1));
    expect(place(b, 0)).toBeNull();
    expect(place(b, -1)).toBeNull();
    expect(place(b, CELLS)).toBeNull();
  });

  it('four in a row is not a win; five in a row is, on a row, a column and both diagonals', () => {
    // Row 0, columns 0-3: four only.
    expect(roundState(at([0, 1, 2, 3], 'X')).status).toBe('playing');
    // Row 2, columns 10-14.
    expect(roundState(at([50, 51, 52, 53, 54], 'O'))).toMatchObject({ status: 'won', winner: 'O' });
    // Column 19, rows 0-4.
    expect(roundState(at([19, 39, 59, 79, 99], 'X'))).toMatchObject({ status: 'won', winner: 'X' });
    // Diagonal down-right from cell 0.
    expect(roundState(at([0, 21, 42, 63, 84], 'X'))).toMatchObject({ status: 'won', winner: 'X' });
    // Anti-diagonal from column 4 of row 0.
    expect(roundState(at([4, 23, 42, 61, 80], 'O'))).toMatchObject({ status: 'won', winner: 'O' });
  });

  it('the winning line is the five cells, and the winner is the mark that made it', () => {
    const b = board('XXXXX' + '.'.repeat(CELLS - 5));
    const state = roundState(b);
    expect(state.status).toBe('won');
    expect(state.winner).toBe('X');
    expect([...state.line!].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
  });

  it('a full board with no five in a row is a draw', () => {
    // Mark depends on the column and on half the row: runs of the same mark are at most two, so no five.
    const b: Board = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) b.push((c + Math.floor(r / 2)) % 2 ? 'X' : 'O');
    expect(roundState(b)).toEqual({ status: 'draw', winner: null, line: null });
  });

  it('an unfinished board is still playing', () => {
    expect(roundState(board('XO' + '.'.repeat(CELLS - 2)))).toEqual({ status: 'playing', winner: null, line: null });
  });

  it('no move is possible once the round is won', () => {
    const won = board('XXXXX' + 'O'.repeat(2) + '.'.repeat(CELLS - 7));
    expect(place(won, 40)).toBeNull();
  });
});
