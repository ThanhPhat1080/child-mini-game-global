export const GROUP_MIN_CARDS = 4
export const GROUPS_NEEDED = 2

export type GroupCard = { word: string; group_id?: string | null; active: boolean }

const norm = (w: string) => w.trim().toLowerCase()

/** Active cards with a group, per group, one card per distinct word (first kept), by first appearance. */
function collect<T extends GroupCard>(cards: readonly T[]): { id: string; cards: T[] }[] {
  const groups = new Map<string, { id: string; cards: T[]; words: Set<string> }>()
  for (const c of cards) {
    if (!c.active || !c.group_id) continue
    let g = groups.get(c.group_id)
    if (!g) {
      g = { id: c.group_id, cards: [], words: new Set() }
      groups.set(c.group_id, g)
    }
    const key = norm(c.word)
    if (g.words.has(key)) continue
    g.words.add(key)
    g.cards.push(c)
  }
  return [...groups.values()].map(({ id, cards: list }) => ({ id, cards: list }))
}

/** Groups with at least GROUP_MIN_CARDS active cards of different words, ordered by first appearance. */
export function usableGroups<T extends GroupCard>(cards: readonly T[]): { id: string; cards: T[] }[] {
  return collect(cards).filter((g) => g.cards.length >= GROUP_MIN_CARDS)
}

/** Group ids that exist on active cards but have only 1 to 3 distinct words. */
export function weakGroups(cards: readonly GroupCard[]): Set<string> {
  return new Set(collect(cards).filter((g) => g.cards.length < GROUP_MIN_CARDS).map((g) => g.id))
}

export function sortHealth(cards: readonly GroupCard[]): string {
  const n = usableGroups(cards).length
  const noun = n === 1 ? 'group' : 'groups'
  const tail = `(${GROUPS_NEEDED} are needed, each with ${GROUP_MIN_CARDS} cards).`
  return n >= GROUPS_NEEDED
    ? `Sort It: ${n} ${noun} can be played ${tail}`
    : `Sort It: ${n} ${noun} can be played so far ${tail}`
}
