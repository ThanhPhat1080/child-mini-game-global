import { beforeEach, describe, expect, it, vi } from 'vitest';

// A tiny in-memory stand-in for the parts of the Supabase client that removeMedia and referencedPaths use.
const db = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  offline: false,
  rpcCalls: [] as [string, string][],
  remove: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    from: (table: string) => {
      const all = () => db.rows[table] ?? [];
      return {
        select: () => ({
          // `.select(col).in(col, paths)`: rows whose column is one of the paths.
          in: async (col: string, vals: unknown[]) => {
            if (db.offline) throw new Error('offline');
            return { data: all().filter((r) => vals.includes(r[col])), error: null };
          },
          // `.select(col)` awaited directly: every row (used for find_levels.objects).
          then: (onOk: (v: unknown) => unknown, onErr: (e: unknown) => unknown) => {
            if (db.offline) return Promise.reject(new Error('offline')).then(onOk, onErr);
            return Promise.resolve({ data: all(), error: null }).then(onOk, onErr);
          },
        }),
      };
    },
    // The database function media_in_use: true when any row of any table (any owner) holds the path.
    rpc: async (name: string, args: { p_path: string }) => {
      if (db.offline) throw new Error('offline');
      db.rpcCalls.push([name, args.p_path]);
      const used = Object.values(db.rows).some((rows) => rows.some((r) => Object.values(r).some((v) =>
        v === args.p_path || (Array.isArray(v) && v.some((o) => (o as { audio_path?: string } | null)?.audio_path === args.p_path)))));
      return { data: used, error: null };
    },
    storage: { from: () => ({ remove: db.remove, upload: vi.fn(), getPublicUrl: (p: string) => ({ data: { publicUrl: p } }) }) },
  }),
}));

import { MEDIA_SOURCES, referencedPaths, referencedPathsByScan } from '@/lib/media/refs';
import { deleteMedia, isMediaInUse, removeMedia } from '@/lib/media';

beforeEach(() => {
  db.rows = {};
  db.offline = false;
  db.remove.mockReset().mockResolvedValue({ error: null });
});

describe('MEDIA_SOURCES', () => {
  it('lists every column that can point at a bucket file', () => {
    const cols = MEDIA_SOURCES.map((s) => `${s.table}.${s.column}`);
    for (const c of [
      'child_settings.greeting_path', 'child_settings.music_path', 'children.avatar_path',
      'child_settings.hooray_path', 'child_settings.ohoh_path', 'child_settings.complete_path',
      'quiz_sets.cover_path', 'questions.prompt_image_path', 'questions.prompt_audio_path',
      'answers.image_path', 'memory_cards.image_path', 'memory_cards.audio_path',
      'spot_levels.image_a_path', 'spot_levels.image_b_path', 'find_levels.image_path',
      'puzzle_pictures.image_path', 'puzzle_pictures.audio_path',
    ]) expect(cols).toContain(c);
    expect(MEDIA_SOURCES.find((s) => s.table === 'find_levels' && s.column === 'objects')).toMatchObject({ kind: 'audio' });
  });
});

describe('referencedPathsByScan (client-side column scan)', () => {
  const cases: [string, string, Record<string, unknown>, string][] = [
    ['child_settings', 'greeting_path', { child_id: 'c', greeting_path: 'audio/g.mp3' }, 'audio/g.mp3'],
    ['children', 'avatar_path', { id: 'c', avatar_path: 'img/avatar.png' }, 'img/avatar.png'],
    ['child_settings', 'complete_path', { child_id: 'c', complete_path: 'sfx/done.mp3' }, 'sfx/done.mp3'],
    ['quiz_sets', 'cover_path', { id: 'q', cover_path: 'covers/c.png' }, 'covers/c.png'],
    ['questions', 'prompt_image_path', { id: 'p', prompt_image_path: 'questions/p.png' }, 'questions/p.png'],
    ['questions', 'prompt_audio_path', { id: 'p', prompt_audio_path: 'voices/v.mp3' }, 'voices/v.mp3'],
    ['answers', 'image_path', { id: 'a', image_path: 'answers/a.png' }, 'answers/a.png'],
    ['memory_cards', 'image_path', { id: 'm', image_path: 'cards/m.png' }, 'cards/m.png'],
    ['memory_cards', 'audio_path', { id: 'm', image_path: 'x.png', audio_path: 'cards/m.mp3' }, 'cards/m.mp3'],
    ['spot_levels', 'image_a_path', { id: 's', image_a_path: 'spot/a.png', image_b_path: 'spot/b.png' }, 'spot/a.png'],
    ['spot_levels', 'image_b_path', { id: 's', image_a_path: 'spot/a.png', image_b_path: 'spot/b.png' }, 'spot/b.png'],
    ['find_levels', 'image_path', { id: 'f', image_path: 'find/f.png', objects: [] }, 'find/f.png'],
    ['puzzle_pictures', 'image_path', { id: 'z', image_path: 'puzzle/z.png' }, 'puzzle/z.png'],
    ['puzzle_pictures', 'audio_path', { id: 'z', image_path: 'x.png', audio_path: 'puzzle/z.mp3' }, 'puzzle/z.mp3'],
  ];

  it.each(cases)('reports a path used by %s.%s as referenced', async (table, _col, row, path) => {
    db.rows = { [table]: [row] };
    expect(await referencedPathsByScan([path])).toEqual(new Set([path]));
  });

  it('reports a find object sound as referenced (objects[].audio_path)', async () => {
    db.rows = {
      find_levels: [{
        id: 'f',
        image_path: 'find/f.png',
        objects: [
          { x: 0.2, y: 0.2, r: 0.06, word: 'cup', audio_path: 'find/cup.mp3' },
          { x: 0.5, y: 0.5, r: 0.06, word: 'hat' },
        ],
      }],
    };
    expect(await referencedPathsByScan(['find/cup.mp3'])).toEqual(new Set(['find/cup.mp3']));
  });

  it('does not report an unused path, and returns only the referenced subset', async () => {
    db.rows = { memory_cards: [{ id: 'm', image_path: 'cards/used.png', audio_path: null }] };
    expect(await referencedPathsByScan(['cards/used.png', 'cards/unused.png'])).toEqual(new Set(['cards/used.png']));
  });

  it('returns an empty set for no paths', async () => {
    expect(await referencedPathsByScan([])).toEqual(new Set());
  });

  it('throws when a query fails, so callers can keep files', async () => {
    db.offline = true;
    await expect(referencedPaths(['cards/x.png'])).rejects.toThrow('offline');
  });
});

describe('removeMedia with the reference guard', () => {
  it('removes only the unreferenced file when one of two is still used', async () => {
    db.rows = { memory_cards: [{ id: 'm', image_path: 'cards/a.png', audio_path: null }] };
    expect(await removeMedia(['cards/a.png', 'cards/b.png'])).toBeNull();
    expect(db.remove).toHaveBeenCalledTimes(1);
    expect(db.remove).toHaveBeenCalledWith(['cards/b.png']);
  });

  it('removes nothing and returns null when every file is still used', async () => {
    db.rows = { spot_levels: [{ id: 's', image_a_path: 'spot/a.png', image_b_path: 'spot/b.png' }] };
    expect(await removeMedia(['spot/a.png', 'spot/b.png'])).toBeNull();
    expect(db.remove).not.toHaveBeenCalled();
  });

  it('removes nothing and returns null when the reference check throws (files are kept)', async () => {
    db.offline = true;
    expect(await removeMedia(['cards/a.png'])).toBeNull();
    expect(db.remove).not.toHaveBeenCalled();
  });

  it('never sends seed, pending or external paths to the bucket, and does not check them', async () => {
    expect(await removeMedia(['seed/apple.svg', 'pending:123', 'https://cdn.example/x.png', null, undefined])).toBeNull();
    expect(db.remove).not.toHaveBeenCalled();
  });

  it('keeps bundled and external paths out of a mixed list', async () => {
    expect(await removeMedia(['seed/apple.svg', 'cards/gone.png', 'https://cdn.example/x.png'])).toBeNull();
    expect(db.remove).toHaveBeenCalledWith(['cards/gone.png']);
  });

  it('returns the storage error message when the remove itself fails', async () => {
    db.remove.mockResolvedValueOnce({ error: { message: 'bucket down' } });
    expect(await removeMedia(['cards/gone.png'])).toBe('bucket down');
  });
});

// Q6: the delete guard asks the database, which sees every owner's content.
describe('referencedPaths (media_in_use)', () => {
  beforeEach(() => { db.rows = {}; db.offline = false; db.rpcCalls = []; });

  it("is true for a path used only by another owner's row, which a client query could not see", async () => {
    db.rows = { memory_cards: [{ image_path: 'other/cards/a.png', owner_id: 'other' }] };
    expect(await referencedPaths(['other/cards/a.png', 'me/cards/free.png'])).toEqual(new Set(['other/cards/a.png']));
    expect(db.rpcCalls).toEqual([['media_in_use', 'other/cards/a.png'], ['media_in_use', 'me/cards/free.png']]);
  });

  it('asks once per distinct path and throws when the check fails', async () => {
    await referencedPaths(['a', 'a', 'b']);
    expect(db.rpcCalls).toHaveLength(2);
    db.offline = true;
    await expect(referencedPaths(['a'])).rejects.toThrow();
  });

  it('delete is blocked: removeMedia keeps a file media_in_use reports as used', async () => {
    db.remove.mockReset().mockResolvedValue({ error: null });
    db.rows = { find_levels: [{ objects: [{ audio_path: 'other/find/cat.mp3' }] }] };
    await removeMedia(['other/find/cat.mp3']);
    expect(db.remove).not.toHaveBeenCalled();
  });
});

describe('library delete guard (Q6)', () => {
  beforeEach(() => { db.rows = {}; db.offline = false; db.rpcCalls = []; db.remove.mockReset().mockResolvedValue({ error: null }); });

  it('delete is blocked when media_in_use returns true, and allowed when it returns false', async () => {
    db.rows = { memory_cards: [{ image_path: 'other/cards/used.png' }] };
    expect(await isMediaInUse('other/cards/used.png')).toBe(true);
    expect(await deleteMedia('other/cards/used.png')).toBe(false);
    expect(db.remove).not.toHaveBeenCalled();
    expect(await deleteMedia('me/cards/free.png')).toBe(true);
    expect(db.remove).toHaveBeenCalledWith(['me/cards/free.png']);
  });
});
