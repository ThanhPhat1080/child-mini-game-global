import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  result: { data: null as unknown, error: null as { message: string } | null },
  order: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({ from: h.from }) }));

import { fetchActiveFindLevels, fetchFindLevel } from '@/lib/find/levels';

const COLS = 'id, image_path, objects, active, sort_order';

const obj = (word: string) => ({ x: 0.2, y: 0.4, r: 0.06, word, audio_path: null });
const good = (id: string, sort_order = 1) => ({
  id,
  image_path: `img/${id}.png`,
  objects: [obj('cat'), obj('dog')],
  active: true,
  sort_order,
});
const oneObject = { ...good('one'), objects: [obj('cat')] };
const blankWord = { ...good('blank'), objects: [obj('cat'), obj('   ')] };
const notArray = { ...good('str'), objects: 'cat' };

beforeEach(() => {
  vi.clearAllMocks();
  h.result = { data: null, error: null };
  // list: select -> eq -> order -> order (awaited); one: select -> eq -> maybeSingle
  const secondOrder = () => Promise.resolve(h.result);
  h.order.mockImplementation(() => ({ order: secondOrder }));
  h.maybeSingle.mockImplementation(() => Promise.resolve(h.result));
  h.eq.mockImplementation(() => ({ order: h.order, maybeSingle: h.maybeSingle }));
  h.select.mockImplementation(() => ({ eq: h.eq, order: h.order, maybeSingle: h.maybeSingle }));
  h.from.mockImplementation(() => ({ select: h.select }));
});

describe('fetchActiveFindLevels', () => {
  it('asks find_levels for active rows ordered by sort_order then created_at', async () => {
    h.result = { data: [good('a')], error: null };
    await fetchActiveFindLevels();
    expect(h.from).toHaveBeenCalledWith('find_levels');
    expect(h.select).toHaveBeenCalledWith(COLS);
    expect(h.eq).toHaveBeenCalledWith('active', true);
    expect(h.order).toHaveBeenCalledWith('sort_order');
  });

  it('orders by created_at second', async () => {
    const second = vi.fn(() => Promise.resolve(h.result));
    h.order.mockImplementation(() => ({ order: second }));
    h.result = { data: [], error: null };
    await fetchActiveFindLevels();
    expect(second).toHaveBeenCalledWith('created_at');
  });

  it('drops rows that are not playable and keeps the order', async () => {
    h.result = {
      data: [good('a', 1), oneObject, blankWord, notArray, good('b', 2)],
      error: null,
    };
    const levels = await fetchActiveFindLevels();
    expect(levels.map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('returns an empty list for null data', async () => {
    await expect(fetchActiveFindLevels()).resolves.toEqual([]);
  });

  it('throws the Supabase error message', async () => {
    h.result = { data: null, error: { message: 'boom' } };
    await expect(fetchActiveFindLevels()).rejects.toThrow('boom');
  });
});

describe('fetchFindLevel', () => {
  it('returns the playable row for an id, with no active filter', async () => {
    const row = { ...good('a'), active: false };
    h.result = { data: row, error: null };
    await expect(fetchFindLevel('a')).resolves.toEqual(row);
    expect(h.from).toHaveBeenCalledWith('find_levels');
    expect(h.select).toHaveBeenCalledWith(COLS);
    expect(h.eq).toHaveBeenCalledTimes(1);
    expect(h.eq).toHaveBeenCalledWith('id', 'a');
    expect(h.eq).not.toHaveBeenCalledWith('active', expect.anything());
  });

  it('returns null for an unplayable row', async () => {
    h.result = { data: oneObject, error: null };
    await expect(fetchFindLevel('one')).resolves.toBeNull();
  });

  it('returns null when there is no row', async () => {
    h.result = { data: null, error: null };
    await expect(fetchFindLevel('nope')).resolves.toBeNull();
  });

  it('returns null on an error', async () => {
    h.result = { data: null, error: { message: 'boom' } };
    await expect(fetchFindLevel('a')).resolves.toBeNull();
  });
});
