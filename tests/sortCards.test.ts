import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  result: { data: null as unknown, error: null as { message: string } | null },
  eq: vi.fn(),
  order: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({ from: h.from }),
}))

import { fetchSortCards } from '@/lib/sort/cards'

beforeEach(() => {
  vi.clearAllMocks()
  h.result = { data: null, error: null }
  h.order.mockImplementation(() => Promise.resolve(h.result))
  h.eq.mockImplementation(() => ({ order: h.order }))
  h.select.mockImplementation(() => ({ eq: h.eq }))
  h.from.mockImplementation(() => ({ select: h.select }))
})

describe('fetchSortCards', () => {
  it('asks for active cards with group_id and returns the rows', async () => {
    const rows = [{ id: 'a', word: 'cat', image_path: 'seed/cat.svg', audio_path: null, active: true, group_id: 'g1' }]
    h.result = { data: rows, error: null }
    await expect(fetchSortCards()).resolves.toEqual(rows)
    expect(h.from).toHaveBeenCalledWith('memory_cards')
    expect(h.select).toHaveBeenCalledWith('id, word, image_path, audio_path, active, group_id')
    expect(h.eq).toHaveBeenCalledWith('active', true)
    expect(h.order).toHaveBeenCalledWith('created_at')
  })

  it('returns [] when data is null', async () => {
    await expect(fetchSortCards()).resolves.toEqual([])
  })

  it('throws the Supabase error message', async () => {
    h.result = { data: null, error: { message: 'boom' } }
    await expect(fetchSortCards()).rejects.toThrow('boom')
  })
})
