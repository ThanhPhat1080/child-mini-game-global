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
