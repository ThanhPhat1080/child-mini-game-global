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

import { addPending, clearPending, commitPendingMap } from '@/lib/media';
import { cardMediaPaths, duplicateWords, isCardComplete, loadCards, newCard, saveCards, type ECard } from '@/lib/memory/adminCards';

const card = (o: Partial<ECard> = {}): ECard => ({ id: 'c1', isNew: false, word: 'cat', image: 'cards/1.png', audio: null, active: true, groupId: null, ...o });
const file = (name: string, type = 'image/png') => new File(['x'], name, { type });

beforeEach(() => {
  h.log.length = 0;
  h.upload.mockReset().mockImplementation(async () => { h.log.push('upload'); return { error: null }; });
  h.remove.mockReset().mockImplementation(async () => { h.log.push('remove'); return { error: null }; });
  h.upsert.mockReset().mockImplementation(async () => { h.log.push('upsert'); return { error: null }; });
  h.del.mockReset().mockImplementation(async () => { h.log.push('delete'); return { error: null }; });
  h.selectResult = { data: null, error: null };
  h.order.mockReset().mockImplementation(() => Promise.resolve(h.selectResult));
  h.select.mockReset().mockImplementation(() => ({ order: h.order }));
  h.from.mockReset().mockImplementation(() => ({ select: h.select, upsert: h.upsert, delete: () => ({ in: h.del }) }));
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:p-${++n}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => clearPending());

describe('newCard', () => {
  it('is a new, active, empty card with a fresh id', () => {
    const a = newCard();
    expect(a).toMatchObject({ isNew: true, active: true, word: '', image: null, audio: null, groupId: null });
    expect(a.id).not.toBe(newCard().id);
  });
});

describe('isCardComplete', () => {
  it('needs a trimmed word of 1-40 characters and an image', () => {
    expect(isCardComplete(card())).toBe(true);
    expect(isCardComplete(card({ word: 'a'.repeat(40) }))).toBe(true);
    expect(isCardComplete(card({ word: '' }))).toBe(false);
    expect(isCardComplete(card({ word: '   ' }))).toBe(false);
    expect(isCardComplete(card({ word: 'a'.repeat(41) }))).toBe(false);
    expect(isCardComplete(card({ image: null }))).toBe(false);
  });
});

describe('duplicateWords', () => {
  it('finds words that repeat ignoring case and spaces, and ignores blanks', () => {
    const d = duplicateWords([card({ word: 'Apple' }), card({ word: ' apple ' }), card({ word: 'pear' }), card({ word: '' }), card({ word: ' ' })]);
    expect([...d]).toEqual(['apple']);
  });
});

describe('cardMediaPaths', () => {
  it('returns only bucket paths', () => {
    expect(cardMediaPaths(card({ image: 'cards/a.png', audio: 'card-voices/a.mp3' }))).toEqual(['cards/a.png', 'card-voices/a.mp3']);
    expect(cardMediaPaths(card({ image: 'seed/a.svg', audio: 'pending:x' }))).toEqual([]);
    expect(cardMediaPaths(card({ image: 'https://x.test/a.png', audio: null }))).toEqual([]);
  });
});

describe('loadCards', () => {
  it('selects and maps group_id, keeping null as null', async () => {
    h.selectResult = { data: [
      { id: 'a', word: 'cat', image_path: 'cards/a.png', audio_path: null, active: true, group_id: 'g1', owner_id: 'me', visibility: 'private' },
      { id: 'b', word: 'dog', image_path: 'cards/b.png', audio_path: null, active: true, group_id: null, owner_id: 'me', visibility: 'private' },
    ], error: null };
    const cards = await loadCards();
    expect(cards.map((c) => c.groupId)).toEqual(['g1', null]);
    expect(h.select.mock.calls[0][0]).toContain('group_id');
  });
  it('reads all cards ordered by created_at and maps the columns', async () => {
    h.selectResult = { data: [{ id: 'a', word: 'cat', image_path: 'cards/a.png', audio_path: null, active: false, group_id: null, owner_id: 'me', visibility: 'private' }], error: null };
    await expect(loadCards()).resolves.toEqual([{ id: 'a', isNew: false, word: 'cat', image: 'cards/a.png', audio: null, active: false, groupId: null, visibility: 'private' }]);
    expect(h.from).toHaveBeenCalledWith('memory_cards');
    expect(h.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });
  it('throws the Supabase error message', async () => {
    h.selectResult = { data: null, error: { message: 'boom' } };
    await expect(loadCards()).rejects.toThrow('boom');
  });
});

describe('loadCards ownership (V1)', () => {
  it("keeps only the signed-in user's own cards, so a global card of another family is never edited", async () => {
    h.selectResult = { data: [
      { id: 'a', word: 'cat', image_path: 'x.png', audio_path: null, active: true, group_id: null, owner_id: 'me', visibility: 'global' },
      { id: 'b', word: 'dog', image_path: 'y.png', audio_path: null, active: true, group_id: null, owner_id: 'other', visibility: 'global' },
    ], error: null };
    expect((await loadCards()).map((c) => c.id)).toEqual(['a']);
  });
});

describe('saveCards locked rows (V2, V3)', () => {
  it('does not write cards under review or global, but writes private ones', async () => {
    const mk = (id: string, visibility: 'private' | 'pending' | 'global') =>
      ({ id, isNew: false, word: 'w' + id, image: 'cards/x.png', audio: null, active: true, groupId: null, visibility });
    const all = [mk('p', 'private'), mk('q', 'pending'), mk('g', 'global')];
    await saveCards(all, all);
    const rows = h.upsert.mock.calls[0][0] as { id: string }[];
    expect(rows.map((r) => r.id)).toEqual(['p']);
  });
});

describe('commitPendingMap', () => {
  it('uploads each token into its folder and returns token -> path', async () => {
    const a = addPending(file('a.png'));
    const b = addPending(file('b.mp3', 'audio/mpeg'));
    const out = await commitPendingMap(new Map([[a, 'cards'], [b, 'card-voices']]));
    expect(out.get(a)).toMatch(/^cards\/[A-Za-z0-9-]*-[0-9a-z]{13}\.png$/);
    expect(out.get(b)).toMatch(/^card-voices\/[A-Za-z0-9-]*-[0-9a-z]{13}\.mp3$/);
  });
  it('removes what it uploaded and rethrows when one fails', async () => {
    h.upload.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: 'boom' } });
    const a = addPending(file('a.png'));
    const b = addPending(file('b.png'));
    await expect(commitPendingMap(new Map([[a, 'cards'], [b, 'cards']]))).rejects.toThrow('boom');
    expect(h.remove).toHaveBeenCalledTimes(1);
    expect(h.remove.mock.calls[0][0]).toHaveLength(1);
  });
});

describe('saveCards', () => {
  it('uploads first, then writes the table, then removes old files', async () => {
    const saved = [card({ id: 'a', image: 'cards/old.png' })];
    const draft = [card({ id: 'a', image: addPending(file('new.png')) })];
    const r = await saveCards(saved, draft);
    expect(r).toEqual({ error: null, warning: null });
    expect(h.log).toEqual(['upload', 'upsert', 'remove']);
    expect(h.remove.mock.calls[0][0]).toEqual(['cards/old.png']);
    const row = h.upsert.mock.calls[0][0][0];
    expect(row.image_path).toMatch(/^cards\/[A-Za-z0-9-]*-[0-9a-z]{13}\.png$/);
    expect(h.upsert.mock.calls[0][1]).toEqual({ onConflict: 'id' });
  });

  it('removes only replaced, removed and deleted-card files, never seed or links', async () => {
    const saved = [
      card({ id: 'keep', image: 'cards/keep.png', audio: 'card-voices/keep.mp3' }),
      card({ id: 'edit', image: 'cards/edit-old.png', audio: 'card-voices/edit.mp3' }),
      card({ id: 'gone', image: 'cards/gone.png', audio: 'card-voices/gone.mp3' }),
      card({ id: 'seed', image: 'seed/x.svg', audio: 'https://x.test/a.mp3' }),
    ];
    const draft = [
      card({ id: 'keep', image: 'cards/keep.png', audio: 'card-voices/keep.mp3' }),
      card({ id: 'edit', image: addPending(file('n.png')), audio: null }),
      card({ id: 'seed', image: 'seed/x.svg', audio: 'https://x.test/a.mp3' }),
    ];
    const r = await saveCards(saved, draft);
    expect(r).toEqual({ error: null, warning: null });
    expect([...h.remove.mock.calls[0][0]].sort()).toEqual(['card-voices/edit.mp3', 'card-voices/gone.mp3', 'cards/edit-old.png', 'cards/gone.png']);
  });

  it('deletes cards that are in saved but not in draft from the table', async () => {
    await saveCards([card({ id: 'a' }), card({ id: 'b' })], [card({ id: 'a' })]);
    expect(h.del).toHaveBeenCalledWith('id', ['b']);
    expect(h.log.indexOf('delete')).toBeLessThan(h.log.indexOf('upsert'));
  });

  it('saves the word trimmed', async () => {
    await saveCards([], [card({ id: 'a', word: '  Apple  ' })]);
    expect(h.upsert.mock.calls[0][0][0]).toEqual({ id: 'a', word: 'Apple', image_path: 'cards/1.png', audio_path: null, active: true, group_id: null });
  });

  it('upserts group_id, null for a card without a group', async () => {
    await saveCards([], [card({ id: 'a', groupId: 'g1' }), card({ id: 'b' })]);
    const rows = h.upsert.mock.calls[0][0];
    expect(rows[0].group_id).toBe('g1');
    expect(rows[1].group_id).toBeNull();
  });

  it('writes nothing and removes uploaded files when an upload fails', async () => {
    h.upload.mockImplementationOnce(async () => { h.log.push('upload'); return { error: null }; })
      .mockImplementationOnce(async () => ({ error: { message: 'boom' } }));
    const draft = [card({ id: 'a', image: addPending(file('a.png')), audio: addPending(file('a.mp3', 'audio/mpeg')) })];
    const r = await saveCards([card({ id: 'a', image: 'cards/old.png' })], draft);
    expect(r).toEqual({ error: 'boom', warning: null });
    expect(h.upsert).not.toHaveBeenCalled();
    expect(h.del).not.toHaveBeenCalled();
    expect(h.remove).toHaveBeenCalledTimes(1);
    expect(h.remove.mock.calls[0][0]).toHaveLength(1);
    expect(h.remove.mock.calls[0][0]).not.toContain('cards/old.png');
  });

  it('keeps old files and removes this attempt\'s uploads when the database fails', async () => {
    h.upsert.mockImplementationOnce(async () => ({ error: { message: 'db down' } }));
    const draft = [card({ id: 'a', image: addPending(file('a.png')) })];
    const r = await saveCards([card({ id: 'a', image: 'cards/old.png' }), card({ id: 'b', image: 'cards/b.png' })], draft);
    expect(r).toEqual({ error: 'db down', warning: null });
    expect(h.remove).toHaveBeenCalledTimes(1);
    const removed = h.remove.mock.calls[0][0] as string[];
    expect(removed).toHaveLength(1);
    expect(removed[0]).toMatch(/^cards\/[A-Za-z0-9-]+-/);
  });

  it('keeps old files when the table delete fails', async () => {
    h.del.mockImplementationOnce(async () => ({ error: { message: 'nope' } }));
    const r = await saveCards([card({ id: 'a' }), card({ id: 'b', image: 'cards/b.png' })], [card({ id: 'a' })]);
    expect(r).toEqual({ error: 'nope', warning: null });
    expect(h.upsert).not.toHaveBeenCalled();
    expect(h.remove).not.toHaveBeenCalled();
  });

  it('returns a warning, not an error, when only the file cleanup fails', async () => {
    h.remove.mockImplementationOnce(async () => ({ error: { message: 'storage' } }));
    const r = await saveCards([card({ id: 'a', image: 'cards/old.png' })], [card({ id: 'a', image: 'cards/new.png' })]);
    expect(r).toEqual({ error: null, warning: 'The cards were saved, but some old files could not be removed from storage.' });
  });
});
