export type FindState = { total: number; index: number }

export function startFind(total: number): FindState {
  return { total, index: 0 }
}

/** Moves to the next object, never past the last one. */
export function advance(s: FindState): FindState {
  return { ...s, index: Math.min(s.index + 1, s.total) }
}

export function isDone(s: FindState): boolean {
  return s.total > 0 && s.index >= s.total
}
