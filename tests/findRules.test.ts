import { describe, expect, it } from 'vitest'
import { advance, isDone, startFind } from '@/lib/find/rules'

describe('find rules', () => {
  it('starts at index 0 and not done', () => {
    const s = startFind(3)
    expect(s.index).toBe(0)
    expect(s.total).toBe(3)
    expect(isDone(s)).toBe(false)
  })
  it('is done once advanced to total', () => {
    let s = startFind(2)
    s = advance(s)
    expect(isDone(s)).toBe(false)
    s = advance(s)
    expect(isDone(s)).toBe(true)
    expect(s.index).toBe(2)
  })
  it('stays done when advanced again', () => {
    let s = startFind(2)
    s = advance(advance(advance(s)))
    expect(s.index).toBe(2)
    expect(isDone(s)).toBe(true)
  })
  it('is never done with zero objects', () => {
    expect(isDone(startFind(0))).toBe(false)
  })
})
