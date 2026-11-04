import type { DeckTile } from './deck'

export const MISMATCH_MS = 1200
export const WIN_DELAY_MS = 1000
export const FLIP_MS = 500

export type GameState = {
  tiles: DeckTile[]
  /** indexes of face-up unmatched tiles */
  up: number[]
  /** matched card ids */
  matched: ReadonlySet<string>
  /** face-down -> face-up flips only */
  flips: number
  /** a mismatch is waiting for resolveMismatch */
  pending: boolean
}

export type GameEvent =
  | { type: 'flipped'; index: number }
  | { type: 'matched'; cardId: string; indexes: [number, number] }
  | { type: 'mismatch'; indexes: [number, number] }
  | { type: 'replay'; cardId: string }
  | { type: 'won'; flips: number }
  | { type: 'ignored' }

type Result = { state: GameState; events: GameEvent[] }

export function startGame(tiles: DeckTile[]): GameState {
  return { tiles, up: [], matched: new Set(), flips: 0, pending: false }
}

export function flip(s: GameState, index: number): Result {
  const ignored: Result = { state: s, events: [{ type: 'ignored' }] }
  if (s.pending) return ignored
  if (!Number.isInteger(index) || index < 0 || index >= s.tiles.length) return ignored
  const tile = s.tiles[index]
  if (s.matched.has(tile.card.id)) {
    return { state: s, events: [{ type: 'replay', cardId: tile.card.id }] }
  }
  if (s.up.includes(index)) return ignored

  const flips = s.flips + 1
  if (s.up.length === 0) {
    return {
      state: { ...s, up: [index], flips },
      events: [{ type: 'flipped', index }],
    }
  }

  const first = s.up[0]
  const indexes: [number, number] = [first, index]
  const events: GameEvent[] = [{ type: 'flipped', index }]
  if (s.tiles[first].card.id === tile.card.id) {
    const matched = new Set(s.matched).add(tile.card.id)
    events.push({ type: 'matched', cardId: tile.card.id, indexes })
    if (matched.size * 2 === s.tiles.length) events.push({ type: 'won', flips })
    return { state: { ...s, up: [], matched, flips }, events }
  }
  events.push({ type: 'mismatch', indexes })
  return { state: { ...s, up: [first, index], flips, pending: true }, events }
}

export function resolveMismatch(s: GameState): Result {
  if (!s.pending) return { state: s, events: [] }
  return { state: { ...s, up: [], pending: false }, events: [] }
}
