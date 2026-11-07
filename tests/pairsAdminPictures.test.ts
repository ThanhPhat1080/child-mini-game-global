import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({ from: h.from }) }));

import { duplicateWords, isPictureComplete, loadPictures, readyCount, savePictures, type EPicture } from '@/lib/pairs/adminPictures';

const pic = (o: Partial<EPicture> & { id: string }): EPicture => ({ isNew: false, image: `seed/${o.id}.svg`, word: o.id, audio: null, active: true, ...o });

beforeEach(() => h.from.mockReset());

describe('isPictureComplete (A32)', () => {
  it('needs a picture and a trimmed word of 1-40 characters', () => {
    expect(isPictureComplete(pic({ id: 'a' }))).toBe(true);
    expect(isPictureComplete(pic({ id: 'a', word: '  fish  ' }))).toBe(true);
    expect(isPictureComplete(pic({ id: 'a', word: 'x'.repeat(40) }))).toBe(true);
    expect(isPictureComplete(pic({ id: 'a', word: '' }))).toBe(false);
    expect(isPictureComplete(pic({ id: 'a', word: '   ' }))).toBe(false);
    expect(isPictureComplete(pic({ id: 'a', word: 'x'.repeat(41) }))).toBe(false);
    expect(isPictureComplete(pic({ id: 'a', image: null }))).toBe(false);
  });
});

describe('duplicateWords (A33)', () => {
  it('finds words that appear twice, ignoring case and surrounding spaces; blank words are ignored', () => {
    const dup = duplicateWords([pic({ id: '1', word: 'Apple' }), pic({ id: '2', word: ' apple ' }), pic({ id: '3', word: 'fish' }), pic({ id: '4', word: '' }), pic({ id: '5', word: ' ' })]);
    expect([...dup]).toEqual(['apple']);
  });
  it('is empty when every word is different', () => {
    expect(duplicateWords([pic({ id: '1', word: 'fish' }), pic({ id: '2', word: 'house' })]).size).toBe(0);
  });
});

describe('readyCount (A33)', () => {
  it('counts distinct words of active, complete pictures: an inactive row and a duplicate do not count', () => {
    const rows = [
      pic({ id: 'fish' }),
      pic({ id: 'house' }),
      pic({ id: 'apple' }),
      pic({ id: 'Fish', word: 'Fish' }), // duplicate of fish
      pic({ id: 'star', active: false }), // off
      pic({ id: 'blank', word: '' }), // incomplete
    ];
    expect(readyCount(rows)).toBe(3);
    expect(readyCount([...rows, pic({ id: 'tree' })])).toBe(4);
  });
});

describe('loadPictures (A32)', () => {
  it('reads every row, inactive ones too, ordered by sort_order then created_at, as saved copies', async () => {
    const orders: string[] = [];
    const rows = [
      { id: 'p1', word: 'fish', image_path: 'seed/fish.svg', audio_path: null, active: true },
      { id: 'p2', word: 'star', image_path: 'library/star.png', audio_path: 'library/star.mp3', active: false },
    ];
    h.from.mockImplementation(() => ({
      select: () => ({ order: (c: string) => { orders.push(c); return { order: (c2: string) => { orders.push(c2); return Promise.resolve({ data: rows, error: null }); } }; } }),
    }));
    const out = await loadPictures();
    expect(h.from).toHaveBeenCalledWith('puzzle_pictures');
    expect(orders).toEqual(['sort_order', 'created_at']);
    expect(out).toEqual([
      { id: 'p1', isNew: false, word: 'fish', image: 'seed/fish.svg', audio: null, active: true },
      { id: 'p2', isNew: false, word: 'star', image: 'library/star.png', audio: 'library/star.mp3', active: false },
    ]);
  });
  it('throws the Supabase message on failure', async () => {
    h.from.mockImplementation(() => ({ select: () => ({ order: () => ({ order: () => Promise.resolve({ data: null, error: { message: 'nope' } }) }) }) }));
    await expect(loadPictures()).rejects.toThrow('nope');
  });
});

/** A fake table: records delete ids, upserts and per-row updates; `fail` makes one call return an error. */
function fakeTable(fail: 'upsert' | 'update' | 'delete' | null = null) {
  const calls = {
    deletes: [] as string[][],
    inserts: [] as Record<string, unknown>[][],
    upsertOptions: [] as unknown[],
    updates: [] as { id: string; patch: Record<string, unknown> }[],
  };
  const err = (op: string) => (fail === op ? { message: 'boom' } : null);
  h.from.mockImplementation(() => ({
    delete: () => ({ in: (_col: string, ids: string[]) => { calls.deletes.push(ids); return Promise.resolve({ error: err('delete') }); } }),
    upsert: (rows: Record<string, unknown>[], opts: unknown) => { calls.inserts.push(rows); calls.upsertOptions.push(opts); return Promise.resolve({ error: err('upsert') }); },
    update: (patch: Record<string, unknown>) => ({ eq: (_col: string, id: string) => { calls.updates.push({ id, patch }); return Promise.resolve({ error: err('update') }); } }),
  }));
  return calls;
}

describe('savePictures (A32)', () => {
  it('a mixed diff: one delete, one upsert of the new row, one update (the other rows are left alone)', async () => {
    const calls = fakeTable();
    const saved = [pic({ id: 'a', word: 'fish' }), pic({ id: 'b', word: 'house' }), pic({ id: 'c', word: 'apple' })];
    const draft: EPicture[] = [
      { ...saved[0], word: 'Fishy' }, // word changed
      saved[1], // unchanged, same index
      { id: 'n', isNew: true, image: 'library/star.png', word: '  star ', audio: null, active: true },
    ];
    expect(await savePictures(saved, draft)).toEqual({ error: null });
    expect(calls.deletes).toEqual([['c']]);
    expect(calls.inserts).toEqual([[{ id: 'n', word: 'star', image_path: 'library/star.png', audio_path: null, active: true, sort_order: 2 }]]);
    expect(calls.upsertOptions).toEqual([{ onConflict: 'id' }]);
    expect(calls.updates).toEqual([{ id: 'a', patch: { word: 'Fishy', image_path: 'seed/a.svg', audio_path: null, active: true, sort_order: 0 } }]);
  });

  it('updates a row whose order changed, and a row that was switched off or got a sound', async () => {
    const calls = fakeTable();
    const saved = [pic({ id: 'a' }), pic({ id: 'b' })];
    const draft = [saved[1], { ...saved[0], active: false, audio: 'library/a.mp3' }];
    await savePictures(saved, draft);
    expect(calls.deletes).toEqual([]);
    expect(calls.inserts).toEqual([]);
    expect(calls.updates.map((u) => u.id).sort()).toEqual(['a', 'b']);
    expect(calls.updates.find((u) => u.id === 'a')?.patch).toMatchObject({ active: false, audio_path: 'library/a.mp3', sort_order: 1 });
    expect(calls.updates.find((u) => u.id === 'b')?.patch).toMatchObject({ sort_order: 0 });
  });

  it('writes nothing when nothing changed', async () => {
    const calls = fakeTable();
    const saved = [pic({ id: 'a' })];
    expect(await savePictures(saved, [...saved])).toEqual({ error: null });
    expect(h.from).not.toHaveBeenCalled();
    expect(calls.updates).toEqual([]);
  });

  it('a new row sent again after a partial failure is upserted by id, so it does not clash with the row already there', async () => {
    const calls = fakeTable();
    const draft: EPicture[] = [{ id: 'n', isNew: true, image: 'library/star.png', word: 'star', audio: null, active: true }];
    await savePictures([], draft);
    expect(calls.upsertOptions).toEqual([{ onConflict: 'id' }]);
    expect(calls.inserts).toEqual([[{ id: 'n', word: 'star', image_path: 'library/star.png', audio_path: null, active: true, sort_order: 0 }]]);
  });

  it('reports a Supabase error as the message', async () => {
    fakeTable('upsert');
    const out = await savePictures([], [{ id: 'n', isNew: true, image: 'library/x.png', word: 'x', audio: null, active: true }]);
    expect(out).toEqual({ error: 'boom' });
  });
});
