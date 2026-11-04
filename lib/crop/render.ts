import { cropPixels, type Crop } from './geometry';

/** The longest side of a stored crop, in pixels. Keeps the file well under the 2 MB limit. */
export const MAX_SIDE = 1024;

/** Side of the output canvas: the crop's pixel size, capped at `max` and never below one pixel. */
export function outputSide(sizePx: number, max = MAX_SIDE): number {
  return Math.max(1, Math.min(sizePx, max));
}

/** Draws the chosen square of a picture and returns it as a WebP file. EXIF rotation is applied first. */
export async function cropToSquare(file: File, crop: Crop): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Could not read this picture');
  }
  const { x, y, size } = cropPixels(crop, bitmap.width, bitmap.height);
  const out = outputSide(size);
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not read this picture');
  ctx.drawImage(bitmap, x, y, size, size, 0, 0, out, out);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8));
  if (!blob) throw new Error('Could not save this picture');
  const base = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${base}-square.webp`, { type: 'image/webp' });
}
