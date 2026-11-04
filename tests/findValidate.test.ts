import { describe, expect, it } from 'vitest'
import { checkObjects, isPlayable } from '@/lib/find/validate'
import type { FindLevel } from '@/lib/find/types'

const o = (i = 0) => ({ x: 0.1 + i * 0.05, y: 0.5, r: 0.06, word: `word${i}`, audio_path: null })
const list = (n: number) => Array.from({ length: n }, (_, i) => o(i))

describe('checkObjects', () => {
  it('accepts 2 and 12 valid objects', () => {
    expect(checkObjects(list(2))).toBeNull()
    expect(checkObjects(list(12))).toBeNull()
  })
  it('rejects 1 and 13 objects and non-arrays', () => {
    expect(checkObjects(list(1))).toEqual(expect.any(String))
    expect(checkObjects(list(13))).toEqual(expect.any(String))
    expect(checkObjects('x')).toEqual(expect.any(String))
    expect(checkObjects(null)).toEqual(expect.any(String))
  })
  it('rejects a blank or whitespace word', () => {
    expect(checkObjects([{ ...o(0), word: '' }, o(1)])).toEqual(expect.any(String))
    expect(checkObjects([{ ...o(0), word: '   ' }, o(1)])).toEqual(expect.any(String))
  })
  it('rejects a word over 40 characters and accepts exactly 40', () => {
    expect(checkObjects([{ ...o(0), word: 'a'.repeat(41) }, o(1)])).toEqual(expect.any(String))
    expect(checkObjects([{ ...o(0), word: 'a'.repeat(40) }, o(1)])).toBeNull()
  })
  it('rejects out-of-range x and y', () => {
    expect(checkObjects([{ ...o(0), x: 1.2 }, o(1)])).toEqual(expect.any(String))
    expect(checkObjects([{ ...o(0), y: -0.1 }, o(1)])).toEqual(expect.any(String))
  })
  it('rejects r outside 0.03 to 0.15 and accepts the bounds', () => {
    expect(checkObjects([{ ...o(0), r: 0.02 }, o(1)])).toEqual(expect.any(String))
    expect(checkObjects([{ ...o(0), r: 0.2 }, o(1)])).toEqual(expect.any(String))
    expect(checkObjects([{ ...o(0), r: 0.03 }, o(1)])).toBeNull()
    expect(checkObjects([{ ...o(0), r: 0.15 }, o(1)])).toBeNull()
  })
  it('rejects a numeric audio_path and accepts null or a string', () => {
    expect(checkObjects([{ ...o(0), audio_path: 5 }, o(1)])).toEqual(expect.any(String))
    expect(checkObjects([{ ...o(0), audio_path: null }, o(1)])).toBeNull()
    expect(checkObjects([{ ...o(0), audio_path: 'seed/a.mp3' }, o(1)])).toBeNull()
  })
  it('names the object number in the message', () => {
    expect(checkObjects([o(0), { ...o(1), x: 2 }])).toMatch(/2/)
  })
})

describe('isPlayable', () => {
  const level = (over: Partial<FindLevel> = {}): FindLevel => ({
    id: 'l1',
    image_path: 'seed/picture.jpg',
    objects: list(2),
    active: true,
    sort_order: 0,
    ...over,
  })
  it('is true for a valid level with an image', () => {
    expect(isPlayable(level())).toBe(true)
  })
  it('is false when image_path is empty', () => {
    expect(isPlayable(level({ image_path: '' }))).toBe(false)
  })
  it('is false when the objects are invalid', () => {
    expect(isPlayable(level({ objects: list(1) }))).toBe(false)
  })
})
