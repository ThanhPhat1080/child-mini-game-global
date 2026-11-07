import { beforeEach, describe, expect, it, vi } from 'vitest';

// A fake bucket: folders have id null (as Supabase Storage lists them), files have an id.
const OWNER_A = '11111111-1111-4111-8111-111111111111';
const OWNER_B = '22222222-2222-4222-8222-222222222222';
const tree: Record<string, { name: string; id: string | null }[]> = {
  '': [{ name: OWNER_A, id: null }, { name: OWNER_B, id: null }, { name: 'seed', id: null }],
  [OWNER_A]: [{ name: 'a.png', id: 'f1' }, { name: 'sub', id: null }, { name: 'song.mp3', id: 'f2' }],
  [`${OWNER_A}/sub`]: [{ name: 'b.png', id: 'f3' }],
  [OWNER_B]: [{ name: 'c.png', id: 'f4' }, { name: 'd.mp3', id: 'f5' }],
  seed: [{ name: 'bundled.png', id: 'f6' }],
};

const h = vi.hoisted(() => ({ me: '' as string | null }));
vi.mock('@/lib/review', () => ({ getMyUserId: async () => h.me }));
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    storage: {
      from: () => ({
        list: async (dir: string) => ({ data: tree[dir] ?? [], error: null }),
      }),
    },
  }),
}));

import { listLibrary } from '@/lib/media/library';

beforeEach(() => {
  h.me = OWNER_A;
});

describe('listLibrary scope (Media page)', () => {
  it('own (default): only the signed-in user\'s folder, sub-folders included', async () => {
    const images = await listLibrary('image');
    expect(images.sort()).toEqual([`${OWNER_A}/a.png`, `${OWNER_A}/sub/b.png`].sort());
    expect(await listLibrary('audio')).toEqual([`${OWNER_A}/song.mp3`]);
  });

  it('all: every owner folder, but not the bundled or other top-level folders', async () => {
    const images = await listLibrary('image', 'all');
    expect(images.sort()).toEqual([`${OWNER_A}/a.png`, `${OWNER_A}/sub/b.png`, `${OWNER_B}/c.png`].sort());
    expect(await listLibrary('audio', 'all')).toEqual(expect.arrayContaining([`${OWNER_A}/song.mp3`, `${OWNER_B}/d.mp3`]));
    expect(images.some((p) => p.startsWith('seed/'))).toBe(false);
  });

  it('without a session it lists nothing', async () => {
    h.me = null;
    expect(await listLibrary('image', 'all')).toEqual([]);
  });
});
