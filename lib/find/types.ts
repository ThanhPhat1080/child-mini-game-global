/** Centre and radius of an object, as fractions of the picture (r is a fraction of the width). */
export type FindObject = {
  x: number
  y: number
  r: number
  word: string
  audio_path: string | null
}

export type FindLevel = {
  id: string
  image_path: string
  objects: FindObject[]
  active: boolean
  sort_order: number
}
