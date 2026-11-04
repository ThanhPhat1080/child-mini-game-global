import type { Difference } from './types'
import { MIN_HIT_R } from './validate'

export type HitResult =
  | { kind: 'found'; index: number }
  | { kind: 'repeat'; index: number }
  | { kind: 'miss' }

/** aspect = picture width / height. Distances are measured in picture-width units. */
export function hitTest(
  differences: Difference[],
  found: ReadonlySet<number>,
  point: { x: number; y: number },
  aspect: number,
): HitResult {
  const inside = (v: number) => Number.isFinite(v) && v > 0 && v < 1
  if (!inside(point.x) || !inside(point.y)) return { kind: 'miss' }
  let bestUnfound = -1
  let bestUnfoundDist = Infinity
  let bestFound = -1
  let bestFoundDist = Infinity
  differences.forEach((d, index) => {
    const dx = point.x - d.x
    const dy = (point.y - d.y) / aspect
    const dist = Math.hypot(dx, dy)
    if (!(dist <= Math.max(d.r, MIN_HIT_R))) return
    if (found.has(index)) {
      if (dist < bestFoundDist) [bestFound, bestFoundDist] = [index, dist]
    } else if (dist < bestUnfoundDist) {
      ;[bestUnfound, bestUnfoundDist] = [index, dist]
    }
  })
  if (bestUnfound >= 0) return { kind: 'found', index: bestUnfound }
  if (bestFound >= 0) return { kind: 'repeat', index: bestFound }
  return { kind: 'miss' }
}
