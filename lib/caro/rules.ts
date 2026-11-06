/** Caro X O rules (X1-X5): a 20x20 board, X starts, five in a row wins. Pure functions, no DOM. */

export type Player = 'X' | 'O';
/** Index = row * COLS + column. */
export type Board = (Player | null)[];
export type RoundStatus = 'playing' | 'won' | 'draw';
export type RoundState = { status: RoundStatus; winner: Player | null; line: readonly number[] | null };

/** Columns and rows of the board. */
export const COLS = 20;
export const ROWS = 20;
/** How many in a row win. */
export const WIN = 5;
export const CELLS = COLS * ROWS;

/**
 * Every run of WIN cells that can win: rows, columns and both diagonals. Each run is a list of cell indices.
 */
export function windows(): readonly (readonly number[])[] {
  const out: number[][] = [];
  const dirs: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of dirs) {
        const endR = r + dr * (WIN - 1);
        const endC = c + dc * (WIN - 1);
        if (endR < 0 || endR >= ROWS || endC < 0 || endC >= COLS) continue;
        out.push(Array.from({ length: WIN }, (_, k) => (r + dr * k) * COLS + (c + dc * k)));
      }
    }
  }
  return out;
}

const WINDOWS = windows();

export const emptyBoard = (): Board => Array<Player | null>(CELLS).fill(null);

/** Whose turn it is: X starts, so X plays when both sides have the same number of marks. */
export function turnOf(board: Board): Player {
  const x = board.filter((c) => c === 'X').length;
  const o = board.filter((c) => c === 'O').length;
  return x === o ? 'X' : 'O';
}

/** Won, drawn or still playing; a win names the winner and the cells of the winning run. */
export function roundState(board: Board): RoundState {
  for (const line of WINDOWS) {
    const mark = board[line[0]];
    if (mark && line.every((i) => board[i] === mark)) {
      return { status: 'won', winner: mark, line };
    }
  }
  return board.every((cell) => cell !== null)
    ? { status: 'draw', winner: null, line: null }
    : { status: 'playing', winner: null, line: null };
}

/** The board after the player whose turn it is marks cell `index`; null when the cell is taken, off the board or the round is over. */
export function place(board: Board, index: number): Board | null {
  if (!Number.isInteger(index) || index < 0 || index >= CELLS) return null;
  if (board[index] !== null) return null;
  if (roundState(board).status !== 'playing') return null;
  const next = board.slice();
  next[index] = turnOf(board);
  return next;
}
