import { describe, expect, it } from 'vitest';
import { CELLS, COLS, emptyBoard, place, roundState, turnOf, type Board, type Player } from '@/lib/caro/rules';
import { robotMove } from '@/lib/caro/robot';

// X13-X16: the robot (medium) takes a win it can see, blocks a four, and otherwise picks one of the best few cells.

const CENTRE = 10 * COLS + 15;
const fixed = (v: number) => () => v;

/** A board with the given marks: `{ cell: player }`. */
function boardWith(marks: Record<number, Player>): Board {
  const b = emptyBoard();
  for (const [cell, p] of Object.entries(marks)) b[Number(cell)] = p;
  return b;
}

/** A tiny seeded random source, so a game is the same every run. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('robotMove (medium)', () => {
  it('marks the centre when nobody has played yet', () => {
    expect(robotMove(emptyBoard(), 'O', fixed(0.5))).toBe(CENTRE);
  });

  it('returns null on a full board', () => {
    expect(robotMove(Array<Player>(CELLS).fill('X'), 'O')).toBeNull();
  });

  it('takes its own win when it has four in a row with the fifth cell open', () => {
    // O has four on row 0 (cells 0-3); cell 4 completes five. X has two marks far away.
    const b = boardWith({ 0: 'O', 1: 'O', 2: 'O', 3: 'O', 200: 'X', 201: 'X' });
    expect(robotMove(b, 'O', fixed(0.99))).toBe(4);
  });

  it('blocks the child when the child has four in a row with the fifth cell open', () => {
    // X has four on row 0; O has a stray mark. Cell 4 is the only block.
    const b = boardWith({ 0: 'X', 1: 'X', 2: 'X', 3: 'X', 100: 'O' });
    expect(robotMove(b, 'O', fixed(0.99))).toBe(4);
  });

  it('takes its own win before it blocks the child', () => {
    // O has four in a row on cells 10-13: cell 9 or 14 wins. X threatens to win at 4 (cells 0-3).
    const b = boardWith({ 10: 'O', 11: 'O', 12: 'O', 13: 'O', 0: 'X', 1: 'X', 2: 'X', 3: 'X' });
    const cell = robotMove(b, 'O', fixed(0.99))!;
    const after = b.slice();
    after[cell] = 'O';
    expect(roundState(after)).toMatchObject({ status: 'won', winner: 'O' });
  });

  it('never picks a taken cell', () => {
    let b = emptyBoard();
    const rng = seeded(7);
    for (let k = 0; k < 30 && roundState(b).status === 'playing'; k++) {
      const me = turnOf(b);
      const cell = robotMove(b, me, rng);
      expect(cell).not.toBeNull();
      expect(b[cell!]).toBeNull();
      b = place(b, cell!)!;
    }
  });

  it('plays a whole round against a fixed mover without an illegal move, and the round ends', () => {
    const rng = seeded(42);
    let b = emptyBoard();
    let moves = 0;
    while (roundState(b).status === 'playing') {
      const me = turnOf(b);
      // The child's side picks a random empty cell; the robot picks with robotMove.
      let cell: number | null;
      if (me === 'O') {
        cell = robotMove(b, 'O', rng);
      } else {
        const empty = b.flatMap((c, i) => (c === null ? [i] : []));
        cell = empty[Math.floor(rng() * empty.length)];
      }
      expect(cell).not.toBeUndefined();
      b = place(b, cell!)!;
      moves++;
      expect(moves).toBeLessThanOrEqual(CELLS);
    }
    expect(['won', 'draw']).toContain(roundState(b).status);
  });
});
