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

/** Distance in client pixels from `p` to the rectangle (0 when inside; left/top inclusive, right/bottom exclusive). */
function gap(p: Pt, r: Rect): number {
  const dx = Math.max(r.left - p.x, 0, p.x - (r.left + r.width) + Number.EPSILON);
  const dy = Math.max(r.top - p.y, 0, p.y - (r.top + r.height) + Number.EPSILON);
  const inside = p.x >= r.left && p.x < r.left + r.width && p.y >= r.top && p.y < r.top + r.height;
  return inside ? 0 : Math.max(Math.hypot(dx, dy), Number.MIN_VALUE);
}

/**
 * Index (0 or 1) of the basket rect (client pixels) that holds `p`, or null. A `margin` (client pixels, default 0) also
 * accepts a pointer that is a little outside a rect, so a drop that just misses the tray still lands; the nearest tray wins.
 * Left and top edges are inclusive, right and bottom exclusive. A null entry is skipped but keeps its index.
 */
export function hitBasket(p: Pt, rects: readonly (Rect | null)[], margin = 0): 0 | 1 | null {
  let best: 0 | 1 | null = null;
  let bestGap = Infinity;
  for (let i = 0; i < rects.length && i < 2; i++) {
    const r = rects[i];
    if (!r) continue;
    const g = gap(p, r);
    const ok = g === 0 || (margin > 0 && g <= margin);
    if (ok && g < bestGap) { best = i as 0 | 1; bestGap = g; }
  }
  return best;
}

/** True when the pointer travelled farther than TAP_SLOP_PX (straight-line distance) from `from` to `to`. */
export function moved(from: Pt, to: Pt): boolean {
  return Math.hypot(to.x - from.x, to.y - from.y) > TAP_SLOP_PX;
}
