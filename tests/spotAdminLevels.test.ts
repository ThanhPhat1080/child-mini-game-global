import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/media/refs', () => ({ referencedPaths: async () => new Set<string>() })); // nothing else uses these files

const h = vi.hoisted(() => ({
  log: [] as string[],
  upload: vi.fn(),
  remove: vi.fn(),
  upsert: vi.fn(),
  del: vi.fn(),
  selectResult: { data: null as unknown, error: null as { message: string } | null },
  order: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'me' } } } }) },
    from: h.from,
    storage: { from: () => ({ upload: h.upload, remove: h.remove, getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn.test/${p}` } }) }) },
  }),
}));

import { addPending, clearPending } from '@/lib/media';
import { isLevelComplete, loadLevels, newLevel, saveLevels, type ELevel } from '@/lib/spot/adminLevels';

const three = [{ x: 0.2, y: 0.2, r: 0.06 }, { x: 0.5, y: 0.5, r: 0.06 }, { x: 0.8, y: 0.8, r: 0.06 }];
const level = (o: Partial<ELevel> = {}): ELevel => ({ id: 'l1', isNew: false, a: 'spot/a1.png', b: 'spot/b1.png', differences: three, active: true, ...o });
const file = (name: string, type = 'image/png') => new File(['x'], name, { type });

beforeEach(() => {
  h.log.length = 0;
  h.upload.mockReset().mockImplementation(async () => { h.log.push('upload'); return { error: null }; });
  h.remove.mockReset().mockImplementation(async () => { h.log.push('remove'); return { error: null }; });
  h.upsert.mockReset().mockImplementation(async () => { h.log.push('upsert'); return { error: null }; });
  h.del.mockReset().mockImplementation(async () => { h.log.push('delete'); return { error: null }; });
  h.selectResult = { data: null, error: null };
  const second = vi.fn(() => Promise.resolve(h.selectResult));
  h.order.mockReset().mockImplementation(() => ({ order: second }));
  h.select.mockReset().mockImplementation(() => ({ order: h.order }));
  h.from.mockReset().mockImplementation(() => ({ select: h.select, upsert: h.upsert, delete: () => ({ in: h.del }) }));
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:p-${++n}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => clearPending());

describe('newLevel / isLevelComplete', () => {
  it('a new level is new, active and empty', () => {
    expect(newLevel()).toMatchObject({ isNew: true, active: true, a: null, b: null, differences: [] });
    expect(newLevel().id).not.toBe(newLevel().id);
  });
  it('needs both pictures and 3 valid differences', () => {
    expect(isLevelComplete(level())).toBe(true);
    expect(isLevelComplete(level({ b: null }))).toBe(false);
    expect(isLevelComplete(level({ a: null }))).toBe(false);
    expect(isLevelComplete(level({ differences: three.slice(0, 2) }))).toBe(false);
  });
});

describe('loadLevels', () => {
  it('reads every level ordered by created_at then sort_order and maps the columns', async () => {
    h.selectResult = { data: [{ id: 'a', image_a_path: 'spot/a.png', image_b_path: 'spot/b.png', differences: three, active: false, sort_order: 1, owner_id: 'me', visibility: 'private' }, { id: 'z', image_a_path: 'q', image_b_path: 'r', differences: three, active: true, sort_order: 2, owner_id: 'other', visibility: 'global' }], error: null };
    await expect(loadLevels()).resolves.toEqual([{ id: 'a', isNew: false, a: 'spot/a.png', b: 'spot/b.png', differences: three, active: false, visibility: 'private' }]);
    expect(h.from).toHaveBeenCalledWith('spot_levels');
    expect(h.order).toHaveBeenNthCalledWith(1, 'created_at');
  });
  it('throws the Supabase error message', async () => {
    h.selectResult = { data: null, error: { message: 'boom' } };
    await expect(loadLevels()).rejects.toThrow('boom');
  });
});

describe('saveLevels', () => {
  it('uploads pending A and B into folder spot before writing, with sort_order by index', async () => {
    const draft = [level({ id: 'x', a: addPending(file('a.png')), b: addPending(file('b.png')) }), level({ id: 'y' })];
    const r = await saveLevels([level({ id: 'y' })], draft);
    expect(r).toEqual({ error: null, warning: null });
    expect(h.log).toEqual(['upload', 'upload', 'upsert']);
    const rows = h.upsert.mock.calls[0][0];
    expect(rows[0].image_a_path).toMatch(/^me\/spot\/[A-Za-z0-9-]*-[0-9a-z]{13}\.png$/);
    expect(rows[0].image_b_path).toMatch(/^me\/spot\/[A-Za-z0-9-]*-[0-9a-z]{13}\.png$/);
    expect(rows.map((x: { sort_order: number }) => x.sort_order)).toEqual([0, 1]);
    expect(rows[0]).toMatchObject({ id: 'x', differences: three, active: true });
    expect(h.upsert.mock.calls[0][1]).toEqual({ onConflict: 'id' });
  });

  it('deletes removed rows before the upsert and frees their files after the write', async () => {
    const r = await saveLevels([level({ id: 'a' }), level({ id: 'b', a: 'spot/gone-a.png', b: 'spot/gone-b.png' })], [level({ id: 'a' })]);
    expect(r).toEqual({ error: null, warning: null });
    expect(h.del).toHaveBeenCalledWith('id', ['b']);
    expect(h.log).toEqual(['delete', 'upsert', 'remove']);
    expect([...h.remove.mock.calls[0][0]].sort()).toEqual(['spot/gone-a.png', 'spot/gone-b.png']);
  });

  it('never deletes seed paths', async () => {
    await saveLevels([level({ id: 'a', a: 'seed/spot/garden-a.svg', b: 'seed/spot/garden-b.svg' })], []);
    expect(h.remove).not.toHaveBeenCalled();
  });

  it('removes a replaced picture only after the write succeeds', async () => {
    await saveLevels([level({ id: 'a', a: 'spot/old.png' })], [level({ id: 'a', a: addPending(file('n.png')) })]);
    expect(h.log).toEqual(['upload', 'upsert', 'remove']);
    expect(h.remove.mock.calls[0][0]).toEqual(['spot/old.png']);
  });

  it('removes this attempt\'s uploads and returns the error when the write fails', async () => {
    h.upsert.mockImplementationOnce(async () => ({ error: { message: 'db down' } }));
    const r = await saveLevels([level({ id: 'a', a: 'spot/old.png' })], [level({ id: 'a', a: addPending(file('a.png')) })]);
    expect(r).toEqual({ error: 'db down', warning: null });
    const removed = h.remove.mock.calls[0][0] as string[];
    expect(removed).toHaveLength(1);
    expect(removed[0]).toMatch(/^me\/spot\/[A-Za-z0-9-]+-/);
    expect(removed).not.toContain('spot/old.png');
  });

  it('writes nothing when an upload fails', async () => {
    h.upload.mockImplementationOnce(async () => ({ error: { message: 'boom' } }));
    const r = await saveLevels([], [level({ a: addPending(file('a.png')) })]);
    expect(r).toEqual({ error: 'boom', warning: null });
    expect(h.upsert).not.toHaveBeenCalled();
  });

  it('warns, not errors, when only the cleanup fails', async () => {
    h.remove.mockImplementationOnce(async () => ({ error: { message: 'storage' } }));
    const r = await saveLevels([level({ id: 'a', a: 'spot/old.png' })], [level({ id: 'a', a: 'spot/new.png' })]);
    expect(r).toEqual({ error: null, warning: 'The levels were saved, but some old files could not be removed from storage.' });
  });
});

