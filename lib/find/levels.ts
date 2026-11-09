import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { dropOwnCopies, familyOrGlobal, ownerFirst, playerId } from '@/lib/review';
import type { FindLevel } from '@/lib/find/types';
import { isPlayable } from '@/lib/find/validate';

const COLUMNS = 'id, image_path, objects, active, sort_order';
const LIST_COLUMNS = `${COLUMNS}, owner_id, source_id`;

/**
 * Active levels only, in play order (`sort_order`, then `created_at`). Rows that are not playable
 * (bad object list, blank word, missing picture) are dropped. Throws Error(message) when Supabase fails.
 */
export async function fetchActiveFindLevels(): Promise<FindLevel[]> {
  const me = await playerId();
  const { data, error } = await familyOrGlobal(
    createSupabaseBrowserClient().from('find_levels').select(LIST_COLUMNS).eq('active', true),
    me,
  )
    .order('sort_order')
    .order('created_at');
  if (error) throw new Error(error.message);
  return ownerFirst(dropOwnCopies(((data ?? []) as (FindLevel & { owner_id?: string | null })[]).filter(isPlayable), me), me).map(({ owner_id, ...l }) => ({ ...l, mine: !!me && owner_id === me }));
}

/**
 * One level by id. Deliberately no `active` filter: RLS already hides drafts from anon, and a signed-in
 * admin can preview them. Null when there is no such row, the request fails, or the row is not playable.
 */
export async function fetchFindLevel(id: string): Promise<FindLevel | null> {
  const { data, error } = await createSupabaseBrowserClient()
    .from('find_levels')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  const level = data as FindLevel;
  return isPlayable(level) ? level : null;
}
