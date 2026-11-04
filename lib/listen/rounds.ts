import type { MemoryCard } from '@/lib/memory/types'

export const ROUND_SIZE = 10

export type Question = {
  answer: MemoryCard
  options: [MemoryCard, MemoryCard, MemoryCard]
  answerIndex: 0 | 1 | 2
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function buildRounds(
  cards: readonly MemoryCard[],
  rng: () => number = Math.random,
  max: number = ROUND_SIZE,
): Question[] | null {
  const seen = new Set<string>()
  const pool: MemoryCard[] = []
  for (const c of cards) {
    if (!c.active) continue
    const key = c.word.trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    pool.push(c)
  }
  if (pool.length < 3) return null

  const answers = shuffle(pool, rng).slice(0, Math.min(max, pool.length))
  return answers.map((answer) => {
    const others = shuffle(
      pool.filter((c) => c.id !== answer.id),
      rng,
    ).slice(0, 2)
    const answerIndex = Math.min(2, Math.floor(rng() * 3)) as 0 | 1 | 2
    const options = [...others]
    options.splice(answerIndex, 0, answer)
    return { answer, options: options as Question['options'], answerIndex }
  })
}
