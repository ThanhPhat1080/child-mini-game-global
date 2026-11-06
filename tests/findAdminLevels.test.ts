import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  referencedPaths: vi.fn(),
}));
vi.mock('@/lib/review', async (orig) => ({ ...(await orig<typeof import('@/lib/review')>()), getMyRole: async () => 'parent' }));
vi.mock('@/lib/media/refs', () => ({ referencedPaths: h.referencedPaths }));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'me' } } } }) },
    from: h.from,
    storage: { from: () => ({ upload: h.upload, remove: h.remove, getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn.test/${p}` } }) }) },
  }),
}));

import { addPending, clearPending } from '@/lib/media';
import { DEFAULT_R, MAX_OBJECTS, MAX_R, MIN_R } from '@/lib/find/validate';
import type { FindObject } from '@/lib/find/types';
import {
  addObject,
  isLevelComplete,
  levelMediaPaths,
  loadFindLevels,
  moveObject,
  newFindLevel,
  removeObject,
  saveFindLevels,
  setObjectAudio,
  setObjectRadius,
  setObjectWord,
  smallCount,
  type ELevel,
} from '@/lib/find/adminLevels';

const obj = (x: number, word: string, extra: Partial<FindObject> = {}): FindObject => ({ x, y: 0.5, r: DEFAULT_R, word, audio_path: null, ...extra });
const level = (o: Partial<ELevel> = {}): ELevel => ({
  id: 'l1',
  isNew: false,
  image: 'find/p1.png',
  objects: [obj(0.2, 'cat'), obj(0.8, 'dog')],
  active: true,
  ...o,
});
const file = (name: string, type = 'image/png') => new File(['x'], name, { type });

beforeEach(() => {
  h.log.length = 0;
  h.upload.mockReset().mockImplementation(async () => { h.log.push('upload'); return { error: null }; });
  h.remove.mockReset().mockImplementation(async () => { h.log.push('remove'); return { error: null }; });
  h.upsert.mockReset().mockImplementation(async () => { h.log.push('upsert'); return { error: null }; });
  h.del.mockReset().mockImplementation(async () => { h.log.push('delete'); return { error: null }; });
  h.referencedPaths.mockReset().mockImplementation(async () => new Set<string>()); // nothing else uses these files
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

describe('newFindLevel', () => {
  it('is new, active and empty', () => {
    expect(newFindLevel()).toMatchObject({ isNew: true, active: true, image: null, objects: [] });
    expect(newFindLevel().id).not.toBe(newFindLevel().id);
  });
});

describe('addObject', () => {
  it('appends an object with the default radius, blank word and no sound', () => {
    expect(addObject([], 0.3, 0.4)).toEqual([{ x: 0.3, y: 0.4, r: DEFAULT_R, word: '', audio_path: null }]);
  });
  it('does not change its input', () => {
    const list = [obj(0.1, 'cat')];
    const before = structuredClone(list);
    addObject(list, 0.5, 0.5);
    expect(list).toEqual(before);
  });
  it('is a no-op at the object limit', () => {
    const full = Array.from({ length: MAX_OBJECTS }, (_, i) => obj(i / 20, `w${i}`));
    expect(addObject(full, 0.5, 0.5)).toEqual(full);
  });
});

describe('removeObject', () => {
  const list = [
    obj(0.1, 'cat', { audio_path: 'find/cat.mp3' }),
    obj(0.2, 'dog', { audio_path: 'find/dog.mp3' }),
    obj(0.3, 'cow', { audio_path: 'find/cow.mp3' }),
  ];
  it('shifts later objects up with their word and sound intact', () => {
    const out = removeObject(list, 1);
    expect(out).toEqual([list[0], list[2]]);
    expect(out[1]).toMatchObject({ x: 0.3, word: 'cow', audio_path: 'find/cow.mp3' });
  });
  it('does not change its input', () => {
    const before = structuredClone(list);
    removeObject(list, 0);
    expect(list).toEqual(before);
  });
});

describe('moveObject', () => {
  const list = [obj(0.1, 'cat', { audio_path: 'find/cat.mp3' }), obj(0.2, 'dog'), obj(0.3, 'cow')];
  it('swaps whole objects, so word and sound travel with the circle', () => {
    const out = moveObject(list, 0, 1);
    expect(out).toEqual([list[1], list[0], list[2]]);
    expect(out[1]).toMatchObject({ x: 0.1, word: 'cat', audio_path: 'find/cat.mp3' });
  });
  it('moves at the ends are a no-op', () => {
    expect(moveObject(list, 0, -1)).toEqual(list);
    expect(moveObject(list, 2, 1)).toEqual(list);
  });
  it('does not change its input', () => {
    const before = structuredClone(list);
    moveObject(list, 0, 1);
    expect(list).toEqual(before);
  });
});

describe('setObjectRadius / setObjectWord / setObjectAudio', () => {
  const list = [obj(0.1, 'cat'), obj(0.2, 'dog')];
  it('clamps the radius to the allowed range', () => {
    expect(setObjectRadius(list, 0, 0.5)[0].r).toBe(MAX_R);
    expect(setObjectRadius(list, 0, 0.001)[0].r).toBe(MIN_R);
    const out = setObjectRadius(list, 0, 0.1);
    expect(out[0]).toEqual({ ...list[0], r: 0.1 });
    expect(out[1]).toBe(list[1]);
  });
  it('sets the word of one object only', () => {
    expect(setObjectWord(list, 1, 'bird')).toEqual([list[0], { ...list[1], word: 'bird' }]);
  });
  it('sets and clears the sound of one object only', () => {
    expect(setObjectAudio(list, 0, 'find/x.mp3')[0].audio_path).toBe('find/x.mp3');
    expect(setObjectAudio(list, 0, null)[0].audio_path).toBeNull();
    expect(setObjectAudio(list, 0, 'find/x.mp3')[1]).toEqual(list[1]);
  });
});

describe('isLevelComplete', () => {
  it('is true with a picture and 2 valid objects', () => {
    expect(isLevelComplete(level())).toBe(true);
  });
  it('is false with 1 object', () => {
    expect(isLevelComplete(level({ objects: [obj(0.2, 'cat')] }))).toBe(false);
  });
  it('is false with a blank word', () => {
    expect(isLevelComplete(level({ objects: [obj(0.2, 'cat'), obj(0.8, '  ')] }))).toBe(false);
  });
  it('is false with no picture', () => {
    expect(isLevelComplete(level({ image: null }))).toBe(false);
  });
});

describe('smallCount', () => {
  it('counts objects with a radius below the small threshold', () => {
    const l = level({ objects: [obj(0.1, 'a', { r: 0.03 }), obj(0.2, 'b', { r: 0.035 }), obj(0.3, 'c', { r: 0.04 }), obj(0.4, 'd')] });
    expect(smallCount(l)).toBe(2);
  });
});

describe('levelMediaPaths', () => {
  it('lists the picture and object sounds that are bucket files', () => {
    const l = level({
      image: 'find/p.png',
      objects: [
        obj(0.1, 'a', { audio_path: null }),
        obj(0.2, 'b', { audio_path: 'pending:abc' }),
        obj(0.3, 'c', { audio_path: 'https://example.com/c.mp3' }),
        obj(0.4, 'd', { audio_path: 'find/d.mp3' }),
      ],
    });
    expect(levelMediaPaths(l)).toEqual(['find/p.png', 'find/d.mp3']);
  });
  it('skips bundled art', () => {
    expect(levelMediaPaths(level({ image: 'seed/find/p.svg', objects: [obj(0.1, 'a', { audio_path: 'seed/find/a.mp3' })] }))).toEqual([]);
  });
});


describe('loadFindLevels', () => {
  it('reads every level ordered by created_at then sort_order and maps the columns', async () => {
    const objects = [obj(0.2, 'cat'), obj(0.8, 'dog')];
    h.selectResult = { data: [{ id: 'a', image_path: 'find/p.png', objects, active: false, sort_order: 1, owner_id: 'me', visibility: 'private' }, { id: 'z', image_path: 'q', objects, active: true, sort_order: 2, owner_id: 'other', visibility: 'global' }], error: null };
    await expect(loadFindLevels()).resolves.toEqual([{ id: 'a', isNew: false, image: 'find/p.png', objects, active: false, visibility: 'private', superOwned: false, copied: false }]);
    expect(h.from).toHaveBeenCalledWith('find_levels');
    expect(h.order).toHaveBeenNthCalledWith(1, 'created_at');
  });
  it('throws the Supabase error message', async () => {
    h.selectResult = { data: null, error: { message: 'boom' } };
    await expect(loadFindLevels()).rejects.toThrow('boom');
  });
});

describe('saveFindLevels', () => {
  it('trims each word before writing it (a draft word of spaces around cat is saved as cat)', async () => {
    const draft = [level({ id: 'x', image: 'find/p.png', objects: [obj(0.2, ' cat '), obj(0.8, 'dog')] })];
    await saveFindLevels([], draft);
    const rows = h.upsert.mock.calls[0][0];
    expect(rows[0].objects.map((o: { word: string }) => o.word)).toEqual(['cat', 'dog']);
  });

  it('uploads pending picture and sounds into folder find before writing, and swaps in real paths in order', async () => {
    const draft = [
      level({
        id: 'x',
        image: addPending(file('p.png')),
        objects: [obj(0.2, 'cat', { audio_path: addPending(file('cat.mp3', 'audio/mpeg')) }), obj(0.8, 'dog')],
      }),
      level({ id: 'y', image: 'find/q.png' }),
    ];
    const r = await saveFindLevels([], draft);
    expect(r).toEqual({ error: null, warning: null });
    expect(h.log).toEqual(['upload', 'upload', 'upsert']);
    expect(h.upload.mock.calls.map((c) => c[0])).toEqual([
      expect.stringMatching(/^me\/find\/[A-Za-z0-9-]*-[0-9a-z]{13}\.png$/),
      expect.stringMatching(/^me\/find\/[A-Za-z0-9-]*-[0-9a-z]{13}\.mp3$/),
    ]);
    const rows = h.upsert.mock.calls[0][0];
    expect(rows[0].image_path).toMatch(/^me\/find\/[A-Za-z0-9-]*-[0-9a-z]{13}\.png$/);
    expect(rows[0].objects[0]).toEqual({ x: 0.2, y: 0.5, r: DEFAULT_R, word: 'cat', audio_path: rows[0].objects[0].audio_path });
    expect(rows[0].objects[0].audio_path).toMatch(/^me\/find\/[A-Za-z0-9-]*-[0-9a-z]{13}\.mp3$/);
    expect(rows[0].objects[1]).toEqual(obj(0.8, 'dog'));
    expect(rows[1]).toMatchObject({ id: 'y', image_path: 'find/q.png' });
    expect(rows[0]).toMatchObject({ id: 'x', active: true });
    expect(rows.map((x: { sort_order: number }) => x.sort_order)).toEqual([0, 1]);
    expect(Object.keys(rows[0]).sort()).toEqual(['active', 'id', 'image_path', 'objects', 'sort_order']);
    expect(h.upsert.mock.calls[0][1]).toEqual({ onConflict: 'id' });
  });

  it('deletes removed rows before the write and frees their files after it', async () => {
    const saved = [
      level({ id: 'a', image: 'find/a.png' }),
      level({ id: 'b', image: 'find/b.png', objects: [obj(0.2, 'cat', { audio_path: 'find/b.mp3' }), obj(0.8, 'dog')] }),
    ];
    const r = await saveFindLevels(saved, [level({ id: 'a', image: 'find/a.png' })]);
    expect(r).toEqual({ error: null, warning: null });
    expect(h.del).toHaveBeenCalledWith('id', ['b']);
    expect(h.log).toEqual(['delete', 'upsert', 'remove']);
    expect([...h.remove.mock.calls[0][0]].sort()).toEqual(['find/b.mp3', 'find/b.png']);
  });

  it('keeps a file that another record still uses', async () => {
    h.referencedPaths.mockResolvedValueOnce(new Set(['find/pic.png']));
    const r = await saveFindLevels([level({ id: 'a', image: 'find/pic.png' })], []);
    expect(r).toEqual({ error: null, warning: null });
    expect(h.referencedPaths).toHaveBeenCalledWith(['find/pic.png']);
    expect(h.remove).not.toHaveBeenCalled();
  });

  it('keeps files and still saves when the reference check fails', async () => {
    h.referencedPaths.mockRejectedValueOnce(new Error('network'));
    const r = await saveFindLevels([level({ id: 'a', image: 'find/old.png' })], []);
    expect(r).toEqual({ error: null, warning: null });
    expect(h.upsert).not.toHaveBeenCalled();
    expect(h.log).toEqual(['delete']);
    expect(h.remove).not.toHaveBeenCalled();
  });

  it('never deletes seed paths, links or pending tokens', async () => {
    await saveFindLevels([level({ id: 'a', image: 'seed/find/p.svg', objects: [obj(0.2, 'cat', { audio_path: 'https://x.test/a.mp3' }), obj(0.8, 'dog')] })], []);
    expect(h.remove).not.toHaveBeenCalled();
  });

  it('removes a replaced picture only after the write succeeds', async () => {
    await saveFindLevels([level({ id: 'a', image: 'find/old.png' })], [level({ id: 'a', image: addPending(file('n.png')) })]);
    expect(h.log).toEqual(['upload', 'upsert', 'remove']);
    expect(h.remove.mock.calls[0][0]).toEqual(['find/old.png']);
  });

  it('removes this attempt\'s uploads and returns the error when the write fails', async () => {
    h.upsert.mockImplementationOnce(async () => ({ error: { message: 'db down' } }));
    const r = await saveFindLevels([level({ id: 'a', image: 'find/old.png' })], [level({ id: 'a', image: addPending(file('a.png')) })]);
    expect(r).toEqual({ error: 'db down', warning: null });
    const removed = h.remove.mock.calls[0][0] as string[];
    expect(removed).toHaveLength(1);
    expect(removed[0]).toMatch(/^me\/find\/[A-Za-z0-9-]+-/);
    expect(removed).not.toContain('find/old.png');
  });

  it('writes nothing when an upload fails', async () => {
    h.upload.mockImplementationOnce(async () => ({ error: { message: 'boom' } }));
    const r = await saveFindLevels([], [level({ image: addPending(file('a.png')) })]);
    expect(r).toEqual({ error: 'boom', warning: null });
    expect(h.upsert).not.toHaveBeenCalled();
  });

  it('warns, not errors, when only the cleanup fails', async () => {
    h.remove.mockImplementationOnce(async () => ({ error: { message: 'storage' } }));
    const r = await saveFindLevels([level({ id: 'a', image: 'find/old.png' })], [level({ id: 'a', image: 'find/new.png' })]);
    expect(r).toEqual({ error: null, warning: 'The levels were saved, but some old files could not be removed from storage.' });
  });
});
