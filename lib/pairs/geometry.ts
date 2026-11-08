import type { Pt, Side } from './types';

// Spec section 6 (1920 x 1080 stage).
export const SLOT_W = 300;
export const SLOT_H = 354;
export const GAP_X = 45;
export const GAP_Y = 24;
export const GRID_X = 292;
export const GRID_Y = 294;
export const CARD = 336;
export const HALF = 168;
export const TAB_R = 33;
export const SHELF_SIZE = 168;
export const SHELF_GAP = 36;
export const SHELF_Y = 60;
export const COLS = 4;
export const ROWS = 2;
export const SHELF_PLACES = 4;
/** H8, H9: a dragged half whose visible centre is this close (stage px) to its face-up partner's centre joins (magnet). */
export const MAGNET_PX = 240;

const PITCH_X = SLOT_W + GAP_X;
const PITCH_Y = SLOT_H + GAP_Y;
const GRID_W = COLS * SLOT_W + (COLS - 1) * GAP_X;
const GRID_H = ROWS * SLOT_H + (ROWS - 1) * GAP_Y;

/** Top-left of slot i (row-major, 4 per row). */
export function slotXY(i: number): Pt {
  return { x: GRID_X + (i % COLS) * PITCH_X, y: GRID_Y + Math.floor(i / COLS) * PITCH_Y };
}

/** Top-left of the 336-wide whole card centered in slot i. */
export function wholeXY(i: number): Pt {
  const s = slotXY(i);
  return { x: s.x + SLOT_W / 2 - CARD / 2, y: s.y + SLOT_H / 2 - CARD / 2 };
}

/** Top-left of a half's 336-wide box so that its visible half is centered in slot i. */
export function pieceXY(side: Side, i: number): Pt {
  const w = wholeXY(i);
  return { x: w.x + (side === 'L' ? HALF / 2 : -HALF / 2), y: w.y };
}

/** The slot under a stage point; a gap belongs to the nearer slot; -1 outside the grid. */
export function slotAt(p: Pt): number {
  const rx = p.x - GRID_X;
  const ry = p.y - GRID_Y;
  if (rx < 0 || ry < 0 || rx > GRID_W || ry > GRID_H) return -1;
  const col = Math.min(COLS - 1, Math.floor((rx + GAP_X / 2) / PITCH_X));
  const row = Math.min(ROWS - 1, Math.floor((ry + GAP_Y / 2) / PITCH_Y));
  return row * COLS + col;
}

/** Top-left of shelf place k (4 places, centered on the stage). */
export function shelfXY(k: number): Pt {
  const total = SHELF_PLACES * SHELF_SIZE + (SHELF_PLACES - 1) * SHELF_GAP;
  return { x: 960 - total / 2 + k * (SHELF_SIZE + SHELF_GAP), y: SHELF_Y };
}
