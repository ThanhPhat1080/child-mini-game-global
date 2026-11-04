import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { MemoryCard } from '@/lib/memory/types'

/** Active cards with their group_id (Sort It only; other games keep fetchActiveCards). Throws Error(message) on failure. */
export async function fetchSortCards(): Promise<MemoryCard[]> {
  const { data, error } = await createSupabaseBrowserClient()
    .from('memory_cards')
    .select('id, word, image_path, audio_path, active, group_id')
    .eq('active', true)
    .order('created_at')
  if (error) throw new Error(error.message)
  return (data ?? []) as MemoryCard[]
}
