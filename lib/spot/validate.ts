export const MIN_DIFFS = 3
export const MAX_DIFFS = 10
export const DEFAULT_R = 0.06
/** Spots with a radius below this are flagged in the editor as hard for a young child to see. */
export const SMALL_R = 0.06
export const MIN_R = 0.04
export const MAX_R = 0.12
export const MIN_HIT_R = 0.05
export const ASPECT_TOLERANCE = 0.02

function inRange(v: unknown, min: number, max: number): boolean {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
}

/** Error message, or null when the list is valid. */
export function checkDifferences(list: unknown): string | null {
  if (!Array.isArray(list)) return 'differences must be a list'
  if (list.length < MIN_DIFFS) return `at least ${MIN_DIFFS} differences are needed`
  if (list.length > MAX_DIFFS) return `at most ${MAX_DIFFS} differences are allowed`
  for (let i = 0; i < list.length; i++) {
    const d = list[i] as Record<string, unknown> | null
    if (typeof d !== 'object' || d === null) return `difference ${i + 1} is not valid`
    if (!inRange(d.x, 0, 1)) return `difference ${i + 1}: x must be between 0 and 1`
    if (!inRange(d.y, 0, 1)) return `difference ${i + 1}: y must be between 0 and 1`
    if (!inRange(d.r, MIN_R, MAX_R)) return `difference ${i + 1}: r must be between ${MIN_R} and ${MAX_R}`
  }
  return null
}

/** a and b are width/height; true when they differ by at most 2% of the larger. */
export function aspectsClose(a: number, b: number): boolean {
  const larger = Math.max(a, b)
  if (!(larger > 0)) return false
  return Math.abs(a - b) / larger <= ASPECT_TOLERANCE
}
