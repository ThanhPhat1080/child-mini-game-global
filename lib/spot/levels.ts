import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { SpotLevel } from '@/lib/spot/types';

const COLUMNS = 'id, image_a_path, image_b_path, differences, active, sort_order';

/** Active levels only, in play order (`sort_order`, then `created_at`). Throws Error(message) when Supabase fails. */
export async function fetchActiveLevels(): Promise<SpotLevel[]> {
  const { data, error } = await createSupabaseBrowserClient()
    .from('spot_levels')
    .select(COLUMNS)
    .eq('active', true)
    .order('sort_order')
    .order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []) as SpotLevel[];
}

/**
 * One level by id. Deliberately no `active` filter: RLS already hides drafts from anon, and a signed-in
 * admin can preview them (A16). Null when there is no such row or the request fails.
 */
export async function fetchLevel(id: string): Promise<SpotLevel | null> {
  const { data, error } = await createSupabaseBrowserClient()
    .from('spot_levels')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return data as SpotLevel;
}
