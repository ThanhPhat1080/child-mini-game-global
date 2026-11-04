import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { ContentTable, Visibility } from '@/lib/review';

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

// ---- review (V3, V5) ----
export const approveItem = (table: ContentTable, id: string, client: Client = createSupabaseBrowserClient()) =>
  rpc(client, 'review_approve', { p_table: table, p_id: id });
export const rejectItem = (table: ContentTable, id: string, note: string, client: Client = createSupabaseBrowserClient()) =>
  rpc(client, 'review_reject', { p_table: table, p_id: id, p_note: note });
export const unpublishItem = (table: ContentTable, id: string, client: Client = createSupabaseBrowserClient()) =>
  rpc(client, 'unpublish_item', { p_table: table, p_id: id });
export const deleteItem = (table: ContentTable, id: string, client: Client = createSupabaseBrowserClient()) =>
  rpc(client, 'delete_item', { p_table: table, p_id: id });

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
};

type Raw = Record<string, unknown>;
const str = (v: unknown): string[] => (typeof v === 'string' && v ? [v] : []);

const SELECT: Record<ContentTable, { cols: string; map: (r: Raw) => Pick<ContentItem, 'title' | 'images' | 'sounds'> }> = {
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
    cols: 'id, owner_id, visibility, image_a_path, image_b_path',
    map: (r) => ({ title: 'Spot the differences', images: [...str(r.image_a_path), ...str(r.image_b_path)], sounds: [] }),
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

/** Content of every table, optionally one visibility only. A Super Admin reads all rows (RLS). */
export async function listContent(visibility?: Visibility, client: Client = createSupabaseBrowserClient()): Promise<ContentItem[]> {
  const out: ContentItem[] = [];
  for (const table of TABLES) {
    const q = client.from(table).select(SELECT[table].cols);
    const { data, error } = await (visibility ? q.eq('visibility', visibility) : q).order('created_at');
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as unknown as Raw[]) {
      out.push({ table, id: String(r.id), ownerId: (r.owner_id as string | null) ?? null, visibility: r.visibility as Visibility, ...SELECT[table].map(r) });
    }
  }
  return out;
}
export const listPending = (client?: Client) => listContent('pending', client);

// ---- people ----
export type PersonRow = {
  userId: string;
  role: 'parent' | 'child' | 'super_admin';
  parentId: string | null;
  name: string;
  banned: boolean;
  banReasonCode: string | null;
  banNote: string | null;
  bannedAt: string | null;
  quotaBytes: number;
};

type ProfileRaw = {
  user_id: string; role: PersonRow['role']; parent_id: string | null; display_name: string | null; banned: boolean;
  ban_reason_code: string | null; ban_note: string | null; banned_at: string | null; quota_bytes: number | string;
};

export async function listPeople(role: PersonRow['role'], client: Client = createSupabaseBrowserClient()): Promise<PersonRow[]> {
  const { data, error } = await client
    .from('profiles')
    .select('user_id, role, parent_id, display_name, banned, ban_reason_code, ban_note, banned_at, quota_bytes')
    .eq('role', role)
    .order('created_at');
  if (error) throw new Error(error.message);
  return ((data ?? []) as ProfileRaw[]).map((p) => ({
    userId: p.user_id, role: p.role, parentId: p.parent_id, name: p.display_name ?? '', banned: p.banned,
    banReasonCode: p.ban_reason_code, banNote: p.ban_note, bannedAt: p.banned_at, quotaBytes: Number(p.quota_bytes),
  }));
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

export type CreatedRole = 'parent' | 'child' | 'super_admin';
export type NewAccount = { role: CreatedRole; email: string; password: string; displayName: string; parentId?: string };

const CREATE_ERRORS: Record<string, string> = {
  email_taken: 'That email is already used.',
  child_limit: 'That parent already has 5 children.',
  invalid_body: 'Check the email, a password of at least 8 characters and a name.',
  invalid_parent: 'Pick a parent.',
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
