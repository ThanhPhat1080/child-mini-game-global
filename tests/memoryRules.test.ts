import { describe, expect, it } from 'vitest'
import type { DeckTile } from '@/lib/memory/deck'
import { flip, resolveMismatch, startGame, type GameState } from '@/lib/memory/rules'

function tile(id: string, n: number): DeckTile {
  return {
    key: `${id}:${n}`,
    card: { id, word: id, image_path: `${id}.png`, audio_path: null, active: true },
  }
}

// indexes: 0,1 = a ; 2,3 = b ; 4,5 = c
const tiles = (): DeckTile[] => ['a', 'b', 'c'].flatMap((id) => [tile(id, 0), tile(id, 1)])

function deepFreeze(s: GameState): GameState {
  Object.freeze(s)
  Object.freeze(s.up)
  Object.freeze(s.tiles)
  return s
}

describe('memory rules', () => {
  it('starts empty', () => {
    const s = startGame(tiles())
    expect(s.up).toEqual([])
    expect(s.matched.size).toBe(0)
    expect(s.flips).toBe(0)
    expect(s.pending).toBe(false)
  })

  it('first flip emits flipped and counts', () => {
    const r = flip(startGame(tiles()), 0)
    expect(r.events).toEqual([{ type: 'flipped', index: 0 }])
    expect(r.state.flips).toBe(1)
    expect(r.state.up).toEqual([0])
  })

  it('second flip with same card id matches', () => {
    const s1 = flip(startGame(tiles()), 0).state
    const r = flip(s1, 1)
    expect(r.events).toContainEqual({ type: 'matched', cardId: 'a', indexes: [0, 1] })
    expect(r.state.up).toEqual([])
    expect(r.state.matched.has('a')).toBe(true)
    expect(r.state.flips).toBe(2)
    expect(r.state.pending).toBe(false)
  })

  it('second flip with other card id is a mismatch and pending', () => {
    const s1 = flip(startGame(tiles()), 0).state
    const r = flip(s1, 2)
    expect(r.events).toContainEqual({ type: 'mismatch', indexes: [0, 2] })
    expect(r.state.pending).toBe(true)
    expect(r.state.flips).toBe(2)
    expect(r.state.up).toEqual([0, 2])
  })

  it('ignores any flip while pending', () => {
    const s2 = flip(flip(startGame(tiles()), 0).state, 2).state
    const r = flip(s2, 4)
    expect(r.events).toEqual([{ type: 'ignored' }])
    expect(r.state).toEqual(s2)
    expect(r.state.flips).toBe(2)
  })

  it('resolveMismatch clears up and pending, keeps flips', () => {
    const s2 = flip(flip(startGame(tiles()), 0).state, 2).state
    const r = resolveMismatch(s2)
    expect(r.state.up).toEqual([])
    expect(r.state.pending).toBe(false)
    expect(r.state.flips).toBe(2)
    expect(r.events).toEqual([])
  })

  it('ignores a double click on a face-up tile', () => {
    const s1 = flip(startGame(tiles()), 0).state
    const r = flip(s1, 0)
    expect(r.events).toEqual([{ type: 'ignored' }])
    expect(r.state.flips).toBe(1)
    expect(r.state.up).toEqual([0])
  })

  it('replays a matched tile without counting', () => {
    const s = flip(flip(startGame(tiles()), 0).state, 1).state
    const r = flip(s, 1)
    expect(r.events).toEqual([{ type: 'replay', cardId: 'a' }])
    expect(r.state.flips).toBe(2)
  })

  it('ignores out-of-range and non-integer indexes', () => {
    const s = startGame(tiles())
    for (const i of [-1, 6, 99, 1.5, NaN]) {
      const r = flip(s, i)
      expect(r.events).toEqual([{ type: 'ignored' }])
      expect(r.state.flips).toBe(0)
    }
  })

  it('last pair adds won with final flips; perfect 6-pair game is 12 flips', () => {
    const t = ['a', 'b', 'c', 'd', 'e', 'f'].flatMap((id) => [tile(id, 0), tile(id, 1)])
    let s = startGame(t)
    let last: ReturnType<typeof flip> | undefined
    for (let i = 0; i < 12; i++) {
      last = flip(s, i)
      s = last.state
      if (i < 11) expect(last.events.some((e) => e.type === 'won')).toBe(false)
    }
    expect(s.flips).toBe(12)
    expect(last!.events).toContainEqual({ type: 'won', flips: 12 })
  })

  it('never mutates the input state', () => {
    const s0 = deepFreeze(startGame(tiles()))
    const s1 = deepFreeze(flip(s0, 0).state)
    const s2 = deepFreeze(flip(s1, 2).state)
    expect(() => resolveMismatch(s2)).not.toThrow()
    expect(() => flip(s1, 1)).not.toThrow()
    expect(s1.up).toEqual([0])
    expect(s0.flips).toBe(0)
  })
})
