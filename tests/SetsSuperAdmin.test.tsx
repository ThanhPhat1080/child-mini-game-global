import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ rows: [] as unknown[], approveItem: vi.fn() }));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'sa' } } } }) },
    from: () => ({ select: () => ({ order: () => Promise.resolve({ data: h.rows, error: null }) }) }),
  }),
}));
vi.mock('@/lib/review', async (orig) => ({
  ...(await orig<typeof import('@/lib/review')>()),
  useMyRole: () => 'super_admin', getMyRole: async () => 'super_admin', getMyUserId: async () => 'sa',
}));
vi.mock('@/lib/superAdmin', async (orig) => ({
  ...(await orig<typeof import('@/lib/superAdmin')>()),
  parentNames: async () => new Map([['p1', 'Lan Nguyen'], ['p2', 'Bao Tran']]),
  usePendingCounts: () => ({ sets: 2, cards: 0, spot: 0, find: 0 }),
  approveItem: h.approveItem,
}));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null) => (p ? `/media/${p}` : null) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

import SetsPage from '@/app/admin/(panel)/sets/page';

const q = (n: number) => ({ prompt_text: `Q${n}`, prompt_audio_path: null, answers: [{ slot: 1, image_path: 'a.svg', is_correct: true }, { slot: 2, image_path: 'b.svg', is_correct: false }] });
const set = (id: string, title: string, owner: string, visibility: string, status: string, updated: string) => ({
  id, title, subtitle: null, heading_color: '#E59AA1', cover_path: null, status, updated_at: updated, owner_id: owner, visibility, questions: [q(1)],
});

const titles = () => screen.getAllByRole('row').slice(1).map((r) => (within(r).getAllByRole('link')[0].textContent ?? '').replace('No sub-title', ''));

beforeEach(() => {
  localStorage.clear();
  h.approveItem.mockReset().mockResolvedValue('copy');
  h.rows = [
    set('a', 'Zebra', 'p1', 'pending', 'published', '2026-10-01T00:00:00Z'),
    set('b', 'Apple', 'p2', 'pending', 'published', '2026-10-05T00:00:00Z'),
    set('c', 'Mango', 'p1', 'private', 'published', '2026-10-03T00:00:00Z'),
    set('d', 'Global one', 'sa', 'global', 'published', '2026-10-02T00:00:00Z'),
  ];
});
afterEach(cleanup);

async function openTab(name: RegExp) {
  render(<SetsPage />);
  fireEvent.click(await screen.findByRole('tab', { name }));
}

describe('Quiz sets for a Super Admin: review queue and tabs', () => {
  it('a queue item looks like a Parent published row: View and Approve, no Reject, owner links to the parent', async () => {
    await openTab(/Review queue/);
    await waitFor(() => expect(titles()).toEqual(['Apple', 'Zebra'])); // newest first; the private set is not in the queue
    const row = screen.getByText('Zebra').closest('tr') as HTMLElement;
    expect(within(row).getByRole('link', { name: 'View' }).getAttribute('href')).toBe('/admin/sets/a');
    expect(within(row).getByRole('link', { name: 'Lan Nguyen' }).getAttribute('href')).toBe('/admin/parents/p1');
    expect(screen.queryByRole('button', { name: /Reject/ })).toBeNull();
    fireEvent.click(within(row).getByRole('button', { name: 'Approve Zebra' }));
    await waitFor(() => expect(h.approveItem).toHaveBeenCalledWith('quiz_sets', 'a'));
  });

  it('Parent published links the owner to the parent profile too', async () => {
    await openTab(/Parent published/);
    const row = (await screen.findByText('Mango')).closest('tr') as HTMLElement;
    expect(within(row).getByRole('link', { name: 'Lan Nguyen' }).getAttribute('href')).toBe('/admin/parents/p1');
  });

  it.each([/Mine/, /Global/, /Review queue/, /Parent published/])('every tab sorts newest first or A to Z (%s)', async (tab) => {
    await openTab(tab);
    await waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThan(1));
    const newest = titles();
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort' }), { target: { value: 'az' } });
    expect(titles()).toEqual([...newest].sort((x, y) => x.localeCompare(y)));
  });

  it('search matches the set name and the parent name', async () => {
    await openTab(/Parent published/);
    await screen.findByText('Mango');
    const box = screen.getByRole('searchbox', { name: 'Search quiz sets and parents' });
    fireEvent.change(box, { target: { value: 'bao' } });
    expect(titles()).toEqual(['Apple']); // Bao Tran's set
    fireEvent.change(box, { target: { value: 'mang' } });
    expect(titles()).toEqual(['Mango']);
    fireEvent.change(box, { target: { value: 'zzz' } });
    expect(screen.getByText('No quiz sets match.')).toBeTruthy();
  });
});
