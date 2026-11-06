/** Caro X O rules (X1-X5): a 3x3 board, X starts, three in a row wins. Pure functions, no DOM. */

export type Player = 'X' | 'O';
/** Index = row * 3 + column. */
export type Board = (Player | null)[];
export type RoundStatus = 'playing' | 'won' | 'draw';
export type RoundState = { status: RoundStatus; winner: Player | null; line: readonly number[] | null };

/** The eight lines: three rows, three columns, two diagonals. */
export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export const emptyBoard = (): Board => Array<Player | null>(9).fill(null);

/** Whose turn it is: X starts, so X plays when both sides have the same number of marks. */
export function turnOf(board: Board): Player {
  const x = board.filter((c) => c === 'X').length;
  const o = board.filter((c) => c === 'O').length;
  return x === o ? 'X' : 'O';
}

/** Won, drawn or still playing; a win names the winner and the three cells of the line. */
export function roundState(board: Board): RoundState {
  for (const line of LINES) {
    const [a, b, c] = line;
    const mark = board[a];
    if (mark && board[b] === mark && board[c] === mark) {
      return { status: 'won', winner: mark, line };
    }
  }
  return board.every((cell) => cell !== null)
    ? { status: 'draw', winner: null, line: null }
    : { status: 'playing', winner: null, line: null };
}

/** The board after the player whose turn it is marks cell `index`; null when the cell is taken, off the board or the round is over. */
export function place(board: Board, index: number): Board | null {
  if (!Number.isInteger(index) || index < 0 || index > 8) return null;
  if (board[index] !== null) return null;
  if (roundState(board).status !== 'playing') return null;
  const next = board.slice();
  next[index] = turnOf(board);
  return next;
}
