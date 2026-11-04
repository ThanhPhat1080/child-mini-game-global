import type { MemoryCard } from '@/lib/memory/types'
import { usableGroups } from '@/lib/sort/groups'

export const ITEMS_PER_BASKET = 3

export type Basket = { groupId: string; example: MemoryCard }
export type SortItem = { id: string; card: MemoryCard; basket: 0 | 1 }
export type SortRound = { baskets: [Basket, Basket]; items: SortItem[] }

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const norm = (w: string) => w.trim().toLowerCase()

/**
 * Two random usable groups, 4 cards from each (1 example in the basket, 3 to sort), all 8 with
 * different words. Null when fewer than 2 usable groups can be paired.
 */
export function buildSortRound(
  cards: readonly MemoryCard[],
  rng: () => number = Math.random,
): SortRound | null {
  const groups = shuffle(usableGroups(cards), rng)
  const need = ITEMS_PER_BASKET + 1
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const [ga, gb] = [groups[i], groups[j]]
      // Prefer cards of A whose words do not occur in B, so B keeps enough choices.
      const inB = new Set(gb.cards.map((c) => norm(c.word)))
      const a = shuffle(ga.cards, rng)
      const pickA = [...a.filter((c) => !inB.has(norm(c.word))), ...a.filter((c) => inB.has(norm(c.word)))].slice(0, need)
      const used = new Set(pickA.map((c) => norm(c.word)))
      const pickB = shuffle(gb.cards, rng).filter((c) => !used.has(norm(c.word))).slice(0, need)
      if (pickB.length < need) continue

      const sides = shuffle(
        [
          { groupId: ga.id, picked: pickA },
          { groupId: gb.id, picked: pickB },
        ],
        rng,
      )
      const baskets = sides.map((s) => ({ groupId: s.groupId, example: s.picked[0] })) as [Basket, Basket]
      const items = shuffle(
        sides.flatMap((s, side) =>
          s.picked.slice(1).map((card) => ({ id: card.id, card, basket: side as 0 | 1 })),
        ),
        rng,
      )
      return { baskets, items }
    }
  }
  return null
}
