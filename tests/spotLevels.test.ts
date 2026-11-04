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

import { fetchActiveLevels, fetchLevel } from '@/lib/spot/levels';

const COLS = 'id, image_a_path, image_b_path, differences, active, sort_order';

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

describe('fetchActiveLevels', () => {
  it('asks spot_levels for active rows ordered by sort_order then created_at and returns them', async () => {
    const rows = [{ id: 'a', image_a_path: 'x', image_b_path: 'y', differences: [], active: true, sort_order: 1 }];
    h.result = { data: rows, error: null };
    await expect(fetchActiveLevels()).resolves.toEqual(rows);
    expect(h.from).toHaveBeenCalledWith('spot_levels');
    expect(h.select).toHaveBeenCalledWith(COLS);
    expect(h.eq).toHaveBeenCalledWith('active', true);
    expect(h.order).toHaveBeenCalledWith('sort_order');
  });

  it('orders by created_at second', async () => {
    const second = vi.fn(() => Promise.resolve(h.result));
    h.order.mockImplementation(() => ({ order: second }));
    h.result = { data: [], error: null };
    await fetchActiveLevels();
    expect(second).toHaveBeenCalledWith('created_at');
  });

  it('returns an empty list for null data', async () => {
    await expect(fetchActiveLevels()).resolves.toEqual([]);
  });

  it('throws the Supabase error message', async () => {
    h.result = { data: null, error: { message: 'boom' } };
    await expect(fetchActiveLevels()).rejects.toThrow('boom');
  });
});

describe('fetchLevel', () => {
  it('returns the row for an id, with no active filter', async () => {
    const row = { id: 'a', image_a_path: 'x', image_b_path: 'y', differences: [], active: false, sort_order: 1 };
    h.result = { data: row, error: null };
    await expect(fetchLevel('a')).resolves.toEqual(row);
    expect(h.from).toHaveBeenCalledWith('spot_levels');
    expect(h.select).toHaveBeenCalledWith(COLS);
    expect(h.eq).toHaveBeenCalledTimes(1);
    expect(h.eq).toHaveBeenCalledWith('id', 'a');
    expect(h.eq).not.toHaveBeenCalledWith('active', expect.anything());
  });

  it('returns null when there is no row', async () => {
    h.result = { data: null, error: null };
    await expect(fetchLevel('nope')).resolves.toBeNull();
  });

  it('returns null on an error', async () => {
    h.result = { data: null, error: { message: 'boom' } };
    await expect(fetchLevel('a')).resolves.toBeNull();
  });
});
