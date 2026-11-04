import { describe, expect, it } from 'vitest'
import { hitCurrent } from '@/lib/find/hit'
import type { FindObject } from '@/lib/find/types'

const obj = (over: Partial<FindObject> = {}): FindObject => ({
  x: 0.5,
  y: 0.5,
  r: 0.06,
  word: 'cat',
  audio_path: null,
  ...over,
})

describe('hitCurrent', () => {
  it('hits the centre', () => {
    expect(hitCurrent(obj(), { x: 0.5, y: 0.5 }, 4 / 3)).toBe(true)
  })
  it('misses just outside max(r, 0.04)', () => {
    expect(hitCurrent(obj({ r: 0.06 }), { x: 0.5 + 0.061, y: 0.5 }, 4 / 3)).toBe(false)
  })
  it('uses the 0.04 minimum hit radius for a small object', () => {
    expect(hitCurrent(obj({ r: 0.01 }), { x: 0.5 + 0.039, y: 0.5 }, 4 / 3)).toBe(true)
    expect(hitCurrent(obj({ r: 0.01 }), { x: 0.5 + 0.041, y: 0.5 }, 4 / 3)).toBe(false)
  })
  it('respects the aspect ratio for vertical offsets', () => {
    // aspect 2: 0.03 of the height is 0.015 in width units, inside 0.04
    expect(hitCurrent(obj({ r: 0.03 }), { x: 0.5, y: 0.53 }, 2)).toBe(true)
  })
  it('misses a horizontal offset of 0.05 with a 0.04 hit radius', () => {
    expect(hitCurrent(obj({ r: 0.03 }), { x: 0.55, y: 0.5 }, 2)).toBe(false)
  })
  it('misses points outside the unit square', () => {
    expect(hitCurrent(obj({ x: 0.99, y: 0.5 }), { x: 1.01, y: 0.5 }, 4 / 3)).toBe(false)
    expect(hitCurrent(obj({ x: 0.01, y: 0.5 }), { x: -0.01, y: 0.5 }, 4 / 3)).toBe(false)
  })
  it('misses NaN points', () => {
    expect(hitCurrent(obj(), { x: NaN, y: 0.5 }, 4 / 3)).toBe(false)
  })
})
