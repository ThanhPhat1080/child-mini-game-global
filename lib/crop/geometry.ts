/**
 * A square crop over a picture. x, y, w, h are fractions of the picture's width and height.
 * `ratio` is the picture's width divided by its height when the crop was made.
 * The crop is a square in pixels when w * W === h * H.
 */
export type Crop = { x: number; y: number; w: number; h: number; ratio: number };

/** The smallest side is this fraction of the picture's shorter side. */
export const MIN_SIDE_FRACTION = 0.1;

const RATIO_TOLERANCE = 0.02;

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/** The largest centered square that fits the picture. */
export function defaultCrop(W: number, H: number): Crop {
  const side = Math.min(W, H);
  const w = side / W;
  const h = side / H;
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h, ratio: W / H };
}

/** Whole-pixel position and side of the crop. */
export function cropPixels(c: Crop, W: number, H: number): { x: number; y: number; size: number } {
  return { x: Math.round(c.x * W), y: Math.round(c.y * H), size: Math.round(c.w * W) };
}

/** Shifts the square by a pixel delta and keeps it inside the picture. */
export function moveCrop(c: Crop, dxPx: number, dyPx: number, W: number, H: number): Crop {
  return {
    ...c,
    x: clamp(c.x + dxPx / W, 0, 1 - c.w),
    y: clamp(c.y + dyPx / H, 0, 1 - c.h),
  };
}

/** Changes the square's side by a pixel delta, anchored at the top-left, and keeps it square and inside the picture. */
export function resizeCrop(c: Crop, deltaPx: number, W: number, H: number): Crop {
  const minPx = Math.round(MIN_SIDE_FRACTION * Math.min(W, H));
  const maxPx = Math.min(W - c.x * W, H - c.y * H);
  const px = clamp(c.w * W + deltaPx, minPx, maxPx);
  return { ...c, w: px / W, h: px / H };
}

/** The crop to start from: `start` when its picture ratio is within 2% of this picture's, otherwise the default. */
export function startCropFor(start: Crop | undefined, W: number, H: number): Crop {
  const ratio = W / H;
  if (start && Math.abs(start.ratio - ratio) / Math.max(start.ratio, ratio) <= RATIO_TOLERANCE) return start;
  return defaultCrop(W, H);
}
