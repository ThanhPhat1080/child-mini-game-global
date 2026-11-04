import { describe, expect, it } from 'vitest'
import { aspectsClose, checkDifferences } from '@/lib/spot/validate'

const d = (i = 0) => ({ x: 0.1 + i * 0.05, y: 0.5, r: 0.06 })
const list = (n: number) => Array.from({ length: n }, (_, i) => d(i))

describe('checkDifferences', () => {
  it('accepts 3 and 10 valid items', () => {
    expect(checkDifferences(list(3))).toBeNull()
    expect(checkDifferences(list(10))).toBeNull()
  })
  it('rejects too few, too many and non-arrays', () => {
    expect(checkDifferences(list(2))).toEqual(expect.any(String))
    expect(checkDifferences(list(11))).toEqual(expect.any(String))
    expect(checkDifferences('x')).toEqual(expect.any(String))
    expect(checkDifferences(null)).toEqual(expect.any(String))
  })
  it('rejects out-of-range values', () => {
    for (const bad of [{ x: -0.1 }, { x: 1.1 }, { y: -0.1 }, { y: 1.1 }, { r: 0.03 }, { r: 0.13 }]) {
      const l = list(3)
      l[1] = { ...l[1], ...bad }
      expect(checkDifferences(l)).toEqual(expect.any(String))
    }
  })
  it('rejects missing fields and string numbers', () => {
    expect(checkDifferences([d(0), d(1), { x: 0.5, y: 0.5 }])).toEqual(expect.any(String))
    expect(checkDifferences([d(0), d(1), { x: '0.5', y: 0.5, r: 0.06 }])).toEqual(expect.any(String))
    expect(checkDifferences([d(0), d(1), null])).toEqual(expect.any(String))
  })
})

describe('aspectsClose', () => {
  it('allows up to 2% difference', () => {
    expect(aspectsClose(1.333, 1.35)).toBe(true)
    expect(aspectsClose(1.333, 1.5)).toBe(false)
  })
})
