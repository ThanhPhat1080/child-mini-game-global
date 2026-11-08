import { describe, expect, it } from 'vitest';
import { cropPixels, defaultCrop, moveCrop, resizeCrop, startCropFor } from '@/lib/crop/geometry';

describe('defaultCrop', () => {
  it('centers a square the size of the shorter side on a wide picture', () => {
    const c = defaultCrop(4000, 500);
    expect(cropPixels(c, 4000, 500)).toEqual({ x: 1750, y: 0, size: 500 });
  });

  it('centers a square the size of the shorter side on a tall picture', () => {
    const c = defaultCrop(600, 900);
    expect(cropPixels(c, 600, 900)).toEqual({ x: 0, y: 150, size: 600 });
  });

  it('records the source ratio', () => {
    expect(defaultCrop(1200, 800).ratio).toBeCloseTo(1.5);
  });
});

describe('moveCrop', () => {
  it('moves the square by the pixel delta', () => {
    const c = defaultCrop(1200, 800);
    const moved = moveCrop(c, 50, 0, 1200, 800);
    expect(cropPixels(moved, 1200, 800).x).toBe(cropPixels(c, 1200, 800).x + 50);
  });

  it('clamps at the right and bottom edges', () => {
    const moved = moveCrop(defaultCrop(1200, 800), 99999, 99999, 1200, 800);
    expect(moved.x + moved.w).toBeCloseTo(1);
    expect(moved.y + moved.h).toBeCloseTo(1);
  });

  it('clamps at the left and top edges', () => {
    const moved = moveCrop(defaultCrop(1200, 800), -99999, -99999, 1200, 800);
    expect(moved.x).toBeCloseTo(0);
    expect(moved.y).toBeCloseTo(0);
  });
});

describe('resizeCrop', () => {
  it('keeps the square square on a non-square picture', () => {
    const c = resizeCrop(defaultCrop(1200, 800), -100, 1200, 800);
    expect(c.w * 1200).toBeCloseTo(c.h * 800);
    expect(cropPixels(c, 1200, 800).size).toBe(700);
  });

  it('never goes below 10% of the shorter side', () => {
    const c = resizeCrop(defaultCrop(1200, 800), -99999, 1200, 800);
    expect(cropPixels(c, 1200, 800).size).toBe(80);
  });

  it('never leaves the picture', () => {
    const c = resizeCrop(defaultCrop(1200, 800), 99999, 1200, 800);
    expect(c.x + c.w).toBeLessThanOrEqual(1 + 1e-9);
    expect(c.y + c.h).toBeLessThanOrEqual(1 + 1e-9);
    expect(cropPixels(c, 1200, 800).size).toBe(800);
  });
});

describe('startCropFor', () => {
  it('keeps the start crop when the picture ratio matches within 2%', () => {
    const start = defaultCrop(1200, 800); // ratio 1.5
    expect(startCropFor(start, 1200, 800)).toBe(start);
    expect(startCropFor(start, 1212, 800)).toBe(start); // about 1% wider
  });

  it('uses the default crop when the ratio differs by more than 2%', () => {
    const start = defaultCrop(1200, 800); // ratio 1.5
    expect(startCropFor(start, 800, 800)).toEqual(defaultCrop(800, 800));
  });

  it('uses the default crop when there is no start crop', () => {
    expect(startCropFor(undefined, 800, 600)).toEqual(defaultCrop(800, 600));
  });
});

// A32: a crop can have another shape than a square (the celebration frame is 3:5, width : height).
describe('crop shape (A32)', () => {
  const FRAME = 340 / 600;

  it('defaultCrop of a 3:5 frame is the largest centred frame of that shape', () => {
    // A landscape picture: the height is the limit, the width follows the frame.
    const wide = defaultCrop(1600, 900, FRAME);
    const px = cropPixels(wide, 1600, 900);
    expect(px.size / 900).toBeCloseTo(FRAME, 1); // width px / height px
    expect(wide.h).toBe(1);
    // A square picture: the width is the limit.
    const square = defaultCrop(800, 800, FRAME);
    // The height is the limit, and the width follows the frame.
    expect(square.h).toBe(1);
    expect(square.w).toBeCloseTo(FRAME, 5);
  });

  it('resizeCrop keeps a 3:5 frame in shape and inside the picture', () => {
    const c = defaultCrop(1600, 900, FRAME);
    const bigger = resizeCrop(c, 40, 1600, 900, FRAME);
    const w = bigger.w * 1600;
    const h = bigger.h * 900;
    expect(w / h).toBeCloseTo(FRAME, 5);
    expect(bigger.x + bigger.w).toBeLessThanOrEqual(1 + 1e-9);
    expect(bigger.y + bigger.h).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('a square resize is unchanged by the new default', () => {
    const c = defaultCrop(1200, 800);
    expect(resizeCrop(c, 30, 1200, 800)).toEqual(resizeCrop(c, 30, 1200, 800, 1));
  });

  it('startCropFor takes the start crop only when its shape matches', () => {
    const square = defaultCrop(1200, 800);
    expect(startCropFor(square, 1200, 800, FRAME)).not.toBe(square);
    expect(startCropFor(square, 1200, 800)).toBe(square);
    const frame = defaultCrop(1200, 800, FRAME);
    expect(startCropFor(frame, 1200, 800, FRAME)).toBe(frame);
  });
});
