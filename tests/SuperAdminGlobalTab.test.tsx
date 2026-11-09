import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ELevel } from '@/lib/spot/adminLevels';

// The Super Admin's Global tab (V8, V9): every global row whoever owns it, editable in place, hidden with Unpublish, never deleted.

const h = vi.hoisted(() => ({ loadLevels: vi.fn(), saveLevels: vi.fn(), unpublish: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({}) }));
vi.mock('@/lib/spot/adminLevels', async (orig) => ({
  ...(await orig<typeof import('@/lib/spot/adminLevels')>()),
  loadLevels: h.loadLevels,
  saveLevels: h.saveLevels,
}));
vi.mock('@/lib/spot/imageSize', () => ({ naturalSize: async () => ({ w: 400, h: 300 }) }));
vi.mock('@/lib/media/library', () => ({ listLibrary: vi.fn() }));
vi.mock('@/lib/media', async (orig) => ({
  ...(await orig<typeof import('@/lib/media')>()),
  clearPending: vi.fn(),
  mediaUrl: (p: string | null) => (p ? `/media/${p}` : null),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('@/lib/review', async (orig) => ({
  ...(await orig<typeof import('@/lib/review')>()),
  useMyRole: () => 'super_admin',
}));
vi.mock('@/lib/superAdmin', async (orig) => ({
  ...(await orig<typeof import('@/lib/superAdmin')>()),
  usePendingCounts: () => ({ sets: 0, cards: 0, spot: 0, find: 0 }),
  unpublishItem: h.unpublish,
}));

import SpotPage from '@/app/admin/(panel)/spot/page';

const three = [{ x: 0.2, y: 0.2, r: 0.06 }, { x: 0.5, y: 0.5, r: 0.06 }, { x: 0.8, y: 0.8, r: 0.06 }];
const level = (n: number, o: Partial<ELevel> = {}): ELevel => ({ id: `l${n}`, isNew: false, a: `spot/${n}a.png`, b: `spot/${n}b.png`, differences: three, active: true, visibility: 'global', superOwned: true, ...o });

beforeEach(() => {
  for (const f of Object.values(h)) f.mockReset();
  h.saveLevels.mockResolvedValue({ error: null, warning: null });
  h.unpublish.mockResolvedValue(undefined);
  h.loadLevels.mockResolvedValue([level(1)]);
  localStorage.setItem('childPlayer:scope', 'global');
});
afterEach(() => { cleanup(); localStorage.clear(); });

describe('Super Admin Global tab', () => {
  it('loads every global level, with Save and Revert but no Add level and no Delete', async () => {
    render(<SpotPage />);
    await screen.findByRole('article', { name: 'Level 1' });
    expect(h.loadLevels).toHaveBeenLastCalledWith('global');
    expect(screen.getByRole('tab', { name: 'Global' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Add level' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete level 1' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unpublish' })).toBeTruthy();
  });

  it('Save sends the Global scope, so the play order is left alone', async () => {
    render(<SpotPage />);
    await screen.findByRole('article', { name: 'Level 1' });
    fireEvent.click(screen.getByLabelText('Level 1 on'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(h.saveLevels).toHaveBeenCalled());
    expect(h.saveLevels.mock.calls[0][2]).toBe('global');
  });

  it('Unpublish hides the level from the list and does not delete it', async () => {
    render(<SpotPage />);
    await screen.findByRole('article', { name: 'Level 1' });
    fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Level 1' })).toBeNull());
    expect(h.unpublish).toHaveBeenCalledWith('spot_levels', 'l1');
    expect(h.saveLevels).not.toHaveBeenCalled();
  });
});
