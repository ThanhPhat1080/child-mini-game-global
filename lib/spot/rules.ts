export type SpotState = { total: number; found: readonly number[] }

export function startSpot(total: number): SpotState {
  return { total, found: [] }
}

export function markFound(s: SpotState, index: number): SpotState {
  if (!Number.isInteger(index) || index < 0 || index >= s.total) return s
  if (s.found.includes(index)) return s
  return { ...s, found: [...s.found, index] }
}

export function isWon(s: SpotState): boolean {
  return s.total > 0 && s.found.length >= s.total
}
