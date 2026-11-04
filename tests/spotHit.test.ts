import { describe, expect, it } from 'vitest'
import { hitTest } from '@/lib/spot/hit'

const A = 4 / 3
const diffs = [
  { x: 0.25, y: 0.5, r: 0.06 },
  { x: 0.75, y: 0.5, r: 0.06 },
]
const none = new Set<number>()

describe('hitTest', () => {
  it('finds the centre of a difference', () => {
    expect(hitTest(diffs, none, { x: 0.25, y: 0.5 }, A)).toEqual({ kind: 'found', index: 0 })
  })
  it('applies the minimum hit radius', () => {
    const small = [{ x: 0.25, y: 0.5, r: 0.04 }]
    expect(hitTest(small, none, { x: 0.295, y: 0.5 }, A)).toEqual({ kind: 'found', index: 0 })
  })
  it('misses far away', () => {
    expect(hitTest(diffs, none, { x: 0.5, y: 0.1 }, A)).toEqual({ kind: 'miss' })
  })
  it('reports repeat for an already found difference', () => {
    expect(hitTest(diffs, new Set([0]), { x: 0.25, y: 0.5 }, A)).toEqual({ kind: 'repeat', index: 0 })
  })
  it('prefers the nearest unfound over a closer found one', () => {
    const over = [
      { x: 0.5, y: 0.5, r: 0.1 },
      { x: 0.56, y: 0.5, r: 0.1 },
    ]
    expect(hitTest(over, new Set([0]), { x: 0.51, y: 0.5 }, A)).toEqual({ kind: 'found', index: 1 })
  })
  it('measures vertical offset in width units', () => {
    // dy = 0.07 fraction -> 0.07 / (4/3) = 0.0525 width units: inside r 0.06
    expect(hitTest(diffs, none, { x: 0.25, y: 0.57 }, A)).toEqual({ kind: 'found', index: 0 })
    // dy = 0.1 -> 0.075 width units: outside; dx alone would be 0
    expect(hitTest(diffs, none, { x: 0.25, y: 0.6 }, A)).toEqual({ kind: 'miss' })
  })
  it('misses at the edges and outside the unit square without throwing', () => {
    for (const p of [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: -2, y: 5 }, { x: NaN, y: 0.5 }]) {
      expect(hitTest(diffs, none, p, A)).toEqual({ kind: 'miss' })
    }
  })
  it('misses taps on or beyond the picture border even near an edge difference', () => {
    const left = [{ x: 0.02, y: 0.5, r: 0.06 }]
    expect(hitTest(left, none, { x: 0, y: 0.5 }, A)).toEqual({ kind: 'miss' })
    expect(hitTest(left, none, { x: -0.01, y: 0.5 }, A)).toEqual({ kind: 'miss' })
    expect(hitTest(left, none, { x: 0.03, y: 0.5 }, A)).toEqual({ kind: 'found', index: 0 })
    const right = [{ x: 0.98, y: 0.5, r: 0.06 }]
    expect(hitTest(right, none, { x: 1, y: 0.5 }, A)).toEqual({ kind: 'miss' })
    expect(hitTest(right, none, { x: 1.01, y: 0.5 }, A)).toEqual({ kind: 'miss' })
    expect(hitTest(right, none, { x: 0.97, y: 0.5 }, A)).toEqual({ kind: 'found', index: 0 })
    const top = [{ x: 0.5, y: 0.02, r: 0.06 }]
    expect(hitTest(top, none, { x: 0.5, y: 0 }, A)).toEqual({ kind: 'miss' })
    expect(hitTest(top, none, { x: 0.5, y: -0.01 }, A)).toEqual({ kind: 'miss' })
    expect(hitTest(top, none, { x: 0.5, y: 0.03 }, A)).toEqual({ kind: 'found', index: 0 })
    const bottom = [{ x: 0.5, y: 0.98, r: 0.06 }]
    expect(hitTest(bottom, none, { x: 0.5, y: 1 }, A)).toEqual({ kind: 'miss' })
    expect(hitTest(bottom, none, { x: 0.5, y: 1.01 }, A)).toEqual({ kind: 'miss' })
    expect(hitTest(bottom, none, { x: 0.5, y: 0.97 }, A)).toEqual({ kind: 'found', index: 0 })
  })
})
