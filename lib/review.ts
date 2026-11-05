'use client';

import { useCallback, useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/** The tables a parent can share (spec V2). questions/answers follow their set. */
export type ContentTable = 'quiz_sets' | 'memory_cards' | 'spot_levels' | 'card_groups' | 'find_levels';
export type Visibility = 'private' | 'pending' | 'global';
/** "mine" = the family's own content (private and under review), "global" = approved content for everyone. */
export type Scope = 'mine' | 'global';

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

/** An editor is read-only unless the row is the user's own and still private (V1, V2, V3). */
export const isLocked = (visibility: Visibility | undefined, ownerId: string | null | undefined, me: string | null): boolean =>
  visibility !== undefined && (visibility !== 'private' || (ownerId ?? null) !== me);

const KEY = 'childPlayer:scope';

/** The remembered scope of the parent admin tabs. A convenience only: storage may be blocked, then it is "mine". */
export function getStoredScope(): Scope {
  try {
    return localStorage.getItem(KEY) === 'global' ? 'global' : 'mine';
  } catch {
    return 'mine';
  }
}

export function useContentScope(): { scope: Scope; setScope: (s: Scope) => void } {
  const [scope, setState] = useState<Scope>('mine');
  useEffect(() => { setState(getStoredScope()); }, []);
  const setScope = useCallback((s: Scope) => {
    setState(s);
    try { localStorage.setItem(KEY, s); } catch { /* storage blocked */ }
  }, []);
  return { scope, setScope };
}

/** The signed-in parent's id for the play screens, or null when there is no session or it cannot be read. */
export async function playerId(): Promise<string | null> {
  try { return await getMyUserId(); } catch { return null; }
}

/**
 * FG2: a child's list shows the signed-in parent's own rows (any visibility) and global rows, nothing else.
 * RLS alone is not enough: a Super Admin can read every family's rows. Call it before `.order()`.
 */
export function familyOrGlobal<Q>(query: Q, me: string | null): Q {
  if (!me) return query;
  return (query as unknown as { or(filter: string): unknown }).or(`owner_id.eq.${me},visibility.eq.global`) as Q;
}

/** FG4: the family's rows first, then the rest; each part keeps its order. */
export function ownerFirst<T extends object>(rows: T[], me: string | null): T[] {
  if (!me) return rows;
  const mine = (r: T) => (r as { owner_id?: string | null }).owner_id === me;
  return [...rows.filter(mine), ...rows.filter((r) => !mine(r))];
}
