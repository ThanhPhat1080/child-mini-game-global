import { slotAt } from './geometry';
import type { Pt, PuzzlePicture, Side } from './types';

export const LEVEL_SIZE = 4;

export const pieceId = (pictureId: string, side: Side): string => `${pictureId}:${side}`;

export function parsePieceId(id: string): { pictureId: string; side: Side } {
  const cut = id.lastIndexOf(':');
  return { pictureId: id.slice(0, cut), side: id.slice(cut + 1) as Side };
}

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const wordKey = (w: string) => w.trim().toLowerCase();

/**
 * H2: four pictures with different words (first row wins), or null when fewer exist.
 * With more than four, the result is never exactly the `previous` set of ids.
 */
export function drawLevel(
  pool: readonly PuzzlePicture[],
  rng: () => number,
  previous: readonly string[],
): PuzzlePicture[] | null {
  const seen = new Set<string>();
  const unique = pool.filter((p) => {
    const k = wordKey(p.word);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (unique.length < LEVEL_SIZE) return null;
  const mixed = shuffle(unique, rng);
  const drawn = mixed.slice(0, LEVEL_SIZE);
  const prev = new Set(previous);
  const same = previous.length === LEVEL_SIZE && drawn.every((p) => prev.has(p.id));
  if (same && unique.length > LEVEL_SIZE) {
    const rest = mixed.slice(LEVEL_SIZE);
    drawn[Math.floor(rng() * LEVEL_SIZE)] = rest[Math.floor(rng() * rest.length)];
  }
  return drawn;
}

/** The 8 half ids of a level, shuffled. */
export function dealPieces(pictures: readonly PuzzlePicture[], rng: () => number): string[] {
  return shuffle(
    pictures.flatMap((p) => [pieceId(p.id, 'L'), pieceId(p.id, 'R')]),
    rng,
  );
}

export function isPair(a: string, b: string): boolean {
  const x = parsePieceId(a);
  const y = parsePieceId(b);
  return x.pictureId === y.pictureId && x.side !== y.side;
}

/** The order with `id` moved to `index`; the others keep their order. */
export function moveTo(order: readonly string[], id: string, index: number): string[] {
  const rest = order.filter((x) => x !== id);
  rest.splice(index, 0, id);
  return rest;
}

export function removePair(order: readonly string[], a: string, b: string): string[] {
  return order.filter((x) => x !== a && x !== b);
}

export type DropIntent = { kind: 'join'; targetId: string } | { kind: 'room'; index: number } | { kind: 'none' };

/** What a dragged half would do at stage point `p` (H8, H9). */
export function dropIntent(order: readonly string[], up: ReadonlySet<string>, dragId: string, p: Pt): DropIntent {
  const s = slotAt(p);
  if (s < 0 || order.length === 0) return { kind: 'none' };
  const index = Math.min(s, order.length - 1);
  const target = order[index];
  if (target === dragId) return { kind: 'none' };
  if (s < order.length && up.has(target)) return { kind: 'join', targetId: target };
  return { kind: 'room', index };
}
