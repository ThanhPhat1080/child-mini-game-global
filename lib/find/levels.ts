import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { FindLevel } from '@/lib/find/types';
import { isPlayable } from '@/lib/find/validate';

const COLUMNS = 'id, image_path, objects, active, sort_order';

/**
 * Active levels only, in play order (`sort_order`, then `created_at`). Rows that are not playable
 * (bad object list, blank word, missing picture) are dropped. Throws Error(message) when Supabase fails.
 */
export async function fetchActiveFindLevels(): Promise<FindLevel[]> {
  const { data, error } = await createSupabaseBrowserClient()
    .from('find_levels')
    .select(COLUMNS)
    .eq('active', true)
    .order('sort_order')
    .order('created_at');
  if (error) throw new Error(error.message);
  return ((data ?? []) as FindLevel[]).filter(isPlayable);
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
