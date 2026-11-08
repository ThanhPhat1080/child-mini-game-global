import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { dropOwnCopies, familyOrGlobal, ownerFirst, playerId } from '@/lib/review';
import type { MemoryCard } from '@/lib/memory/types'

/** Active cards with their group_id (Sort It only; other games keep fetchActiveCards). Throws Error(message) on failure. */
export async function fetchSortCards(): Promise<MemoryCard[]> {
  const me = await playerId()
  const { data, error } = await familyOrGlobal(
    createSupabaseBrowserClient().from('memory_cards').select('id, word, image_path, audio_path, active, group_id, owner_id, source_id').eq('active', true),
    me,
  ).order('created_at')
  if (error) throw new Error(error.message)
  return ownerFirst(dropOwnCopies((data ?? []) as MemoryCard[], me), me)
}
