'use client';

import { useCallback, useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getMyProfile, type Role } from '@/lib/auth/roles';
import { isGuestPlay } from '@/lib/childSession';
import { getVisitor } from '@/lib/visitor';

/** The tables a parent can share (spec V2). questions/answers follow their set. */
export type ContentTable = 'quiz_sets' | 'memory_cards' | 'spot_levels' | 'card_groups' | 'find_levels';
export type Visibility = 'private' | 'pending' | 'global';
/**
 * Tabs of a content area. A parent has "mine" (the family's own content) and "global" (approved content).
 * A Super Admin has "mine" (their own rows, including global copies), "global" (every global row, whoever owns it,
 * editable and can be unpublished), "queue" (review) and "parents" (what parents published, view only). A stored
 * scope the role may not use falls back to "mine" (spec V8-V13).
 */
export type Scope = 'mine' | 'global' | 'queue' | 'parents';

type Client = ReturnType<typeof createSupabaseBrowserClient>;

/** V2: the owner shares a private row; it becomes `pending` until a Super Admin decides. */
export async function shareItem(table: ContentTable, id: string, client: Client = createSupabaseBrowserClient()): Promise<void> {
  const { error } = await client.rpc('share_item', { p_table: table, p_id: id });
  if (error) throw new Error(error.message);
}

/** V4: the owner of a global row asks the Super Admin to unpublish it so they can edit it. */
export async function requestEdit(table: ContentTable, id: string, note: string, client: Client = createSupabaseBrowserClient()): Promise<void> {
  const { error } = await client.rpc('request_edit', { p_table: table, p_id: id, p_note: note });
  if (error) throw new Error(error.message);
}

/** The signed-in user's id, or null. Used to tell "mine" from "someone else's global" rows. */
export async function getMyUserId(client: Client = createSupabaseBrowserClient()): Promise<string | null> {
  const { data } = await client.auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * An editor is read-only unless the row is the user's own and writable (V1, V2, V3). A Super Admin's own row is
 * never locked, including a global copy (V8). Parents keep the private-only rule.
 */
export const isLocked = (visibility: Visibility | undefined, ownerId: string | null | undefined, me: string | null, role?: Role | null): boolean => {
  if (visibility === undefined) return false;
  // A Super Admin edits their own rows and every global row (the Global tab); other private/pending rows are view only.
  if (role === 'super_admin') return visibility !== 'global' && (ownerId ?? null) !== me;
  return visibility !== 'private' || (ownerId ?? null) !== me;
};

/**
 * For rows the loaders already filtered to the signed-in user's own (`superOwned`: the user is a Super Admin):
 * locked unless the row is private, or the Super Admin owns it (their copies stay editable, V8). Panels and save filters use it.
 */
export const lockedOwn = (visibility: Visibility | undefined, superOwned?: boolean): boolean =>
  visibility !== undefined && !superOwned && visibility !== 'private';

/** The scope a role may use: a stored value outside the role's tabs becomes "mine". */
export function validScope(s: string | null | undefined, role: Role | null | undefined): Scope {
  if (role === 'super_admin') return s === 'queue' || s === 'parents' || s === 'global' ? s : 'mine';
  return s === 'global' ? 'global' : 'mine';
}

/**
 * Which rows a loader keeps. "mine": the user's own (a Super Admin also owns the platform rows with no owner, so
 * unpublishing one never loses it). "global": every global row, whoever owns it (Super Admin, Global tab).
 */
export const inScope = (r: { owner_id: string | null; visibility: Visibility }, scope: 'mine' | 'global', me: string | null, role?: Role | null): boolean =>
  scope === 'global' ? r.visibility === 'global' : r.owner_id === me || (role === 'super_admin' && r.owner_id === null);

/** The signed-in user's role, or null when signed out or the profile cannot be read. */
export async function getMyRole(client: Client = createSupabaseBrowserClient()): Promise<Role | null> {
  try {
    return (await getMyProfile(client))?.role ?? null;
  } catch {
    return null;
  }
}

/** The signed-in user's role, or null while it loads (or when signed out). */
export function useMyRole(): Role | null {
  const [role, setRole] = useState<Role | null>(null);
  useEffect(() => {
    let live = true;
    getMyProfile(createSupabaseBrowserClient()).then((p) => { if (live) setRole(p?.role ?? null); }, () => undefined);
    return () => { live = false; };
  }, []);
  return role;
}

/**
 * V9: a row that a Super Admin copied from one of the family's own rows is dropped from the family's list,
 * so the family sees the original once. Other families still see the copy.
 */
export function dropOwnCopies<T extends { id: string; owner_id?: string | null; source_id?: string | null }>(rows: T[], me: string | null): T[] {
  if (!me) return rows;
  const own = new Set(rows.filter((r) => r.owner_id === me).map((r) => r.id));
  return rows.filter((r) => !(r.owner_id !== me && r.source_id && own.has(r.source_id)));
}

/**
 * V10: the ids (among `ids`, the parent's own rows) that have a readable global copy. Drives the "Global copy"
 * badge. A badge is a convenience: a failed read gives an empty set.
 */
export async function copiedIds(table: ContentTable, ids: string[], client: Client = createSupabaseBrowserClient()): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  try {
    const { data, error } = await client.from(table).select('source_id').eq('visibility', 'global').in('source_id', ids);
    if (error) return new Set();
    return new Set(((data ?? []) as { source_id: string }[]).map((r) => r.source_id));
  } catch {
    return new Set();
  }
}

const KEY = 'childPlayer:scope';

/** The remembered scope of the parent admin tabs. A convenience only: storage may be blocked, then it is "mine". */
export function getStoredScope(role?: Role | null): Scope {
  try {
    return validScope(localStorage.getItem(KEY), role);
  } catch {
    return 'mine';
  }
}

/** The tab of a content area, remembered per browser. Set `role` once it is known; the tab follows it. */
export function useContentScope(role?: Role | null): { scope: Scope; setScope: (s: Scope) => void } {
  const [scope, setState] = useState<Scope>('mine');
  useEffect(() => { setState(getStoredScope(role)); }, [role]);
  const setScope = useCallback((s: Scope) => {
    setState(s);
    try { localStorage.setItem(KEY, s); } catch { /* storage blocked */ }
  }, []);
  return { scope, setScope };
}

/**
 * The signed-in parent's id for the play screens, or null when there is no session, it cannot be read, or the
 * device is in guest play (no child: only global content is listed).
 */
export async function playerId(): Promise<string | null> {
  // A visitor reads global rows only, like guest play (GU12). Checked before the parent's session.
  if (getVisitor() || isGuestPlay()) return null;
  try { return await getMyUserId(); } catch { return null; }
}

/**
 * FG2: a child's list shows the signed-in parent's own rows (any visibility) and global rows, nothing else.
 * With no parent id (guest play) it shows global rows only. RLS alone is not enough: a Super Admin can read every
 * family's rows. Call it before `.order()`.
 */
export function familyOrGlobal<Q>(query: Q, me: string | null): Q {
  const q = query as unknown as { or(filter: string): unknown; eq(column: string, value: string): unknown };
  return (me ? q.or(`owner_id.eq.${me},visibility.eq.global`) : q.eq('visibility', 'global')) as Q;
}

/** FG4: the family's rows first, then the rest; each part keeps its order. */
export function ownerFirst<T extends object>(rows: T[], me: string | null): T[] {
  if (!me) return rows;
  const mine = (r: T) => (r as { owner_id?: string | null }).owner_id === me;
  return [...rows.filter(mine), ...rows.filter((r) => !mine(r))];
}
