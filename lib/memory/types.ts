export type MemoryCard = {
  id: string
  word: string
  image_path: string
  audio_path: string | null
  active: boolean
  group_id?: string | null
}
