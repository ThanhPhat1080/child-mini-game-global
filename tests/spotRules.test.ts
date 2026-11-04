import { describe, expect, it } from 'vitest'
import { isWon, markFound, startSpot } from '@/lib/spot/rules'

describe('spot rules', () => {
  it('starts not won', () => {
    expect(isWon(startSpot(3))).toBe(false)
  })
  it('is won after all three are found', () => {
    let s = startSpot(3)
    for (const i of [0, 1, 2]) s = markFound(s, i)
    expect(isWon(s)).toBe(true)
  })
  it('counts the same index once', () => {
    const s = markFound(markFound(startSpot(3), 1), 1)
    expect(s.found).toEqual([1])
    expect(isWon(s)).toBe(false)
  })
  it('ignores out-of-range indexes', () => {
    const s = startSpot(3)
    for (const i of [-1, 3, 1.5, NaN]) expect(markFound(s, i).found).toEqual([])
  })
  it('does not mutate', () => {
    const s0 = startSpot(3)
    const s1 = markFound(s0, 0)
    expect(s0.found).toEqual([])
    expect(s1).not.toBe(s0)
    expect(s1.found).toEqual([0])
    expect(s1.found).not.toBe(s0.found)
  })
})
