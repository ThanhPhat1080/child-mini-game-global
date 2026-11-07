import { randomId } from '@/lib/randomId';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { commitPendingMap, isPending, removeMedia } from '@/lib/media';
import { isBucketPath, pathsToDelete } from '@/lib/mediaPaths';
import { checkDifferences } from '@/lib/spot/validate';
import type { Difference } from '@/lib/spot/types';
import { copiedIds, getMyRole, getMyUserId, lockedOwn, type Visibility } from '@/lib/review';

export type ELevel = {
  id: string; isNew: boolean; a: string | null; b: string | null; differences: Difference[]; active: boolean; visibility?: Visibility;
  /** The signed-in user is a Super Admin and owns the row (V8): it stays editable. */
  superOwned?: boolean;
  /** A parent's row with a global copy of a Super Admin (V10): shows the "Global copy" badge. */
  copied?: boolean;
};

type Row = { id: string; image_a_path: string; image_b_path: string; differences: Difference[]; active: boolean; owner_id: string | null; visibility: Visibility };

export const newLevel = (): ELevel => ({ id: randomId(), isNew: true, a: null, b: null, differences: [], active: true });

export function isLevelComplete(l: ELevel): boolean {
  return !!l.a && !!l.b && checkDifferences(l.differences) === null;
}

/** Bucket files a level points to (bundled art, links and unsaved picks are not ours to delete). */
export const levelMediaPaths = (l: ELevel): string[] => [l.a, l.b].filter(isBucketPath);

/** The signed-in user's own levels, active or not (admin view), in the order they were created. Saving writes that order as the play order. */
export async function loadLevels(): Promise<ELevel[]> {
  const { data, error } = await createSupabaseBrowserClient()
    .from('spot_levels')
    .select('id, image_a_path, image_b_path, differences, active, sort_order, owner_id, visibility')
    .order('created_at')
    .order('sort_order');
  if (error) throw new Error(error.message);
  const [me, role] = await Promise.all([getMyUserId(), getMyRole()]);
  const mine = ((data ?? []) as Row[]).filter((r) => r.owner_id === me);
  const superOwned = role === 'super_admin';
  const copies = superOwned ? new Set<string>() : await copiedIds('spot_levels', mine.map((r) => r.id));
  return mine.map((r) => ({ id: r.id, isNew: false, a: r.image_a_path, b: r.image_b_path, differences: r.differences, active: r.active, visibility: r.visibility, superOwned, copied: copies.has(r.id) }));
}

/**
 * Saves the levels: uploads picked files, writes the table, then frees files nothing uses any more.
 * A database failure leaves old files alone and removes this attempt's uploads.
 */
export async function saveLevels(saved: ELevel[], draft: ELevel[]): Promise<{ error: string | null; warning: string | null }> {
  const wanted = new Map<string, string>();
  for (const l of draft) {
    if (isPending(l.a)) wanted.set(l.a!, 'spot');
    if (isPending(l.b)) wanted.set(l.b!, 'spot');
  }
  let done: Map<string, string>;
  try {
    done = await commitPendingMap(wanted);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e), warning: null };
  }
  const uploaded = [...done.values()];
  const swap = (p: string | null) => (p ? done.get(p) ?? p : p);
  const final = draft.map((l) => ({ ...l, a: swap(l.a), b: swap(l.b) }));

  const fail = async (message: string) => {
    await removeMedia(uploaded);
    return { error: message, warning: null };
  };

  const sb = createSupabaseBrowserClient();
  const keep = new Set(final.map((l) => l.id));
  const gone = saved.map((l) => l.id).filter((id) => !keep.has(id));
  if (gone.length) {
    const { error } = await sb.from('spot_levels').delete().in('id', gone);
    if (error) return fail(error.message);
  }
  // Rows under review or global are locked (V2, V3): they are not written here.
  const writable = final.map((l, i) => ({ l, i })).filter(({ l }) => !lockedOwn(l.visibility, l.superOwned));
  if (writable.length) {
    const { error } = await sb.from('spot_levels').upsert(
      writable.map(({ l, i }) => ({ id: l.id, image_a_path: l.a, image_b_path: l.b, differences: l.differences, active: l.active, sort_order: i })),
      { onConflict: 'id' },
    );
    if (error) return fail(error.message);
  }

  const stale = pathsToDelete(saved.flatMap(levelMediaPaths), final.flatMap(levelMediaPaths));
  const failed = await removeMedia(stale);
  return { error: null, warning: failed ? 'The levels were saved, but some old files could not be removed from storage.' : null };
}
