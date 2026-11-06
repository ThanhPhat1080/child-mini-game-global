import { describe, expect, it } from 'vitest';
import { LINES, emptyBoard, place, roundState, turnOf, type Board } from '@/lib/caro/rules';

// X1-X5: 3x3 board, three in a row wins, X starts, occupied cells and finished rounds do nothing.

/** Builds a board from a 9-character string: 'X', 'O' or '.' per cell (row by row). */
const board = (s: string): Board => [...s].map((c) => (c === 'X' ? 'X' : c === 'O' ? 'O' : null));

describe('caro rules (X1-X5)', () => {
  it('has the eight lines of a 3x3 board', () => {
    expect(LINES).toHaveLength(8);
    expect(new Set(LINES.map((l) => l.join(','))).size).toBe(8);
  });

  it('X starts, then the players alternate by the number of marks', () => {
    expect(turnOf(emptyBoard())).toBe('X');
    expect(turnOf(board('X........'))).toBe('O');
    expect(turnOf(board('XO.......'))).toBe('X');
  });

  it('places a mark on an empty cell and hands the turn over', () => {
    const b = place(emptyBoard(), 4);
    expect(b).not.toBeNull();
    expect(b![4]).toBe('X');
    expect(turnOf(b!)).toBe('O');
  });

  it('ignores a press on an occupied cell and a cell outside the board', () => {
    const b = board('X........');
    expect(place(b, 0)).toBeNull();
    expect(place(b, -1)).toBeNull();
    expect(place(b, 9)).toBeNull();
  });

  it('detects a win on every line, with the winning cells', () => {
    for (const line of LINES) {
      const cells = emptyBoard();
      for (const i of line) cells[i] = 'O';
      const state = roundState(cells);
      expect(state.status).toBe('won');
      expect(state.winner).toBe('O');
      expect([...state.line!].sort((a, b) => a - b)).toEqual([...line].sort((a, b) => a - b));
    }
  });

  it('a full board with no line is a draw', () => {
    // X O X / X O O / O X X : no line of three.
    const b = board('XOXXOOOXX');
    expect(roundState(b)).toEqual({ status: 'draw', winner: null, line: null });
  });

  it('an unfinished board is still playing', () => {
    expect(roundState(board('XO.......'))).toEqual({ status: 'playing', winner: null, line: null });
  });

  it('no move is possible once the round is won or drawn', () => {
    const won = board('XXX.OO...');
    expect(place(won, 5)).toBeNull();
    const drawn = board('XOXXOOOXX');
    expect(place(drawn, 0)).toBeNull();
  });
});
