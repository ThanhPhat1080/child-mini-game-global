import { describe, expect, it } from 'vitest'
import type { MemoryCard } from '@/lib/memory/types'
import { buildSortRound, ITEMS_PER_BASKET } from '@/lib/sort/rounds'

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const mk = (id: string, word: string, group_id: string | null, active = true): MemoryCard => ({
  id, word, image_path: `img/${id}.png`, audio_path: null, active, group_id,
})
const group = (g: string, n: number): MemoryCard[] => Array.from({ length: n }, (_, i) => mk(`${g}${i}`, `${g}-w${i}`, g))
// 31 seed-like cards: 6 groups of 5 plus one card without a group
const seedLike = (): MemoryCard[] => [...['a', 'b', 'c', 'd', 'e', 'f'].flatMap((g) => group(g, 5)), mk('solo', 'solo', null)]
const norm = (w: string) => w.trim().toLowerCase()

describe('buildSortRound', () => {
  it('ITEMS_PER_BASKET is 3', () => expect(ITEMS_PER_BASKET).toBe(3))

  it('31 seed-like cards give 2 baskets and 6 well-formed items', () => {
    const r = buildSortRound(seedLike(), mulberry32(1))!
    expect(r.baskets[0].groupId).not.toBe(r.baskets[1].groupId)
    expect(r.items).toHaveLength(6)
    const byGroup = new Map<string, number[]>()
    for (const it of r.items) {
      expect(it.card.group_id).toBe(r.baskets[it.basket].groupId)
      expect(it.id).toBe(it.card.id)
      byGroup.set(it.card.group_id!, [...(byGroup.get(it.card.group_id!) ?? []), it.basket])
    }
    expect(r.items.filter((i) => i.basket === 0)).toHaveLength(ITEMS_PER_BASKET)
    expect(r.items.filter((i) => i.basket === 1)).toHaveLength(ITEMS_PER_BASKET)
    for (const b of r.baskets) {
      expect(b.example.group_id).toBe(b.groupId)
      expect(r.items.some((i) => i.card.id === b.example.id)).toBe(false)
    }
  })

  it('all 8 drawn cards are different, ids unique, words different', () => {
    for (let s = 0; s < 50; s++) {
      const r = buildSortRound(seedLike(), mulberry32(s))!
      const all = [r.baskets[0].example, r.baskets[1].example, ...r.items.map((i) => i.card)]
      expect(new Set(all.map((c) => c.id)).size).toBe(8)
      expect(new Set(all.map((c) => norm(c.word))).size).toBe(8)
      expect(new Set(r.items.map((i) => i.id)).size).toBe(6)
    }
  })

  it('items are shuffled and the left group varies', () => {
    const firstBasket = new Set<number>()
    const lefts = new Set<string>()
    for (let s = 0; s < 200; s++) {
      const r = buildSortRound(seedLike(), mulberry32(s))!
      firstBasket.add(r.items[0].basket)
      lefts.add(r.baskets[0].groupId)
    }
    expect(firstBasket.size).toBe(2)
    expect(lefts.size).toBeGreaterThan(2)
  })

  it('which of two groups goes left is random', () => {
    const lefts = new Set<string>()
    for (let s = 0; s < 100; s++) lefts.add(buildSortRound([...group('a', 4), ...group('b', 4)], mulberry32(s))!.baskets[0].groupId)
    expect(lefts).toEqual(new Set(['a', 'b']))
  })

  it('does not mutate the input', () => {
    const cards = seedLike()
    const copy = structuredClone(cards)
    buildSortRound(cards, mulberry32(3))
    expect(cards).toEqual(copy)
  })

  it('exactly 2 usable groups still works', () => {
    const r = buildSortRound([...group('a', 4), ...group('b', 4), ...group('c', 3)], mulberry32(2))!
    expect(r.items).toHaveLength(6)
    expect(new Set(r.baskets.map((b) => b.groupId))).toEqual(new Set(['a', 'b']))
  })

  it('1 usable group or none gives null', () => {
    expect(buildSortRound([...group('a', 4), ...group('b', 3)])).toBeNull()
    expect(buildSortRound([])).toBeNull()
    expect(buildSortRound([...group('a', 4), ...group('b', 4).map((c) => ({ ...c, active: false }))])).toBeNull()
  })

  it('same-word cards never appear together, even across groups', () => {
    const a = ['apple', 'pear', 'plum', 'fig'].map((w, i) => mk(`a${i}`, w, 'a'))
    const b = ['Apple ', 'cat', 'dog', 'cow', 'hen'].map((w, i) => mk(`b${i}`, w, 'b'))
    for (let s = 0; s < 100; s++) {
      const r = buildSortRound([...a, ...b], mulberry32(s))!
      expect(r).not.toBeNull()
      const all = [r.baskets[0].example, r.baskets[1].example, ...r.items.map((i) => i.card)]
      expect(new Set(all.map((c) => norm(c.word))).size).toBe(8)
    }
  })

  it('returns null when overlapping words leave no valid pair', () => {
    const a = ['x1', 'x2', 'x3', 'x4'].map((w, i) => mk(`a${i}`, w, 'a'))
    const b = ['x1', 'y2', 'y3', 'y4'].map((w, i) => mk(`b${i}`, w, 'b'))
    expect(buildSortRound([...a, ...b])).toBeNull()
  })
})
