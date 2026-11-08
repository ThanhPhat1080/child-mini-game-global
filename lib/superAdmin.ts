import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { ContentTable, Visibility } from '@/lib/review';
import type { Role } from '@/lib/auth/roles';
import { CHILD_COLUMNS, type Child } from '@/lib/children';
import type { Difference } from '@/lib/spot/types';

/**
 * Super Admin console data layer (N5, N9, U15, U17, V3, V5). Every write is a database function that checks
 * the caller itself; these are thin wrappers that turn Supabase errors into thrown Errors.
 */

type Client = ReturnType<typeof createSupabaseBrowserClient>;

const TABLES: ContentTable[] = ['quiz_sets', 'memory_cards', 'spot_levels', 'card_groups', 'find_levels'];

export const TABLE_LABEL: Record<ContentTable, string> = {
  quiz_sets: 'Quiz set',
  memory_cards: 'Card',
  spot_levels: 'Spot level',
  card_groups: 'Card group',
  find_levels: 'Find level',
};

async function rpc(client: Client, name: string, args: Record<string, unknown>): Promise<void> {
  const { error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
}

// ---- review (V3, V5, V8-V13) ----

/** Tells the admin nav (red dots) and the review tabs that the pending lists changed. */
export const PENDING_CHANGED = 'cp:pending-changed';
function announcePendingChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PENDING_CHANGED));
}

/**
 * V8: approve. The original goes back to private and a Super Admin global copy is created; returns the copy's id.
 */
export async function approveItem(table: ContentTable, id: string, client: Client = createSupabaseBrowserClient()): Promise<string> {
  const { data, error } = await client.rpc('review_approve', { p_table: table, p_id: id });
  announcePendingChanged();
  if (error) throw new Error(error.message);
  return String(data);
}
export async function rejectItem(table: ContentTable, id: string, note: string, client: Client = createSupabaseBrowserClient()): Promise<void> {
  try {
    await rpc(client, 'review_reject', { p_table: table, p_id: id, p_note: note });
  } finally {
    announcePendingChanged();
  }
}
export const unpublishItem = (table: ContentTable, id: string, client: Client = createSupabaseBrowserClient()) =>
  rpc(client, 'unpublish_item', { p_table: table, p_id: id });
/** V10: a Super Admin publishes their own private row, without a review. */
export const publishOwn = (table: ContentTable, id: string, client: Client = createSupabaseBrowserClient()) =>
  rpc(client, 'publish_own', { p_table: table, p_id: id });
export const deleteItem = (table: ContentTable, id: string, client: Client = createSupabaseBrowserClient()) =>
  rpc(client, 'delete_item', { p_table: table, p_id: id });

/** Waiting rows per game for the red dots (V3, V8): quiz sets; cards (cards and their groups); spot; find. */
export type PendingCounts = { sets: number; cards: number; spot: number; find: number };

export async function pendingCounts(client: Client = createSupabaseBrowserClient()): Promise<PendingCounts> {
  const count = async (table: ContentTable): Promise<number> => {
    const { count: n, error } = await client.from(table).select('id', { count: 'exact', head: true }).eq('visibility', 'pending');
    if (error) throw new Error(error.message);
    return n ?? 0;
  };
  const [sets, cardsOnly, groups, spot, find] = await Promise.all([
    count('quiz_sets'), count('memory_cards'), count('card_groups'), count('spot_levels'), count('find_levels'),
  ]);
  return { sets, cards: cardsOnly + groups, spot, find };
}

/**
 * The pending counts for a Super Admin, refreshed on mount, on `key` (the page path for the nav) and on every
 * PENDING_CHANGED. For anyone else the counts stay zero and nothing is read.
 */
export function usePendingCounts(role: Role | null | undefined, key?: string): PendingCounts {
  const [counts, setCounts] = useState<PendingCounts>({ sets: 0, cards: 0, spot: 0, find: 0 });
  useEffect(() => {
    if (role !== 'super_admin') return;
    let live = true;
    const refresh = () => { pendingCounts().then((c) => { if (live) setCounts(c); }, () => undefined); };
    refresh();
    window.addEventListener(PENDING_CHANGED, refresh);
    return () => { live = false; window.removeEventListener(PENDING_CHANGED, refresh); };
  }, [role, key]);
  return counts;
}

/** Parent accounts by id, for the "Parent published" tab (owner names and whether they are banned). */
export async function parentNames(client: Client = createSupabaseBrowserClient()): Promise<Map<string, string>> {
  const { data, error } = await client.from('profiles').select('user_id, display_name').eq('role', 'parent');
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as { user_id: string; display_name: string | null }[]).map((p) => [p.user_id, p.display_name ?? '']));
}

// ---- parents (U15, Q4) ----
export const banParent = (userId: string, code: string, note: string, client: Client = createSupabaseBrowserClient()) =>
  rpc(client, 'ban_parent', { p_user: userId, p_code: code, p_note: note || null });
export const unbanParent = (userId: string, client: Client = createSupabaseBrowserClient()) =>
  rpc(client, 'unban_parent', { p_user: userId });
export const setQuota = (userId: string, bytes: number, client: Client = createSupabaseBrowserClient()) =>
  rpc(client, 'set_quota', { p_user: userId, p_bytes: bytes });

// ---- content items ----
export type ContentItem = {
  table: ContentTable;
  id: string;
  ownerId: string | null;
  visibility: Visibility;
  title: string;
  images: string[];
  sounds: string[];
  /** Spot levels only: the marked differences, for the read-only view. */
  differences?: Difference[];
};

type Raw = Record<string, unknown>;
const str = (v: unknown): string[] => (typeof v === 'string' && v ? [v] : []);

const SELECT: Record<ContentTable, { cols: string; map: (r: Raw) => Pick<ContentItem, 'title' | 'images' | 'sounds' | 'differences'> }> = {
  quiz_sets: {
    cols: 'id, owner_id, visibility, title, cover_path, questions(prompt_image_path, prompt_audio_path, answers(image_path))',
    map: (r) => {
      const qs = (r.questions as Raw[] | null) ?? [];
      return {
        title: String(r.title ?? ''),
        images: [...str(r.cover_path), ...qs.flatMap((q) => [...str(q.prompt_image_path), ...((q.answers as Raw[] | null) ?? []).flatMap((a) => str(a.image_path))])],
        sounds: qs.flatMap((q) => str(q.prompt_audio_path)),
      };
    },
  },
  memory_cards: {
    cols: 'id, owner_id, visibility, word, image_path, audio_path',
    map: (r) => ({ title: String(r.word ?? ''), images: str(r.image_path), sounds: str(r.audio_path) }),
  },
  spot_levels: {
    cols: 'id, owner_id, visibility, image_a_path, image_b_path, differences',
    map: (r) => ({ title: 'Spot the differences', images: [...str(r.image_a_path), ...str(r.image_b_path)], sounds: [], differences: (r.differences as Difference[]) ?? [] }),
  },
  card_groups: { cols: 'id, owner_id, visibility, name', map: (r) => ({ title: String(r.name ?? ''), images: [], sounds: [] }) },
  find_levels: {
    cols: 'id, owner_id, visibility, image_path, objects',
    map: (r) => {
      const objs = Array.isArray(r.objects) ? (r.objects as Raw[]) : [];
      return { title: objs.map((o) => String(o.word ?? '')).filter(Boolean).join(', '), images: str(r.image_path), sounds: objs.flatMap((o) => str(o.audio_path)) };
    },
  },
};

/** Content of every table, optionally one visibility and/or one owner only. A Super Admin reads all rows (RLS). */
export async function listContent(
  visibility?: Visibility,
  options: { ownerId?: string; tables?: ContentTable[] } = {},
  client: Client = createSupabaseBrowserClient(),
): Promise<ContentItem[]> {
  const out: ContentItem[] = [];
  for (const table of options.tables ?? TABLES) {
    let q = client.from(table).select(SELECT[table].cols);
    if (visibility) q = q.eq('visibility', visibility);
    if (options.ownerId) q = q.eq('owner_id', options.ownerId);
    const { data, error } = await q.order('created_at');
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as unknown as Raw[]) {
      out.push({ table, id: String(r.id), ownerId: (r.owner_id as string | null) ?? null, visibility: r.visibility as Visibility, ...SELECT[table].map(r) });
    }
  }
  return out;
}
export const listPending = (client?: Client, tables?: ContentTable[]) => listContent('pending', { tables }, client);

// ---- people ----
export type PersonRow = {
  userId: string;
  role: 'parent' | 'super_admin';
  name: string;
  banned: boolean;
  banReasonCode: string | null;
  banNote: string | null;
  bannedAt: string | null;
  quotaBytes: number;
  createdAt: string;
};

type ProfileRaw = {
  user_id: string; role: PersonRow['role']; display_name: string | null; banned: boolean;
  ban_reason_code: string | null; ban_note: string | null; banned_at: string | null; quota_bytes: number | string; created_at: string;
};

export async function listPeople(role: PersonRow['role'], client: Client = createSupabaseBrowserClient()): Promise<PersonRow[]> {
  const { data, error } = await client
    .from('profiles')
    .select('user_id, role, display_name, banned, ban_reason_code, ban_note, banned_at, quota_bytes, created_at')
    .eq('role', role)
    .order('created_at');
  if (error) throw new Error(error.message);
  return ((data ?? []) as ProfileRaw[]).map((p) => ({
    userId: p.user_id, role: p.role, name: p.display_name ?? '', banned: p.banned,
    banReasonCode: p.ban_reason_code, banNote: p.ban_note, bannedAt: p.banned_at, quotaBytes: Number(p.quota_bytes), createdAt: p.created_at,
  }));
}

// ---- children (N5, K13, N15) ----
export type AdminChild = Child & { parent_name: string | null; parent_banned: boolean };

/** Every child with the parent's name and ban state. Two queries; if the parent rows fail to load the list still shows, unnamed. */
export async function listAllChildren(client: Client = createSupabaseBrowserClient()): Promise<AdminChild[]> {
  const { data, error } = await client.from('children').select(CHILD_COLUMNS).order('created_at');
  if (error) throw new Error('Could not load the children.');
  const kids = (data ?? []) as Child[];
  const ids = [...new Set(kids.map((k) => k.parent_id))];
  const parents = new Map<string, { name: string | null; banned: boolean }>();
  if (ids.length > 0) {
    const res = await client.from('profiles').select('user_id, display_name, banned').in('user_id', ids);
    if (!res.error) {
      for (const p of (res.data ?? []) as { user_id: string; display_name: string | null; banned: boolean }[]) {
        parents.set(p.user_id, { name: p.display_name, banned: !!p.banned });
      }
    }
  }
  return kids.map((k) => ({ ...k, parent_name: parents.get(k.parent_id)?.name ?? null, parent_banned: parents.get(k.parent_id)?.banned ?? false }));
}

/** Removes a child through the Super Admin delete policy. */
export async function removeChild(id: string, client: Client = createSupabaseBrowserClient()): Promise<void> {
  const { error } = await client.from('children').delete().eq('id', id);
  if (error) throw new Error('Could not remove the child.');
}

/** Bytes stored by each given owner (Q4). */
export async function storageUsedBy(ids: string[], client: Client = createSupabaseBrowserClient()): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await Promise.all(ids.map(async (id) => {
    const { data, error } = await client.rpc('storage_used', { p_owner: id });
    out[id] = error ? 0 : Number(data);
  }));
  return out;
}

export type CreatedRole = 'parent' | 'super_admin';
export type NewAccount = { role: CreatedRole; email: string; password: string; displayName: string };

const CREATE_ERRORS: Record<string, string> = {
  email_taken: 'That email is already used.',
  invalid_body: 'Check the email, a password of at least 8 characters and a name.',
  forbidden: 'Only a Super Admin can create accounts.',
  unauthenticated: 'Please sign in again.',
};

/** POST /api/users (U8). Throws an Error with a readable message. */
export async function createAccount(input: NewAccount, fetchFn: typeof fetch = fetch): Promise<string> {
  const res = await fetchFn('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  const body = (await res.json().catch(() => null)) as { error?: string; userId?: string } | null;
  if (!res.ok) throw new Error(CREATE_ERRORS[body?.error ?? ''] ?? 'Could not create the account.');
  return body?.userId ?? '';
}

/** Unresolved messages across all parents (N18): the number for the red dot on Messages. */
/** A parent as the Super Admin sees them for a reply: name, sign-in email and phone (SA1, SA2). */
export type ParentContact = { userId: string; displayName: string; email: string; phone: string | null };

/** The contact details of every parent. Only a Super Admin may read them; the database raises otherwise. */
export async function listParentContacts(client: Client = createSupabaseBrowserClient()): Promise<ParentContact[]> {
  const { data, error } = await client.rpc('super_admin_parent_contacts');
  if (error) throw new Error(error.message);
  return ((data ?? []) as { user_id: string; display_name: string | null; email: string; phone: string | null }[]).map((r) => ({
    userId: r.user_id, displayName: r.display_name ?? '', email: r.email, phone: r.phone,
  }));
}

export async function pendingMessageCount(client: Client = createSupabaseBrowserClient()): Promise<number> {
  const { count, error } = await client.from('support_messages').select('id', { count: 'exact', head: true }).is('resolved_at', null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** The parents (user ids) who have at least one unresolved message (N12). */
export async function pendingSenders(client: Client = createSupabaseBrowserClient()): Promise<Set<string>> {
  const { data, error } = await client.from('support_messages').select('from_user').is('resolved_at', null);
  if (error) throw new Error(error.message);
  return new Set(((data ?? []) as { from_user: string }[]).map((r) => r.from_user));
}

// ---- support messages (U17) ----
export type SupportMessage = { id: string; fromUser: string; body: string; createdAt: string; readAt: string | null; resolvedAt: string | null };

export async function listMessages(client: Client = createSupabaseBrowserClient()): Promise<SupportMessage[]> {
  const { data, error } = await client
    .from('support_messages')
    .select('id, from_user, body, created_at, read_at, resolved_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string; from_user: string; body: string; created_at: string; read_at: string | null; resolved_at: string | null }[]).map((m) => ({
    id: m.id, fromUser: m.from_user, body: m.body, createdAt: m.created_at, readAt: m.read_at, resolvedAt: m.resolved_at,
  }));
}

export async function markMessage(id: string, patch: { read?: boolean; resolved?: boolean }, client: Client = createSupabaseBrowserClient()): Promise<void> {
  const now = new Date().toISOString();
  const row: Record<string, string | null> = {};
  if (patch.read !== undefined) row.read_at = patch.read ? now : null;
  if (patch.resolved !== undefined) {
    row.resolved_at = patch.resolved ? now : null;
    if (patch.resolved) row.read_at = row.read_at ?? now;
  }
  const { error } = await client.from('support_messages').update(row).eq('id', id);
  if (error) throw new Error(error.message);
}
