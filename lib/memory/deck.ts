import type { MemoryCard } from './types'

export const LEVELS = [12, 16, 20, 24, 30] as const
export type Level = (typeof LEVELS)[number]

export function pairsOf(level: Level): number {
  return level / 2
}

export function levelsAvailable(activeCount: number): Record<Level, boolean> {
  return Object.fromEntries(LEVELS.map((l) => [l, activeCount >= pairsOf(l)])) as Record<Level, boolean>
}

export type DeckTile = { key: string; card: MemoryCard }

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function drawDeck(
  cards: readonly MemoryCard[],
  level: Level,
  rng: () => number = Math.random,
): DeckTile[] {
  const active = cards.filter((c) => c.active)
  const pairs = pairsOf(level)
  if (active.length < pairs) throw new Error('not enough cards')
  const chosen = shuffle(active, rng).slice(0, pairs)
  const tiles = chosen.flatMap((card) => [
    { key: `${card.id}:0`, card },
    { key: `${card.id}:1`, card },
  ])
  return shuffle(tiles, rng)
}

export function parseLevel(v: string): Level | null {
  return LEVELS.find((l) => String(l) === v) ?? null
}
