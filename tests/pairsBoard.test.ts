import { describe, expect, it } from 'vitest';
import {
  dealPieces, drawLevel, dropIntent, isPair, moveTo, parsePieceId, pieceId, removePair,
} from '@/lib/pairs/board';
import { SLOT_H, SLOT_W, slotXY } from '@/lib/pairs/geometry';
import type { PuzzlePicture } from '@/lib/pairs/types';

const pic = (id: string, word = id): PuzzlePicture => ({ id, word, image_path: `seed/${id}.svg`, audio_path: null });

/** Small seeded generator so every run is the same. */
function rngOf(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const center = (i: number) => ({ x: slotXY(i).x + SLOT_W / 2, y: slotXY(i).y + SLOT_H / 2 });

describe('drawLevel (H2)', () => {
  it('needs four pictures with different words', () => {
    expect(drawLevel([pic('a'), pic('b'), pic('c')], rngOf(1), [])).toBeNull();
    const dupes = [pic('a'), pic('b'), pic('c'), pic('d', 'a'), pic('e', ' B ')];
    expect(drawLevel(dupes, rngOf(1), [])).toBeNull();
  });

  it('takes all four when there are exactly four', () => {
    const got = drawLevel([pic('a'), pic('b'), pic('c'), pic('d')], rngOf(3), []);
    expect(got?.map((p) => p.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('never draws the same four twice in a row when more than four exist', () => {
    const pool = ['a', 'b', 'c', 'd', 'e', 'f'].map((x) => pic(x));
    for (let seed = 1; seed <= 50; seed++) {
      const first = drawLevel(pool, rngOf(seed), [])!.map((p) => p.id);
      const next = drawLevel(pool, rngOf(seed), first)!.map((p) => p.id);
      expect(next).toHaveLength(4);
      expect([...next].sort()).not.toEqual([...first].sort());
    }
  });

  it('never draws two pictures with the same word', () => {
    const pool = [pic('a', ' Apple '), pic('b', 'apple'), pic('c'), pic('d'), pic('e')];
    for (let seed = 1; seed <= 30; seed++) {
      const words = drawLevel(pool, rngOf(seed), [])!.map((p) => p.word.trim().toLowerCase());
      expect(new Set(words).size).toBe(4);
    }
  });
});

describe('dealPieces', () => {
  it('gives each picture a left and a right half, shuffled by the rng', () => {
    const pics = ['a', 'b', 'c', 'd'].map((x) => pic(x));
    const one = dealPieces(pics, rngOf(7));
    expect([...one].sort()).toEqual(['a:L', 'a:R', 'b:L', 'b:R', 'c:L', 'c:R', 'd:L', 'd:R']);
    const orders = new Set([1, 2, 3, 4, 5].map((s) => dealPieces(pics, rngOf(s)).join(',')));
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe('piece ids and order', () => {
  it('builds and parses ids', () => {
    expect(pieceId('p-1', 'L')).toBe('p-1:L');
    expect(parsePieceId('p-1:R')).toEqual({ pictureId: 'p-1', side: 'R' });
    expect(parsePieceId('a:b:L')).toEqual({ pictureId: 'a:b', side: 'L' });
  });

  it('isPair needs the same picture and different sides', () => {
    expect(isPair('a:L', 'a:R')).toBe(true);
    expect(isPair('a:R', 'a:L')).toBe(true);
    expect(isPair('a:L', 'b:R')).toBe(false);
    expect(isPair('a:L', 'a:L')).toBe(false);
  });

  it('moveTo and removePair keep the others in order', () => {
    expect(moveTo(['a', 'b', 'c', 'd'], 'a', 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveTo(['a', 'b', 'c', 'd'], 'd', 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(removePair(['a', 'b', 'c', 'd', 'e'], 'd', 'b')).toEqual(['a', 'c', 'e']);
  });
});

describe('dropIntent (H8, H9)', () => {
  const order = ['a:L', 'b:R', 'a:R', 'c:L', 'b:L', 'c:R'];
  const up = new Set(['a:L', 'a:R', 'b:R']);

  it('a face-up other half is a join target', () => {
    expect(dropIntent(order, up, 'a:L', center(2))).toEqual({ kind: 'join', targetId: 'a:R' });
    expect(dropIntent(order, up, 'a:L', center(1))).toEqual({ kind: 'join', targetId: 'b:R' });
  });

  it('a face-down half makes room', () => {
    expect(dropIntent(order, up, 'a:L', center(3))).toEqual({ kind: 'room', index: 3 });
  });

  it('its own slot is nothing', () => {
    expect(dropIntent(order, up, 'a:L', center(0))).toEqual({ kind: 'none' });
  });

  it('an empty slot past the end makes room at the end', () => {
    expect(dropIntent(order, up, 'a:L', center(7))).toEqual({ kind: 'room', index: order.length - 1 });
    expect(dropIntent(['x:L', 'a:L'], new Set(['a:L']), 'a:L', center(6))).toEqual({ kind: 'none' });
  });

  it('outside the grid is nothing', () => {
    expect(dropIntent(order, up, 'a:L', { x: 50, y: 50 })).toEqual({ kind: 'none' });
  });
});
