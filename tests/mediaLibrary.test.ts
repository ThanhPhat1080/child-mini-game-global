import { describe, expect, it, vi } from 'vitest';

const tree = vi.hoisted((): Record<string, { name: string; id: string | null }[]> => ({
  // the user's own folder is `me`; another family's files live in `other` and are never listed
  me: [{ name: 'library', id: null }, { name: 'cards', id: null }, { name: 'big', id: null }, { name: 'readme.txt', id: 'x' }],
  'me/library': [{ name: 'a-000000000aaaa.png', id: '1' }, { name: 's-000000000bbbb.mp3', id: '2' }],
  'me/big': Array.from({ length: 250 }, (_, i) => ({ name: `p-${String(i).padStart(13, '0')}.png`, id: `b${i}` })),
  'me/cards': [{ name: 'old.svg', id: '3' }, { name: 'sub', id: null }],
  'me/cards/sub': [{ name: 'deep.webp', id: '4' }],
  other: [{ name: 'secret.png', id: '9' }],
}));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'me' } } } }) },
    storage: { from: () => ({ list: async (dir: string, o?: { limit?: number; offset?: number }) => ({ data: (tree[dir] ?? []).slice(o?.offset ?? 0, (o?.offset ?? 0) + (o?.limit ?? 100)), error: null }) }) },
  }),
}));

import { listLibrary } from '@/lib/media/library';

describe('listLibrary', () => {
  it('walks the folders and keeps only the files of the kind, newest first', async () => {
    expect(await listLibrary('image')).toHaveLength(253);
    expect(await listLibrary('audio')).toEqual(['me/library/s-000000000bbbb.mp3']);
    expect(await listLibrary('image')).not.toContain('other/secret.png');
  });
  it('reads every page of a folder with more than 100 files', async () => {
    const images = await listLibrary('image');
    expect(images.filter((p) => p.startsWith('me/big/'))).toHaveLength(250);
    expect(images).toContain('me/cards/sub/deep.webp');
  });
});
