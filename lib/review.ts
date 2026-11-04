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

/** The remembered scope. A convenience only: storage may be blocked, then it is "mine". */
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

type Narrowable = { in(c: string, v: string[]): unknown; eq(c: string, v: string): unknown };

/** Narrows a child's content query to one scope: "mine" = private and pending, "global" = approved. */
export function applyScope<Q>(query: Q, scope: Scope = getStoredScope()): Q {
  const q = query as unknown as Narrowable;
  return (scope === 'global' ? q.eq('visibility', 'global') : q.in('visibility', ['private', 'pending'])) as Q;
}
