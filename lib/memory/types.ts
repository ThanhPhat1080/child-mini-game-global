export type MemoryCard = {
  id: string
  word: string
  image_path: string
  audio_path: string | null
  active: boolean
  group_id?: string | null
  /** Set by the owner column when the card was made by the signed-in parent (play screens only). */
  owner_id?: string | null
  /** True for the signed-in parent's own card: used before global cards (FG5). */
  family?: boolean
}
