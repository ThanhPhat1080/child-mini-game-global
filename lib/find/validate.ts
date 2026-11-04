import type { FindLevel } from './types'

export const MIN_OBJECTS = 2
export const MAX_OBJECTS = 12
export const MAX_WORD = 40
export const DEFAULT_R = 0.06
export const MIN_R = 0.03
export const MAX_R = 0.15
/** Objects with a radius below this are flagged in the editor as hard for a young child to see. */
export const SMALL_R = 0.04
export const MIN_HIT_R = 0.04

function inRange(v: unknown, min: number, max: number): boolean {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
}

/** Error message, or null when the list is valid. */
export function checkObjects(list: unknown): string | null {
  if (!Array.isArray(list)) return 'objects must be a list'
  if (list.length < MIN_OBJECTS) return `at least ${MIN_OBJECTS} objects are needed`
  if (list.length > MAX_OBJECTS) return `at most ${MAX_OBJECTS} objects are allowed`
  for (let i = 0; i < list.length; i++) {
    const o = list[i] as Record<string, unknown> | null
    const n = i + 1
    if (typeof o !== 'object' || o === null) return `object ${n} is not valid`
    if (!inRange(o.x, 0, 1)) return `object ${n}: x must be between 0 and 1`
    if (!inRange(o.y, 0, 1)) return `object ${n}: y must be between 0 and 1`
    if (!inRange(o.r, MIN_R, MAX_R)) return `object ${n}: r must be between ${MIN_R} and ${MAX_R}`
    if (typeof o.word !== 'string') return `object ${n}: word must be text`
    const word = o.word.trim()
    if (word.length < 1) return `object ${n}: word is empty`
    if (word.length > MAX_WORD) return `object ${n}: word must be at most ${MAX_WORD} characters`
    if (o.audio_path !== null && typeof o.audio_path !== 'string') {
      return `object ${n}: audio_path must be text or empty`
    }
  }
  return null
}

/** A level can be shown to the child: it has a picture and valid objects. */
export function isPlayable(level: FindLevel): boolean {
  return typeof level.image_path === 'string' && level.image_path.length > 0 && checkObjects(level.objects) === null
}
