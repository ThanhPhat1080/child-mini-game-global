import { describe, expect, it } from 'vitest';
import {
  SHELF_SIZE, SLOT_H, SLOT_W, pieceXY, shelfXY, slotAt, slotXY, wholeXY,
} from '@/lib/pairs/geometry';

// Spec section 6: slots 300 x 354, gaps 45/24, grid origin (292, 294); shelf 168 at y 60, 36 apart.
describe('pairs geometry', () => {
  it('places slots on the 2 x 4 grid', () => {
    expect(slotXY(0)).toEqual({ x: 292, y: 294 });
    expect(slotXY(5)).toEqual({ x: 292 + 345, y: 294 + 378 });
    expect(slotXY(3)).toEqual({ x: 292 + 3 * 345, y: 294 });
  });

  it('slotAt finds every slot from its center and -1 outside', () => {
    for (let i = 0; i < 8; i++) {
      const s = slotXY(i);
      expect(slotAt({ x: s.x + SLOT_W / 2, y: s.y + SLOT_H / 2 })).toBe(i);
    }
    expect(slotAt({ x: 100, y: 400 })).toBe(-1);
    expect(slotAt({ x: 900, y: 100 })).toBe(-1);
    expect(slotAt({ x: 1800, y: 400 })).toBe(-1);
  });

  it('a gap belongs to the nearer slot', () => {
    const s0 = slotXY(0);
    expect(slotAt({ x: s0.x + SLOT_W + 10, y: s0.y + 10 })).toBe(0);
    expect(slotAt({ x: s0.x + SLOT_W + 35, y: s0.y + 10 })).toBe(1);
    expect(slotAt({ x: s0.x + 10, y: s0.y + SLOT_H + 20 })).toBe(4);
  });

  it('centers the visible half and the whole card in the slot', () => {
    for (let i = 0; i < 8; i++) {
      expect(pieceXY('L', i).x + 84).toBe(slotXY(i).x + 150);
      expect(pieceXY('R', i).x + 168 + 84).toBe(slotXY(i).x + 150);
      expect(wholeXY(i).x + 168).toBe(slotXY(i).x + 150);
      expect(pieceXY('L', i).y + 168).toBe(slotXY(i).y + 177);
      expect(wholeXY(i).y).toBe(pieceXY('R', i).y);
    }
  });

  it('centers the shelf on the stage', () => {
    expect((shelfXY(0).x + shelfXY(3).x + SHELF_SIZE) / 2).toBe(960);
    expect(shelfXY(0).x).toBe(570);
    expect(shelfXY(1).x - shelfXY(0).x).toBe(168 + 36);
    expect(shelfXY(2).y).toBe(60);
  });
});
