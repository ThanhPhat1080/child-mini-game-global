/** Centre and radius of a difference, as fractions of the picture (r is a fraction of the width). */
export type Difference = { x: number; y: number; r: number }

export type SpotLevel = {
  id: string
  image_a_path: string
  image_b_path: string
  differences: Difference[]
  active: boolean
  sort_order: number
}
