import { randomId } from '@/lib/randomId';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { commitPendingMap, isPending, removeMedia } from '@/lib/media';
import { isBucketPath, pathsToDelete } from '@/lib/mediaPaths';
import { copiedIds, getMyRole, getMyUserId, lockedOwn, type Visibility } from '@/lib/review';

export type ECard = {
  id: string; isNew: boolean; word: string; image: string | null; audio: string | null; active: boolean; groupId: string | null; visibility?: Visibility;
  /** The signed-in user is a Super Admin and owns the row (V8): it stays editable. */
  superOwned?: boolean;
  /** A parent's card with a global copy of a Super Admin (V10): shows the "Global copy" badge. */
  copied?: boolean;
};

type Row = { id: string; word: string; image_path: string | null; audio_path: string | null; active: boolean; group_id: string | null; owner_id: string | null; visibility: Visibility };

export const newCard = (): ECard => ({ id: randomId(), isNew: true, word: '', image: null, audio: null, active: true, groupId: null });

export function isCardComplete(c: ECard): boolean {
  const n = c.word.trim().length;
  return n >= 1 && n <= 40 && !!c.image;
}

/** Lower-cased trimmed words that appear on more than one card (blank words ignored). */
export function duplicateWords(cards: ECard[]): Set<string> {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const c of cards) {
    const w = c.word.trim().toLowerCase();
    if (!w) continue;
    if (seen.has(w)) dup.add(w);
    seen.add(w);
  }
  return dup;
}

/** Bucket files a card points to (bundled art, links and unsaved picks are not ours to delete). */
export const cardMediaPaths = (c: ECard): string[] => [c.image, c.audio].filter(isBucketPath);

/** The signed-in user's own cards, active or not (admin view), newest first. Other families' global cards are not editable here. */
export async function loadCards(): Promise<ECard[]> {
  const { data, error } = await createSupabaseBrowserClient()
    .from('memory_cards')
    .select('id, word, image_path, audio_path, active, group_id, owner_id, visibility')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const [me, role] = await Promise.all([getMyUserId(), getMyRole()]);
  const mine = ((data ?? []) as Row[]).filter((r) => r.owner_id === me);
  const superOwned = role === 'super_admin';
  const copies = superOwned ? new Set<string>() : await copiedIds('memory_cards', mine.map((r) => r.id));
  return mine.map((r) => ({ id: r.id, isNew: false, word: r.word, image: r.image_path, audio: r.audio_path, active: r.active, groupId: r.group_id ?? null, visibility: r.visibility, superOwned, copied: copies.has(r.id) }));
}

/**
 * Saves the pool: uploads picked files, writes the table, then frees files nothing uses any more.
 * A database failure leaves old files alone and removes this attempt's uploads.
 */
export async function saveCards(saved: ECard[], draft: ECard[]): Promise<{ error: string | null; warning: string | null }> {
  const wanted = new Map<string, string>();
  for (const c of draft) {
    if (isPending(c.image)) wanted.set(c.image!, 'cards');
    if (isPending(c.audio)) wanted.set(c.audio!, 'card-voices');
  }
  let done: Map<string, string>;
  try {
    done = await commitPendingMap(wanted);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e), warning: null };
  }
  const uploaded = [...done.values()];
  const swap = (p: string | null) => (p ? done.get(p) ?? p : p);
  const final = draft.map((c) => ({ ...c, image: swap(c.image), audio: swap(c.audio) }));

  const fail = async (message: string) => {
    await removeMedia(uploaded); // nothing references this attempt's uploads
    return { error: message, warning: null };
  };

  const sb = createSupabaseBrowserClient();
  const keep = new Set(final.map((c) => c.id));
  const gone = saved.map((c) => c.id).filter((id) => !keep.has(id));
  if (gone.length) {
    const { error } = await sb.from('memory_cards').delete().in('id', gone);
    if (error) return fail(error.message);
  }
  // Rows under review or global are locked (V2, V3): they are not written here.
  const writable = final.filter((c) => !lockedOwn(c.visibility, c.superOwned));
  if (writable.length) {
    const { error } = await sb.from('memory_cards').upsert(
      writable.map((c) => ({ id: c.id, word: c.word.trim(), image_path: c.image, audio_path: c.audio, active: c.active, group_id: c.groupId })),
      { onConflict: 'id' },
    );
    if (error) return fail(error.message);
  }

  const stale = pathsToDelete(saved.flatMap(cardMediaPaths), final.flatMap(cardMediaPaths));
  const failed = await removeMedia(stale);
  return { error: null, warning: failed ? 'The cards were saved, but some old files could not be removed from storage.' : null };
}

export type EGroup = { id: string; isNew: boolean; name: string };

export const GROUP_NAME_MAX = 40;

export const newGroup = (name: string): EGroup => ({ id: randomId(), isNew: true, name });

const normName = (n: string) => n.trim().toLowerCase();

/** Error text for a bad group name, or null. `selfId` is the group being renamed (it may keep its own name). */
export function validateGroupName(name: string, groups: readonly EGroup[], selfId?: string): string | null {
  const n = name.trim();
  if (!n) return 'Give the group a name.';
  if (n.length > GROUP_NAME_MAX) return `Keep the name to ${GROUP_NAME_MAX} characters or fewer.`;
  if (groups.some((g) => g.id !== selfId && normName(g.name) === normName(n))) return 'Another group already has this name.';
  return null;
}

/** Cards whose group is not in `groups` lose it. Returns new objects. */
export function pruneDeletedGroups(cards: ECard[], groups: EGroup[]): ECard[] {
  const ids = new Set(groups.map((g) => g.id));
  return cards.map((c) => (c.groupId && !ids.has(c.groupId) ? { ...c, groupId: null } : { ...c }));
}

/** The signed-in user's own groups, oldest first (admin only). A card keeps its group's owner. */
export async function loadGroups(): Promise<EGroup[]> {
  const { data, error } = await createSupabaseBrowserClient().from('card_groups').select('id, name, owner_id').order('created_at');
  if (error) throw new Error(error.message);
  const me = await getMyUserId();
  return ((data ?? []) as { id: string; name: string; owner_id: string | null }[]).filter((r) => r.owner_id === me).map((r) => ({ id: r.id, isNew: false, name: r.name }));
}

/** Writes new and renamed groups. Call before saveCards so cards can point to them. */
export async function saveGroups(saved: EGroup[], draft: EGroup[]): Promise<{ error: string | null }> {
  const before = new Map(saved.map((g) => [g.id, g.name]));
  const rows = draft
    .filter((g) => g.isNew || before.get(g.id) !== g.name.trim())
    .map((g) => ({ id: g.id, name: g.name.trim() }));
  if (!rows.length) return { error: null };
  const { error } = await createSupabaseBrowserClient().from('card_groups').upsert(rows, { onConflict: 'id' });
  return { error: error ? error.message : null };
}

/** Deletes groups (their cards fall back to no group in the database). Call after saveCards. */
export async function deleteGroups(ids: string[]): Promise<{ error: string | null }> {
  if (!ids.length) return { error: null };
  const { error } = await createSupabaseBrowserClient().from('card_groups').delete().in('id', ids);
  return { error: error ? error.message : null };
}
