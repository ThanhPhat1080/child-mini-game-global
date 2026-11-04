import { randomId } from '@/lib/randomId';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { commitPendingMap, isPending, removeMedia } from '@/lib/media';
import { isBucketPath, pathsToDelete } from '@/lib/mediaPaths';
import { DEFAULT_R, MAX_OBJECTS, MAX_R, MIN_R, SMALL_R, checkObjects } from '@/lib/find/validate';
import type { FindObject } from '@/lib/find/types';

export type EObject = FindObject;

export type ELevel = { id: string; isNew: boolean; image: string | null; objects: EObject[]; active: boolean };

type Row = { id: string; image_path: string; objects: EObject[]; active: boolean };

export const newFindLevel = (): ELevel => ({ id: randomId(), isNew: true, image: null, objects: [], active: true });

/* Pure object operations. Each returns a new array and never changes its input. */

export function addObject(list: EObject[], x: number, y: number): EObject[] {
  if (list.length >= MAX_OBJECTS) return [...list];
  return [...list, { x, y, r: DEFAULT_R, word: '', audio_path: null }];
}

export function removeObject(list: EObject[], i: number): EObject[] {
  return list.filter((_, j) => j !== i);
}

/** Swaps an object with its neighbour (word and sound travel with the circle); out-of-range moves change nothing. */
export function moveObject(list: EObject[], i: number, dir: -1 | 1): EObject[] {
  const next = [...list];
  const to = i + dir;
  if (i < 0 || i >= list.length || to < 0 || to >= list.length) return next;
  [next[i], next[to]] = [next[to], next[i]];
  return next;
}

const patchAt = (list: EObject[], i: number, patch: Partial<EObject>): EObject[] =>
  list.map((o, j) => (j === i ? { ...o, ...patch } : o));

export const setObjectRadius = (list: EObject[], i: number, r: number): EObject[] =>
  patchAt(list, i, { r: Math.min(MAX_R, Math.max(MIN_R, r)) });

export const setObjectWord = (list: EObject[], i: number, word: string): EObject[] => patchAt(list, i, { word });

export const setObjectAudio = (list: EObject[], i: number, path: string | null): EObject[] =>
  patchAt(list, i, { audio_path: path });

export function isLevelComplete(l: ELevel): boolean {
  return !!l.image && checkObjects(l.objects) === null;
}

/** Objects whose radius is below the small threshold (hard for a young child to see). */
export const smallCount = (l: ELevel): number => l.objects.filter((o) => o.r < SMALL_R).length;

/** Bucket files a level points to: the picture and each object's sound (bundled art, links and unsaved picks are not ours to delete). */
export const levelMediaPaths = (l: ELevel): string[] =>
  [l.image, ...l.objects.map((o) => o.audio_path)].filter(isBucketPath);

/** Every level, active or not (admin view), in the order they were created. Saving writes that order as the play order. */
export async function loadFindLevels(): Promise<ELevel[]> {
  const { data, error } = await createSupabaseBrowserClient()
    .from('find_levels')
    .select('id, image_path, objects, active, sort_order')
    .order('created_at')
    .order('sort_order');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    isNew: false,
    image: r.image_path,
    objects: Array.isArray(r.objects) ? r.objects : [],
    active: r.active,
  }));
}

/**
 * Saves the levels: uploads picked files, writes the table, then frees files nothing uses any more.
 * A database failure leaves old files alone and removes this attempt's uploads.
 */
export async function saveFindLevels(saved: ELevel[], draft: ELevel[]): Promise<{ error: string | null; warning: string | null }> {
  const wanted = new Map<string, string>();
  for (const l of draft) {
    if (isPending(l.image)) wanted.set(l.image!, 'find');
    for (const o of l.objects) if (isPending(o.audio_path)) wanted.set(o.audio_path!, 'find');
  }
  let done: Map<string, string>;
  try {
    done = await commitPendingMap(wanted);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e), warning: null };
  }
  const uploaded = [...done.values()];
  const swap = (p: string | null) => (p ? done.get(p) ?? p : p);
  const final = draft.map((l) => ({
    ...l,
    image: swap(l.image),
    objects: l.objects.map((o) => ({ ...o, word: o.word.trim(), audio_path: swap(o.audio_path) })),
  }));

  const fail = async (message: string) => {
    await removeMedia(uploaded);
    return { error: message, warning: null };
  };

  const sb = createSupabaseBrowserClient();
  const keep = new Set(final.map((l) => l.id));
  const gone = saved.map((l) => l.id).filter((id) => !keep.has(id));
  if (gone.length) {
    const { error } = await sb.from('find_levels').delete().in('id', gone);
    if (error) return fail(error.message);
  }
  if (final.length) {
    const { error } = await sb.from('find_levels').upsert(
      final.map((l, i) => ({ id: l.id, image_path: l.image, objects: l.objects, active: l.active, sort_order: i })),
      { onConflict: 'id' },
    );
    if (error) return fail(error.message);
  }

  const stale = pathsToDelete(saved.flatMap(levelMediaPaths), final.flatMap(levelMediaPaths));
  const failed = await removeMedia(stale);
  return { error: null, warning: failed ? 'The levels were saved, but some old files could not be removed from storage.' : null };
}
