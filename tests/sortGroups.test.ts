import { describe, expect, it } from 'vitest'
import { GROUP_MIN_CARDS, GROUPS_NEEDED, sortHealth, usableGroups, weakGroups, type GroupCard } from '@/lib/sort/groups'

const card = (word: string, group_id: string | null | undefined, active = true): GroupCard => ({ word, group_id, active })
const many = (g: string, n: number, prefix = g): GroupCard[] => Array.from({ length: n }, (_, i) => card(`${prefix}${i}`, g))

describe('usableGroups', () => {
  it('constants', () => {
    expect(GROUP_MIN_CARDS).toBe(4)
    expect(GROUPS_NEEDED).toBe(2)
  })

  it('cards sharing a group_id form one group', () => {
    const g = usableGroups([...many('a', 4), ...many('b', 5)])
    expect(g.map((x) => x.id)).toEqual(['a', 'b'])
    expect(g[0].cards).toHaveLength(4)
    expect(g[1].cards).toHaveLength(5)
  })

  it('a group with 3 cards is not usable', () => {
    expect(usableGroups([...many('a', 3), ...many('b', 4)]).map((x) => x.id)).toEqual(['b'])
  })

  it('5 cards of which only 3 have different words is not usable (also " Apple" vs "apple")', () => {
    const cards = [card('apple', 'a'), card(' Apple', 'a'), card('pear', 'a'), card('plum', 'a'), card('APPLE ', 'a')]
    expect(usableGroups(cards)).toEqual([])
  })

  it('keeps the first card with a word', () => {
    const first = card('apple', 'a')
    const g = usableGroups([first, card(' Apple', 'a'), card('pear', 'a'), card('plum', 'a'), card('fig', 'a')])
    expect(g[0].cards).toHaveLength(4)
    expect(g[0].cards[0]).toBe(first)
  })

  it('ignores inactive cards and cards with null or missing group_id', () => {
    const cards = [
      ...many('a', 3),
      card('extra', 'a', false),
      ...Array.from({ length: 6 }, (_, i) => card(`n${i}`, null)),
      ...Array.from({ length: 6 }, (_, i) => card(`u${i}`, undefined)),
    ]
    expect(usableGroups(cards)).toEqual([])
  })

  it('orders by first appearance', () => {
    const cards = [card('b0', 'b'), card('a0', 'a'), ...many('b', 4, 'bb').slice(0, 3), ...many('a', 4, 'aa').slice(0, 3)]
    expect(usableGroups(cards).map((x) => x.id)).toEqual(['b', 'a'])
  })
})

describe('weakGroups', () => {
  it('returns groups of 1 to 3 distinct words among active cards', () => {
    const cards = [...many('a', 3), ...many('b', 4), card('x', 'c'), card('y', 'd', false), card('z', null), card('q', 'e'), card(' Q', 'e'), ...many('f', 5)]
    expect([...weakGroups(cards)].sort()).toEqual(['a', 'c', 'e'])
  })
})

describe('sortHealth', () => {
  it('says how many groups can be played', () => {
    const cards = Array.from({ length: 6 }, (_, i) => many(`g${i}`, 4)).flat()
    expect(sortHealth(cards)).toBe('Sort It: 6 groups can be played (2 are needed, each with 4 cards).')
  })

  it('says so far when fewer than 2', () => {
    expect(sortHealth(many('a', 4))).toBe('Sort It: 1 group can be played so far (2 are needed, each with 4 cards).')
    expect(sortHealth([])).toBe('Sort It: 0 groups can be played so far (2 are needed, each with 4 cards).')
  })
})
