/**
 * A crop over a picture: a square by default, or a rectangle of another shape (e.g. the celebration frame, A32).
 * x, y, w, h are fractions of the picture's width and height.
 * `ratio` is the picture's width divided by its height when the crop was made.
 * The crop has the shape `aspect` (width / height in pixels) when (w * W) / (h * H) === aspect; a square is aspect 1.
 */
export type Crop = { x: number; y: number; w: number; h: number; ratio: number };

/** The smallest side is this fraction of the picture's shorter side. */
export const MIN_SIDE_FRACTION = 0.1;

const RATIO_TOLERANCE = 0.02;

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/** The largest centered crop of shape `aspect` (width / height) that fits the picture. A square by default. */
export function defaultCrop(W: number, H: number, aspect = 1): Crop {
  // Whichever side of the picture is the limit: the crop takes all of it and the other side follows the shape.
  const wide = W / H > aspect;
  const w = wide ? (H * aspect) / W : 1;
  const h = wide ? 1 : W / aspect / H;
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h, ratio: W / H };
}

/** Whole-pixel position and side of the crop. `size` is the width in pixels. */
export function cropPixels(c: Crop, W: number, H: number): { x: number; y: number; size: number } {
  return { x: Math.round(c.x * W), y: Math.round(c.y * H), size: Math.round(c.w * W) };
}

/** Shifts the crop by a pixel delta and keeps it inside the picture. */
export function moveCrop(c: Crop, dxPx: number, dyPx: number, W: number, H: number): Crop {
  return {
    ...c,
    x: clamp(c.x + dxPx / W, 0, 1 - c.w),
    y: clamp(c.y + dyPx / H, 0, 1 - c.h),
  };
}

/**
 * Changes the crop's width by a pixel delta, anchored at the top-left, and keeps its shape (`aspect`) and inside the picture.
 * A square (aspect 1) keeps its side; any other shape keeps its height in step with the width.
 */
export function resizeCrop(c: Crop, deltaPx: number, W: number, H: number, aspect = 1): Crop {
  const minPx = Math.round(MIN_SIDE_FRACTION * Math.min(W, H));
  // The shorter of the two sides is never below minPx.
  const minWidth = minPx * Math.min(1, aspect);
  const maxWidth = Math.min(W - c.x * W, (H - c.y * H) * aspect);
  const px = clamp(c.w * W + deltaPx, minWidth, maxWidth);
  return { ...c, w: px / W, h: px / aspect / H };
}

/**
 * The crop to start from: `start` when its picture ratio is within 2% of this picture's and its shape is `aspect`,
 * otherwise the default crop of that shape.
 */
export function startCropFor(start: Crop | undefined, W: number, H: number, aspect = 1): Crop {
  const ratio = W / H;
  const sameRatio = !!start && Math.abs(start.ratio - ratio) / Math.max(start.ratio, ratio) <= RATIO_TOLERANCE;
  const shape = start ? (start.w / start.h) * start.ratio : 0;
  const sameShape = Math.abs(shape - aspect) / aspect <= RATIO_TOLERANCE;
  if (start && sameRatio && sameShape) return start;
  return defaultCrop(W, H, aspect);
}
