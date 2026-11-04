import { describe, expect, it } from 'vitest'
import type { MemoryCard } from '@/lib/memory/types'
import { buildRounds, ROUND_SIZE } from '@/lib/listen/rounds'

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeCards(n: number, active = true): MemoryCard[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${active ? 'c' : 'x'}${i}`,
    word: `w${i}`,
    image_path: `img/${i}.png`,
    audio_path: null,
    active,
  }))
}

const norm = (w: string) => w.trim().toLowerCase()

describe('buildRounds', () => {
  it('ROUND_SIZE is 10', () => {
    expect(ROUND_SIZE).toBe(10)
  })

  it('31 cards give 10 well-formed questions', () => {
    const qs = buildRounds(makeCards(31), mulberry32(1))!
    expect(qs).toHaveLength(10)
    expect(new Set(qs.map((q) => q.answer.id)).size).toBe(10)
    for (const q of qs) {
      expect(new Set(q.options.map((o) => o.id)).size).toBe(3)
      expect(new Set(q.options.map((o) => norm(o.word))).size).toBe(3)
      expect(q.options[q.answerIndex]).toBe(q.answer)
      q.options.forEach((o, i) => {
        if (i !== q.answerIndex) expect(o.id).not.toBe(q.answer.id)
      })
    }
  })

  it('7 active cards give 7 questions', () => {
    expect(buildRounds(makeCards(7), mulberry32(2))).toHaveLength(7)
  })

  it('exactly 3 cards give 3 questions using all three cards', () => {
    const qs = buildRounds(makeCards(3), mulberry32(3))!
    expect(qs).toHaveLength(3)
    for (const q of qs) expect(new Set(q.options.map((o) => o.id))).toEqual(new Set(['c0', 'c1', 'c2']))
  })

  it('returns null for 0 and 2 cards', () => {
    expect(buildRounds([], mulberry32(1))).toBeNull()
    expect(buildRounds(makeCards(2), mulberry32(1))).toBeNull()
  })

  it('returns null for 5 cards sharing only 2 distinct words', () => {
    const cards = makeCards(5).map((c, i) => ({ ...c, word: i % 2 ? 'Cat' : ' dog ' }))
    expect(buildRounds(cards, mulberry32(1))).toBeNull()
  })

  it('ignores inactive cards', () => {
    expect(buildRounds([...makeCards(2), ...makeCards(10, false)], mulberry32(1))).toBeNull()
    const qs = buildRounds([...makeCards(4), ...makeCards(10, false)], mulberry32(1))!
    expect(qs).toHaveLength(4)
    for (const q of qs) for (const o of q.options) expect(o.active).toBe(true)
  })

  it('treats words equal after trim+lowercase as one word, keeping the first', () => {
    const cards = makeCards(4)
    cards[0] = { ...cards[0], word: 'Apple' }
    cards[1] = { ...cards[1], word: ' apple ' }
    const qs = buildRounds(cards, mulberry32(4))!
    expect(qs).toHaveLength(3)
    for (const q of qs) {
      const ids = q.options.map((o) => o.id)
      expect(ids).not.toContain('c1')
      expect(new Set(q.options.map((o) => norm(o.word))).size).toBe(3)
    }
    expect(qs.map((q) => q.answer.id)).not.toContain('c1')
  })

  it('answerIndex takes every position over many seeds', () => {
    const seen = new Set<number>()
    const cards = makeCards(31)
    for (let s = 0; s < 200; s++) {
      for (const q of buildRounds(cards, mulberry32(s))!) seen.add(q.answerIndex)
    }
    expect(seen).toEqual(new Set([0, 1, 2]))
  })

  it('does not mutate input', () => {
    const cards = makeCards(12)
    const ids = cards.map((c) => c.id)
    buildRounds(cards, mulberry32(5))
    expect(cards.map((c) => c.id)).toEqual(ids)
  })

  it('max limits the number of questions', () => {
    expect(buildRounds(makeCards(31), mulberry32(6), 4)).toHaveLength(4)
  })
})
