import { cropPixels, type Crop } from './geometry';

/** The longest side of a stored crop, in pixels. Keeps the file well under the 2 MB limit. */
export const MAX_SIDE = 1024;

/** Side of the output canvas: the crop's pixel size, capped at `max` and never below one pixel. */
export function outputSide(sizePx: number, max = MAX_SIDE): number {
  return Math.max(1, Math.min(sizePx, max));
}

/**
 * Output size of a crop of `widthPx` by `heightPx`: the longest side is capped at `max` and the shape is kept.
 * A square gives the same side as `outputSide`.
 */
export function outputSize(widthPx: number, heightPx: number, max = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(widthPx, heightPx, 1));
  return {
    width: Math.max(1, Math.round(widthPx * scale)),
    height: Math.max(1, Math.round(heightPx * scale)),
  };
}

/**
 * Draws the chosen crop of a picture and returns it as a WebP file. EXIF rotation is applied first. The crop keeps its
 * shape `aspect` (width / height; 1 is a square, A24). A transparent area of a PNG or WebP stays transparent (A32).
 */
export async function cropToAspect(file: File, crop: Crop, aspect = 1): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Could not read this picture');
  }
  const { x, y, size } = cropPixels(crop, bitmap.width, bitmap.height);
  // A square uses the same side for both, as it always has; another shape takes its own height.
  const heightPx = aspect === 1 ? size : Math.round(crop.h * bitmap.height);
  const out = aspect === 1 ? { width: outputSide(size), height: outputSide(size) } : outputSize(size, heightPx);
  const canvas = document.createElement('canvas');
  canvas.width = out.width;
  canvas.height = out.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not read this picture');
  ctx.drawImage(bitmap, x, y, size, heightPx, 0, 0, out.width, out.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8));
  if (!blob) throw new Error('Could not save this picture');
  const base = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${base}-${aspect === 1 ? 'square' : 'cropped'}.webp`, { type: 'image/webp' });
}

/** Draws the chosen square of a picture and returns it as a WebP file (A24). */
export function cropToSquare(file: File, crop: Crop): Promise<File> {
  return cropToAspect(file, crop, 1);
}
