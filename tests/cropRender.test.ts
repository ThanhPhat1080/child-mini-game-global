import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultCrop } from '@/lib/crop/geometry';
import { MAX_SIDE, cropToSquare, outputSide } from '@/lib/crop/render';

const bitmap = { width: 1200, height: 800, close: vi.fn() };
const ctx = { drawImage: vi.fn() };

beforeEach(() => {
  vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback) {
    cb(new Blob(['webp-bytes'], { type: 'image/webp' }));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  ctx.drawImage.mockReset();
  bitmap.close.mockReset();
});

describe('outputSide', () => {
  it('caps a large square at the maximum side', () => {
    expect(outputSide(1500)).toBe(1024);
    expect(MAX_SIDE).toBe(1024);
  });

  it('does not upscale a small square', () => {
    expect(outputSide(30)).toBe(30);
  });

  it('is at least one pixel', () => {
    expect(outputSide(0)).toBe(1);
  });
});

describe('cropToSquare', () => {
  it('decodes the file with its EXIF orientation applied', async () => {
    await cropToSquare(new File(['x'], 'photo.jpg', { type: 'image/jpeg' }), defaultCrop(1200, 800));
    expect(createImageBitmap).toHaveBeenCalledWith(expect.any(File), { imageOrientation: 'from-image' });
  });

  it('draws the chosen square from the picture onto a canvas of the same size', async () => {
    await cropToSquare(new File(['x'], 'photo.jpg', { type: 'image/jpeg' }), defaultCrop(1200, 800));
    expect(ctx.drawImage).toHaveBeenCalledWith(bitmap, 200, 0, 800, 800, 0, 0, 800, 800);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it('returns a WebP file named after the original', async () => {
    const out = await cropToSquare(new File(['x'], 'photo.jpg', { type: 'image/jpeg' }), defaultCrop(1200, 800));
    expect(out.name).toBe('photo-square.webp');
    expect(out.type).toBe('image/webp');
  });

  it('rejects with a clear message when the file cannot be decoded', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('decode failed'); }));
    await expect(
      cropToSquare(new File(['x'], 'broken.png', { type: 'image/png' }), defaultCrop(1200, 800)),
    ).rejects.toThrow('Could not read this picture');
  });
});

describe('cropToSquare quality', () => {
  it('encodes WebP at quality 0.8 so a cropped picture stays well under 2 MB', async () => {
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb: BlobCallback) {
      cb(new Blob(['x'], { type: 'image/webp' }));
    });
    await cropToSquare(new File(['x'], 'photo.jpg', { type: 'image/jpeg' }), defaultCrop(1200, 800));
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/webp', 0.8);
  });
});

// A32: a 3:5 frame is saved as a 3:5 picture, so it fills the celebration frame.
describe('cropToAspect (A32)', () => {
  it('saves a 3:5 crop as a 3:5 WebP, with transparency kept (no fill)', async () => {
    const { cropToAspect, outputSize } = await import('@/lib/crop/render');
    const { defaultCrop: dc } = await import('@/lib/crop/geometry');
    const crop = dc(1200, 800, 340 / 600);
    const out = await cropToAspect(new File(['x'], 'kid.png', { type: 'image/png' }), crop, 340 / 600);
    expect(out.name).toBe('kid-cropped.webp');
    expect(out.type).toBe('image/webp');
    // drawImage(bitmap, x, y, sw, sh, dx, dy, dw, dh): the source is the 3:5 crop, scaled so the longest side is at most 1024.
    const [, , , sw, sh, , , dw, dh] = ctx.drawImage.mock.calls[0] as number[];
    expect(sw / sh).toBeCloseTo(340 / 600, 1);
    expect(dw / dh).toBeCloseTo(340 / 600, 1);
    expect(Math.max(dw, dh)).toBeLessThanOrEqual(1024);
    expect(outputSize(680, 1200)).toEqual({ width: 580, height: 1024 });
  });

  it('cropToSquare still saves a square with the same name as before', async () => {
    const { cropToSquare } = await import('@/lib/crop/render');
    const { defaultCrop: dc } = await import('@/lib/crop/geometry');
    const out = await cropToSquare(new File(['x'], 'kid.png', { type: 'image/png' }), dc(1200, 800));
    expect(out.name).toBe('kid-square.webp');
  });
});
