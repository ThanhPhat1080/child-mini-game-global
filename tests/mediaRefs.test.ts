import { beforeEach, describe, expect, it, vi } from 'vitest';

// A tiny in-memory stand-in for the parts of the Supabase client that removeMedia and referencedPaths use.
const db = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  offline: false,
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
    storage: { from: () => ({ remove: db.remove, upload: vi.fn(), getPublicUrl: (p: string) => ({ data: { publicUrl: p } }) }) },
  }),
}));

import { MEDIA_SOURCES, referencedPaths } from '@/lib/media/refs';
import { removeMedia } from '@/lib/media';

beforeEach(() => {
  db.rows = {};
  db.offline = false;
  db.remove.mockReset().mockResolvedValue({ error: null });
});

describe('MEDIA_SOURCES', () => {
  it('lists every column that can point at a bucket file', () => {
    const cols = MEDIA_SOURCES.map((s) => `${s.table}.${s.column}`);
    for (const c of [
      'settings.greeting_path', 'settings.music_path', 'settings.avatar_path',
      'settings.hooray_path', 'settings.ohoh_path', 'settings.complete_path',
      'quiz_sets.cover_path', 'questions.prompt_image_path', 'questions.prompt_audio_path',
      'answers.image_path', 'memory_cards.image_path', 'memory_cards.audio_path',
      'spot_levels.image_a_path', 'spot_levels.image_b_path', 'find_levels.image_path',
    ]) expect(cols).toContain(c);
    expect(MEDIA_SOURCES.find((s) => s.table === 'find_levels' && s.column === 'objects')).toMatchObject({ kind: 'audio' });
  });
});

describe('referencedPaths', () => {
  const cases: [string, string, Record<string, unknown>, string][] = [
    ['settings', 'greeting_path', { id: 1, greeting_path: 'audio/g.mp3' }, 'audio/g.mp3'],
    ['settings', 'avatar_path', { id: 1, avatar_path: 'img/avatar.png' }, 'img/avatar.png'],
    ['settings', 'complete_path', { id: 1, complete_path: 'sfx/done.mp3' }, 'sfx/done.mp3'],
    ['quiz_sets', 'cover_path', { id: 'q', cover_path: 'covers/c.png' }, 'covers/c.png'],
    ['questions', 'prompt_image_path', { id: 'p', prompt_image_path: 'questions/p.png' }, 'questions/p.png'],
    ['questions', 'prompt_audio_path', { id: 'p', prompt_audio_path: 'voices/v.mp3' }, 'voices/v.mp3'],
    ['answers', 'image_path', { id: 'a', image_path: 'answers/a.png' }, 'answers/a.png'],
    ['memory_cards', 'image_path', { id: 'm', image_path: 'cards/m.png' }, 'cards/m.png'],
    ['memory_cards', 'audio_path', { id: 'm', image_path: 'x.png', audio_path: 'cards/m.mp3' }, 'cards/m.mp3'],
    ['spot_levels', 'image_a_path', { id: 's', image_a_path: 'spot/a.png', image_b_path: 'spot/b.png' }, 'spot/a.png'],
    ['spot_levels', 'image_b_path', { id: 's', image_a_path: 'spot/a.png', image_b_path: 'spot/b.png' }, 'spot/b.png'],
    ['find_levels', 'image_path', { id: 'f', image_path: 'find/f.png', objects: [] }, 'find/f.png'],
  ];

  it.each(cases)('reports a path used by %s.%s as referenced', async (table, _col, row, path) => {
    db.rows = { [table]: [row] };
    expect(await referencedPaths([path])).toEqual(new Set([path]));
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
    expect(await referencedPaths(['find/cup.mp3'])).toEqual(new Set(['find/cup.mp3']));
  });

  it('does not report an unused path, and returns only the referenced subset', async () => {
    db.rows = { memory_cards: [{ id: 'm', image_path: 'cards/used.png', audio_path: null }] };
    expect(await referencedPaths(['cards/used.png', 'cards/unused.png'])).toEqual(new Set(['cards/used.png']));
  });

  it('returns an empty set for no paths', async () => {
    expect(await referencedPaths([])).toEqual(new Set());
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
