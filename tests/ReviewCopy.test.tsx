import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Spec 2026-11-06-review-copy (V8-V13): copies, role-aware locks and tabs, publish own, Global copy badge.

const h = vi.hoisted(() => ({ rpc: vi.fn(), rows: [] as unknown[], role: 'super_admin' as 'super_admin' | 'parent' | null }));
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    rpc: h.rpc,
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'sa' } } } }) },
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: h.rows, error: null }),
        eq: () => ({ in: () => Promise.resolve({ data: [], error: null }), order: () => Promise.resolve({ data: [], error: null }) }),
      }),
    }),
  }),
}));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null) => (p ? `/media/${p}` : null) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('@/lib/review', async (orig) => ({
  ...(await orig<typeof import('@/lib/review')>()),
  useMyRole: () => h.role,
  getMyRole: async () => h.role,
}));
vi.mock('@/lib/superAdmin', async (orig) => ({
  ...(await orig<typeof import('@/lib/superAdmin')>()),
  parentNames: async () => new Map([['p1', 'Lan']]),
  usePendingCounts: () => ({ sets: 1, cards: 0, spot: 0, find: 0 }),
}));

import { ContentTabs } from '@/components/admin/ContentTabs';
import { ShareToggle } from '@/components/admin/ShareToggle';
import { VisibilityBadge } from '@/components/admin/VisibilityBadge';
import { dropOwnCopies, isLocked, lockedOwn, validScope } from '@/lib/review';
import { approveItem, pendingCounts, PENDING_CHANGED, publishOwn } from '@/lib/superAdmin';
import SetsPage from '@/app/admin/(panel)/sets/page';

beforeEach(() => {
  h.rpc.mockReset().mockResolvedValue({ error: null, data: null });
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('scope and lock rules (V8, V9)', () => {
  it('a stored scope the role may not use falls back to Mine', () => {
    expect(validScope('queue', 'parent')).toBe('mine');
    expect(validScope('global', 'super_admin')).toBe('mine');
    expect(validScope('parents', 'super_admin')).toBe('parents');
    expect(validScope('global', 'parent')).toBe('global');
    expect(validScope(null, null)).toBe('mine');
  });

  it("a Super Admin's own row is never locked; someone else's is", () => {
    expect(isLocked('global', 'sa', 'sa', 'super_admin')).toBe(false);
    expect(isLocked('private', 'sa', 'sa', 'super_admin')).toBe(false);
    expect(isLocked('global', 'p1', 'sa', 'super_admin')).toBe(true);
    // A parent keeps the current rule.
    expect(isLocked('global', 'p1', 'p1', 'parent')).toBe(true);
    expect(isLocked('private', 'p1', 'p1', 'parent')).toBe(false);
  });

  it('lockedOwn: own rows are locked unless private or the Super Admin owns them', () => {
    expect(lockedOwn('pending', false)).toBe(true);
    expect(lockedOwn('global', false)).toBe(true);
    expect(lockedOwn('private', false)).toBe(false);
    expect(lockedOwn('global', true)).toBe(false);
    expect(lockedOwn(undefined, false)).toBe(false);
  });

  it("dropOwnCopies drops the copy of the family's own row, keeps other families' copies", () => {
    const rows = [
      { id: 'o1', owner_id: 'me', source_id: null },
      { id: 'copy-of-o1', owner_id: 'sa', source_id: 'o1' },
      { id: 'copy-of-other', owner_id: 'sa', source_id: 'x9' },
      { id: 'g1', owner_id: 'sa', source_id: null },
    ];
    expect(dropOwnCopies(rows, 'me').map((r) => r.id)).toEqual(['o1', 'copy-of-other', 'g1']);
    expect(dropOwnCopies(rows, null)).toEqual(rows);
  });
});

describe('tabs per role (V9)', () => {
  it('a Super Admin gets Mine, Review queue (with the count) and Parent published', () => {
    render(<ContentTabs scope="mine" onChange={() => undefined} role="super_admin" pending={2} />);
    expect(screen.getByRole('tab', { name: 'Mine' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Review queue, 2 pending' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Parent published' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Global' })).toBeNull();
  });

  it('the review tab has no dot and no count when nothing waits', () => {
    render(<ContentTabs scope="mine" onChange={() => undefined} role="super_admin" pending={0} />);
    expect(screen.getByRole('tab', { name: 'Review queue' })).toBeTruthy();
  });

  it('a parent gets Mine and Global only', () => {
    const onChange = vi.fn();
    render(<ContentTabs scope="mine" onChange={onChange} role="parent" />);
    expect(screen.queryByRole('tab', { name: 'Review queue' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Global' }));
    expect(onChange).toHaveBeenCalledWith('global');
  });
});

describe('a Super Admin row (V10)', () => {
  it('a private row offers Publish to everyone, which calls publish_own', async () => {
    const changed = vi.fn();
    render(<ShareToggle table="spot_levels" id="l1" visibility="private" superOwned onChanged={changed} />);
    expect(screen.queryByRole('switch')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Publish to everyone' }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('publish_own', { p_table: 'spot_levels', p_id: 'l1' }));
    await waitFor(() => expect(changed).toHaveBeenCalledWith('global'));
  });

  it('a global row offers Unpublish, which calls unpublish_item', async () => {
    const changed = vi.fn();
    render(<ShareToggle table="find_levels" id="f1" visibility="global" superOwned onChanged={changed} />);
    expect(screen.queryByRole('button', { name: 'Request edit' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('unpublish_item', { p_table: 'find_levels', p_id: 'f1' }));
    await waitFor(() => expect(changed).toHaveBeenCalledWith('private'));
  });

  it('a failed publish shows the message and does not change the state', async () => {
    h.rpc.mockResolvedValue({ error: { message: 'quiz set 1 has 1 incomplete question(s)' } });
    const changed = vi.fn();
    render(<ShareToggle table="quiz_sets" id="q1" visibility="private" superOwned onChanged={changed} />);
    fireEvent.click(screen.getByRole('button', { name: 'Publish to everyone' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(changed).not.toHaveBeenCalled();
  });

  it('a parent row keeps the share switch, not publish', () => {
    render(<ShareToggle table="memory_cards" id="c1" visibility="private" />);
    expect(screen.getByRole('switch', { name: 'Share with all children' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Publish to everyone' })).toBeNull();
  });
});

describe('Global copy badge (V10)', () => {
  it('shows Global copy beside the status on a parent row that a Super Admin copied', () => {
    render(<VisibilityBadge visibility="private" copied />);
    expect(screen.getByText('Global copy')).toBeTruthy();
    expect(screen.getByText('Private')).toBeTruthy();
  });

  it('no badge without a copy', () => {
    render(<VisibilityBadge visibility="private" />);
    expect(screen.queryByText('Global copy')).toBeNull();
  });
});

describe('Super Admin database calls (V8, V10, V3)', () => {
  it('approveItem returns the copy id and announces the change', async () => {
    h.rpc.mockResolvedValue({ error: null, data: 'copy-1' });
    const listener = vi.fn();
    window.addEventListener(PENDING_CHANGED, listener);
    try {
      expect(await approveItem('memory_cards', 'c1')).toBe('copy-1');
      expect(h.rpc).toHaveBeenCalledWith('review_approve', { p_table: 'memory_cards', p_id: 'c1' });
      expect(listener).toHaveBeenCalled();
    } finally {
      window.removeEventListener(PENDING_CHANGED, listener);
    }
  });

  it('publishOwn calls publish_own', async () => {
    await publishOwn('quiz_sets', 'q1');
    expect(h.rpc).toHaveBeenCalledWith('publish_own', { p_table: 'quiz_sets', p_id: 'q1' });
  });

  it('pendingCounts counts cards and their groups together, per game', async () => {
    // Read in the order: quiz_sets, memory_cards, card_groups, spot_levels, find_levels.
    const counts = [3, 1, 0, 2, 4];
    const client = {
      from: () => ({ select: () => ({ eq: () => Promise.resolve({ count: counts.shift() ?? 0, error: null }) }) }),
    } as unknown as Parameters<typeof pendingCounts>[0];
    expect(await pendingCounts(client)).toEqual({ sets: 3, cards: 1, spot: 2, find: 4 });
  });
});

describe('Sets page as a Super Admin (V8, V9)', () => {
  beforeEach(() => {
    h.role = 'super_admin';
    h.rows = [
      { id: 's1', title: 'Animals', subtitle: null, heading_color: '#E59AA1', cover_path: null, status: 'published', updated_at: '2026-10-20T00:00:00Z', owner_id: 'sa', visibility: 'global', questions: [] },
      { id: 's2', title: 'Colours', subtitle: null, heading_color: '#E59AA1', cover_path: null, status: 'published', updated_at: '2026-10-20T00:00:00Z', owner_id: 'p1', visibility: 'private', questions: [] },
      { id: 's3', title: 'Draft of Lan', subtitle: null, heading_color: '#E59AA1', cover_path: null, status: 'draft', updated_at: '2026-10-20T00:00:00Z', owner_id: 'p1', visibility: 'pending', questions: [] },
    ];
  });
  afterEach(() => {
    h.role = 'super_admin';
  });

  it("Mine: an own global copy is editable (Edit), and the tabs are the Super Admin's", async () => {
    render(<SetsPage />);
    expect(await screen.findByRole('tab', { name: 'Parent published' })).toBeTruthy();
    const row = (await screen.findByText('Animals')).closest('tr') as HTMLElement;
    expect(within(row).getByRole('link', { name: 'Edit' })).toHaveProperty('pathname', '/admin/sets/s1');
  });

  it('Parent published lists published sets of parents with the owner name, and no drafts', async () => {
    render(<SetsPage />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Parent published' }));
    const row = (await screen.findByText('Colours')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Lan')).toBeTruthy();
    expect(within(row).getByRole('link', { name: 'View' })).toBeTruthy();
    expect(screen.queryByText('Draft of Lan')).toBeNull();
  });

  it('Review queue shows the queue, not the set table', async () => {
    render(<SetsPage />);
    fireEvent.click(await screen.findByRole('tab', { name: /Review queue/ }));
    expect(await screen.findByText('Nothing is waiting for review.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
