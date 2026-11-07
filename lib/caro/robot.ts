/**
 * The robot opponent for Caro X O (X13): medium difficulty. Pure functions, no DOM.
 *
 * Medium means: the robot always takes a win it can see, and always blocks a four (four of the child's marks
 * in a row with the fifth cell open). Otherwise it scores every empty cell by the lines through it and picks one
 * of the three best at random, so it builds and blocks sometimes, but it does not play perfectly.
 */
import { CELLS, COLS, ROWS, WIN, windows, type Board, type Player } from './rules';

const LINES = windows();
/** The rows, columns and diagonals through each cell (built once). */
const LINES_BY_CELL: (readonly number[])[][] = Array.from({ length: CELLS }, () => []);
for (const line of LINES) for (const i of line) LINES_BY_CELL[i].push(line);

/** The middle of the board: the robot's first mark when nobody has played yet. */
const CENTRE = Math.floor(ROWS / 2) * COLS + Math.floor(COLS / 2);
/** Score of a line that has no enemy mark, by how many of the robot's marks it would hold after this move. */
const OWN = [0, 1, 8, 64, 512, 100000];
/** Score of a line that has no robot mark, by how many of the enemy's marks the move would block. */
const ENEMY = [0, 1, 6, 48, 400, 100000];
/** How many of the best cells the robot chooses between. */
const PICK_FROM = 3;

/**
 * The cell the robot (`me`) marks next, or null when the board is full. `rng` returns a number in [0, 1); tests pass
 * a fixed one.
 */
export function robotMove(board: Board, me: Player, rng: () => number = Math.random): number | null {
  const them: Player = me === 'X' ? 'O' : 'X';
  const empty: number[] = [];
  for (let i = 0; i < CELLS; i++) if (board[i] === null) empty.push(i);
  if (empty.length === 0) return null;
  if (empty.length === CELLS) return CENTRE;

  const scored: { cell: number; score: number }[] = [];
  let winCell: number | null = null;
  let blockCell: number | null = null;
  for (const cell of empty) {
    let score = 0;
    for (const line of LINES_BY_CELL[cell]) {
      let mine = 0;
      let theirs = 0;
      for (const i of line) {
        if (board[i] === me) mine++;
        else if (board[i] === them) theirs++;
      }
      if (theirs === 0) {
        score += OWN[mine + 1];
        if (mine === WIN - 1 && winCell === null) winCell = cell;
      } else if (mine === 0) {
        score += ENEMY[theirs];
        if (theirs === WIN - 1 && blockCell === null) blockCell = cell;
      }
    }
    scored.push({ cell, score });
  }

  if (winCell !== null) return winCell;
  if (blockCell !== null) return blockCell;

  // Shuffle first so that cells with the same score come out in a random order, then take one of the best few.
  for (let i = scored.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [scored[i], scored[j]] = [scored[j], scored[i]];
  }
  scored.sort((a, b) => b.score - a.score);
  const best = scored.slice(0, PICK_FROM);
  return best[Math.floor(rng() * best.length)].cell;
}
