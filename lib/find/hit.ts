import type { FindObject } from './types'
import { MIN_HIT_R } from './validate'

/**
 * True when the point is on the object. aspect = picture width / height;
 * distances are measured in picture-width units.
 */
export function hitCurrent(obj: FindObject, point: { x: number; y: number }, aspect: number): boolean {
  const inside = (v: number) => Number.isFinite(v) && v > 0 && v < 1
  if (!inside(point.x) || !inside(point.y)) return false
  const dx = point.x - obj.x
  const dy = (point.y - obj.y) / aspect
  const dist = Math.hypot(dx, dy)
  return dist <= Math.max(obj.r, MIN_HIT_R)
}
