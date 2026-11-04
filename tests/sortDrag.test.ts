import { describe, expect, it } from 'vitest';
import { TAP_SLOP_PX, dragDelta, hitBasket, moved, stageScale, type Rect } from '@/lib/sort/drag';

describe('stageScale', () => {
  it('divides the rendered width by the 1920 stage width', () => {
    expect(stageScale(960)).toBe(0.5);
    expect(stageScale(1920)).toBe(1);
  });
  it('returns 1 for a width that is not a positive finite number', () => {
    expect(stageScale(0)).toBe(1);
    expect(stageScale(-5)).toBe(1);
    expect(stageScale(NaN)).toBe(1);
    expect(stageScale(Infinity)).toBe(1);
  });
});

describe('dragDelta', () => {
  it('converts client pixels to stage pixels', () => {
    expect(dragDelta({ x: 100, y: 100 }, { x: 150, y: 120 }, 0.5)).toEqual({ x: 100, y: 40 });
  });
  it('handles negative movement', () => {
    expect(dragDelta({ x: 100, y: 100 }, { x: 90, y: 80 }, 1)).toEqual({ x: -10, y: -20 });
  });
});

describe('hitBasket', () => {
  const a: Rect = { left: 0, top: 0, width: 100, height: 100 };
  const b: Rect = { left: 200, top: 0, width: 100, height: 100 };
  it('returns the index of the rect containing the point', () => {
    expect(hitBasket({ x: 50, y: 50 }, [a, b])).toBe(0);
    expect(hitBasket({ x: 250, y: 50 }, [a, b])).toBe(1);
  });
  it('returns null on a miss', () => {
    expect(hitBasket({ x: 150, y: 50 }, [a, b])).toBeNull();
    expect(hitBasket({ x: 50, y: 150 }, [a, b])).toBeNull();
    expect(hitBasket({ x: 50, y: 50 }, [])).toBeNull();
  });
  it('includes left and top edges, excludes right and bottom', () => {
    expect(hitBasket({ x: 0, y: 0 }, [a, b])).toBe(0);
    expect(hitBasket({ x: 100, y: 50 }, [a, b])).toBeNull();
    expect(hitBasket({ x: 50, y: 100 }, [a, b])).toBeNull();
    expect(hitBasket({ x: 99.9, y: 99.9 }, [a, b])).toBe(0);
  });
  it('skips null rects but keeps index meaning', () => {
    expect(hitBasket({ x: 250, y: 50 }, [null, b])).toBe(1);
    expect(hitBasket({ x: 50, y: 50 }, [null, b])).toBeNull();
    expect(hitBasket({ x: 50, y: 50 }, [a, null])).toBe(0);
  });
  it('returns the first of two overlapping rects', () => {
    const c: Rect = { left: 50, top: 0, width: 100, height: 100 };
    expect(hitBasket({ x: 75, y: 50 }, [a, c])).toBe(0);
    expect(hitBasket({ x: 75, y: 50 }, [c, a])).toBe(0);
    expect(hitBasket({ x: 120, y: 50 }, [a, c])).toBe(1);
  });
});

describe('moved', () => {
  it('is false at exactly TAP_SLOP_PX and true above', () => {
    expect(TAP_SLOP_PX).toBe(8);
    expect(moved({ x: 0, y: 0 }, { x: 8, y: 0 })).toBe(false);
    expect(moved({ x: 0, y: 0 }, { x: 0, y: -8 })).toBe(false);
    expect(moved({ x: 0, y: 0 }, { x: 8.01, y: 0 })).toBe(true);
  });
  it('uses the real distance, not per axis', () => {
    expect(moved({ x: 0, y: 0 }, { x: 6, y: 6 })).toBe(true);
    expect(moved({ x: 0, y: 0 }, { x: 5, y: 5 })).toBe(false);
  });
});
