import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  upsert: vi.fn(),
  del: vi.fn(),
  selectResult: { data: null as unknown, error: null as { message: string } | null },
  order: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({ from: h.from }),
}));

import {
  GROUP_NAME_MAX, deleteGroups, loadGroups, newGroup, pruneDeletedGroups, saveGroups, validateGroupName,
  type ECard, type EGroup,
} from '@/lib/memory/adminCards';

const g = (id: string, name: string, isNew = false): EGroup => ({ id, isNew, name });
const card = (o: Partial<ECard> = {}): ECard => ({ id: 'c1', isNew: false, word: 'cat', image: 'cards/1.png', audio: null, active: true, groupId: null, ...o });

beforeEach(() => {
  h.upsert.mockReset().mockResolvedValue({ error: null });
  h.del.mockReset().mockResolvedValue({ error: null });
  h.selectResult = { data: null, error: null };
  h.order.mockReset().mockImplementation(() => Promise.resolve(h.selectResult));
  h.select.mockReset().mockImplementation(() => ({ order: h.order }));
  h.from.mockReset().mockImplementation(() => ({ select: h.select, upsert: h.upsert, delete: () => ({ in: h.del }) }));
});

describe('newGroup', () => {
  it('is a new group with a fresh id', () => {
    const a = newGroup('Animals');
    expect(a).toMatchObject({ isNew: true, name: 'Animals' });
    expect(a.id).not.toBe(newGroup('Animals').id);
  });
});

describe('validateGroupName', () => {
  const groups = [g('a', 'Animals'), g('b', 'Fruit')];
  it('has a 40 character limit', () => expect(GROUP_NAME_MAX).toBe(40));
  it('refuses empty and whitespace-only names', () => {
    expect(validateGroupName('', groups)).toEqual(expect.any(String));
    expect(validateGroupName('   ', groups)).toEqual(expect.any(String));
  });
  it('accepts 40 characters and refuses 41', () => {
    expect(validateGroupName('a'.repeat(40), groups)).toBeNull();
    expect(validateGroupName('a'.repeat(41), groups)).toEqual(expect.any(String));
  });
  it('counts length after trimming', () => {
    expect(validateGroupName(`  ${'a'.repeat(40)}  `, groups)).toBeNull();
  });
  it('refuses duplicates ignoring case and surrounding spaces', () => {
    expect(validateGroupName(' animals ', groups)).toEqual(expect.any(String));
    expect(validateGroupName('FRUIT', groups)).toEqual(expect.any(String));
  });
  it('allows a unique name', () => expect(validateGroupName('Toys', groups)).toBeNull());
  it('lets a group keep its own name via selfId', () => {
    expect(validateGroupName('Animals', groups, 'a')).toBeNull();
    expect(validateGroupName('fruit', groups, 'a')).toEqual(expect.any(String));
  });
});

describe('pruneDeletedGroups', () => {
  it('clears groupId of cards whose group is gone, without mutating', () => {
    const cards = [card({ id: '1', groupId: 'a' }), card({ id: '2', groupId: 'x' }), card({ id: '3', groupId: null })];
    const out = pruneDeletedGroups(cards, [g('a', 'Animals')]);
    expect(out.map((c) => c.groupId)).toEqual(['a', null, null]);
    expect(cards[1].groupId).toBe('x');
    expect(out[1]).not.toBe(cards[1]);
  });
});

describe('loadGroups', () => {
  it('reads groups ordered by created_at and maps rows', async () => {
    h.selectResult = { data: [{ id: 'a', name: 'Animals' }], error: null };
    await expect(loadGroups()).resolves.toEqual([{ id: 'a', isNew: false, name: 'Animals' }]);
    expect(h.from).toHaveBeenCalledWith('card_groups');
    expect(h.select).toHaveBeenCalledWith('id, name');
    expect(h.order).toHaveBeenCalledWith('created_at');
  });
  it('throws the Supabase error message', async () => {
    h.selectResult = { data: null, error: { message: 'boom' } };
    await expect(loadGroups()).rejects.toThrow('boom');
  });
});

describe('saveGroups', () => {
  it('upserts only new or renamed groups, trimmed', async () => {
    const saved = [g('a', 'Animals'), g('b', 'Fruit')];
    const draft = [g('a', 'Animals'), g('b', '  Berries '), g('c', ' Toys ', true)];
    await expect(saveGroups(saved, draft)).resolves.toEqual({ error: null });
    expect(h.from).toHaveBeenCalledWith('card_groups');
    expect(h.upsert).toHaveBeenCalledTimes(1);
    expect(h.upsert.mock.calls[0][0]).toEqual([{ id: 'b', name: 'Berries' }, { id: 'c', name: 'Toys' }]);
    expect(h.upsert.mock.calls[0][1]).toEqual({ onConflict: 'id' });
  });
  it('makes no call when nothing changed', async () => {
    const saved = [g('a', 'Animals')];
    await expect(saveGroups(saved, [g('a', 'Animals')])).resolves.toEqual({ error: null });
    expect(h.from).not.toHaveBeenCalled();
  });
  it('returns the error message', async () => {
    h.upsert.mockResolvedValueOnce({ error: { message: 'dup' } });
    await expect(saveGroups([], [g('a', 'X', true)])).resolves.toEqual({ error: 'dup' });
  });
});

describe('deleteGroups', () => {
  it('issues one delete with in(id, ids)', async () => {
    await expect(deleteGroups(['a', 'b'])).resolves.toEqual({ error: null });
    expect(h.from).toHaveBeenCalledWith('card_groups');
    expect(h.del).toHaveBeenCalledTimes(1);
    expect(h.del).toHaveBeenCalledWith('id', ['a', 'b']);
  });
  it('makes no call for an empty list', async () => {
    await expect(deleteGroups([])).resolves.toEqual({ error: null });
    expect(h.from).not.toHaveBeenCalled();
  });
  it('returns the error message', async () => {
    h.del.mockResolvedValueOnce({ error: { message: 'nope' } });
    await expect(deleteGroups(['a'])).resolves.toEqual({ error: 'nope' });
  });
});
