/** Pure drag helpers for Sort It: client-pixel math for a stage that is scaled to the window (see components/Stage.tsx). */

/** Width of the design stage in stage pixels. */
export const STAGE_W = 1920;

export type Pt = { x: number; y: number };
export type Rect = { left: number; top: number; width: number; height: number };

/** Distance in client pixels a pointer may travel and still count as a tap, not a drag. */
export const TAP_SLOP_PX = 8;

/** Scale of the stage on screen: its rendered width over STAGE_W. Returns 1 when the width is not a positive finite number. */
export function stageScale(rectWidth: number): number {
  return Number.isFinite(rectWidth) && rectWidth > 0 ? rectWidth / STAGE_W : 1;
}

/** Pointer movement from `from` to `to` (client pixels) as stage pixels, by dividing by the stage `scale`. */
export function dragDelta(from: Pt, to: Pt, scale: number): Pt {
  return { x: (to.x - from.x) / scale, y: (to.y - from.y) / scale };
}

/**
 * Index (0 or 1) of the first basket rect (client pixels) that contains `p`, or null.
 * Left and top edges are inclusive, right and bottom exclusive. A null entry is skipped but keeps its index.
 */
export function hitBasket(p: Pt, rects: readonly (Rect | null)[]): 0 | 1 | null {
  for (let i = 0; i < rects.length && i < 2; i++) {
    const r = rects[i];
    if (r && p.x >= r.left && p.x < r.left + r.width && p.y >= r.top && p.y < r.top + r.height) return i as 0 | 1;
  }
  return null;
}

/** True when the pointer travelled farther than TAP_SLOP_PX (straight-line distance) from `from` to `to`. */
export function moved(from: Pt, to: Pt): boolean {
  return Math.hypot(to.x - from.x, to.y - from.y) > TAP_SLOP_PX;
}
