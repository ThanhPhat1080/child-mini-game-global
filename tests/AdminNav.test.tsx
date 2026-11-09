import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  signOut: vi.fn(),
  push: vi.fn(),
  getMyProfile: vi.fn(),
  pendingMessageCount: vi.fn(),
  counts: { sets: 0, cards: 0, spot: 0, find: 0 },
}));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({ auth: { signOut: h.signOut } }) }));
vi.mock('@/lib/auth/roles', () => ({ getMyProfile: h.getMyProfile }));
vi.mock('@/lib/superAdmin', () => ({ pendingMessageCount: h.pendingMessageCount, usePendingCounts: () => h.counts }));
vi.mock('next/navigation', () => ({ usePathname: () => '/admin/sets', useRouter: () => ({ push: h.push, refresh: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

import { AdminNav } from '@/components/AdminNav';

beforeEach(() => {
  h.signOut.mockReset().mockResolvedValue(undefined);
  h.push.mockReset();
  h.getMyProfile.mockReset();
  h.pendingMessageCount.mockReset().mockResolvedValue(0);
  h.counts = { sets: 0, cards: 0, spot: 0, find: 0 };
});
afterEach(cleanup);

describe('AdminNav sign out', () => {
  it('asks first: Cancel keeps the session, the confirm button signs out and goes to the sign-in page', async () => {
    h.getMyProfile.mockResolvedValue({ role: 'parent' });
    render(<AdminNav />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(h.signOut).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(h.signOut).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(h.signOut).toHaveBeenCalled());
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/admin/sign-in'));
  });
});

describe('AdminNav (N2)', () => {
  it('shows only links allowed for the role: a parent gets Profile and Inbox, no Children, no Settings', async () => {
    h.getMyProfile.mockResolvedValue({ role: 'parent' });
    render(<AdminNav />);
    expect(await screen.findByRole('link', { name: 'Profile' })).toHaveProperty('pathname', '/admin/profile');
    expect(screen.getByRole('link', { name: 'Inbox' })).toHaveProperty('pathname', '/admin/inbox');
    expect(screen.queryByRole('link', { name: 'Children' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull();
    for (const n of ['Media', 'Quiz sets', 'Cards', 'Spot', 'Find']) expect(screen.getByRole('link', { name: n })).toBeTruthy();
    for (const n of ['Review queue', 'Parents', 'Messages', 'Puzzle']) expect(screen.queryByRole('link', { name: n })).toBeNull();
    expect(screen.queryByRole('link', { name: /pending/ })).toBeNull();
    expect(h.pendingMessageCount).not.toHaveBeenCalled();
  });

  it("a Super Admin's Children link is the all-children page, and there are no content links", async () => {
    h.getMyProfile.mockResolvedValue({ role: 'super_admin' });
    render(<AdminNav />);
    await waitFor(() => expect(screen.getByText('Super Admin')).toBeTruthy());
    expect(screen.getByRole('link', { name: 'Quiz sets' })).toBeTruthy();
    for (const [name, href] of [['Children', '/admin/all-children'], ['Parents', '/admin/parents'], ['Messages', '/admin/messages']]) {
      expect(screen.getByRole('link', { name })).toHaveProperty('pathname', href);
    }
    // Profile is the first link of the Super Admin section, for the Super Admin's own details (PR13).
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveProperty('pathname', '/admin/profile');
    // A32: Puzzle belongs to the Game settings group, after Find, and only a Super Admin sees it.
    const games = screen.getByRole('group', { name: 'Game settings' });
    const puzzle = within(games).getByRole('link', { name: 'Puzzle' });
    expect(puzzle).toHaveProperty('pathname', '/admin/puzzle');
    expect(within(games).getByRole('link', { name: 'Find' }).compareDocumentPosition(puzzle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Children is the first link of the Super Admin section (the baby icon).
    const superLinks = ['Children', 'Parents', 'Messages'].map((n) => screen.getByRole('link', { name: n }));
    expect(superLinks[0].compareDocumentPosition(superLinks[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // V3: the review queue lives in each game's own tab now, not in the menu.
    expect(screen.queryByRole('link', { name: 'Review queue' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'All content' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'All children' })).toBeNull();
  });

  it('a Super Admin sees a red dot with the count on each game with waiting shares; a parent sees none', async () => {
    h.getMyProfile.mockResolvedValue({ role: 'super_admin' });
    h.counts = { sets: 2, cards: 0, spot: 1, find: 0 };
    render(<AdminNav />);
    expect(await screen.findByRole('link', { name: 'Quiz sets, 2 pending' })).toHaveProperty('pathname', '/admin/sets');
    expect(screen.getByRole('link', { name: 'Spot, 1 pending' })).toHaveProperty('pathname', '/admin/spot');
    expect(screen.getByRole('link', { name: 'Cards' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Find' })).toBeTruthy();
  });

  it('a parent never gets review dots', async () => {
    h.getMyProfile.mockResolvedValue({ role: 'parent' });
    h.counts = { sets: 2, cards: 1, spot: 1, find: 1 };
    render(<AdminNav />);
    expect(await screen.findByRole('link', { name: 'Quiz sets' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /pending/ })).toBeNull();
  });

  it('shows a red dot on Messages with the pending count, and none at zero', async () => {
    h.getMyProfile.mockResolvedValue({ role: 'super_admin' });
    h.pendingMessageCount.mockResolvedValue(2);
    render(<AdminNav />);
    expect(await screen.findByRole('link', { name: 'Messages, 2 pending' })).toHaveProperty('pathname', '/admin/messages');
  });

  it('no dot when nothing is pending, and the count refreshes when a message changes', async () => {
    h.getMyProfile.mockResolvedValue({ role: 'super_admin' });
    render(<AdminNav />);
    await waitFor(() => expect(h.pendingMessageCount).toHaveBeenCalled());
    expect(await screen.findByRole('link', { name: 'Messages' })).toBeTruthy();
    h.pendingMessageCount.mockResolvedValue(1);
    window.dispatchEvent(new Event('cp:messages-changed'));
    expect(await screen.findByRole('link', { name: 'Messages, 1 pending' })).toBeTruthy();
  });

  it('a failed count shows no dot and does not break the menu', async () => {
    h.getMyProfile.mockResolvedValue({ role: 'super_admin' });
    h.pendingMessageCount.mockRejectedValue(new Error('boom'));
    render(<AdminNav />);
    expect(await screen.findByRole('link', { name: 'Messages' })).toBeTruthy();
  });

  it('shows no role-specific link until the profile is known, or when it cannot be read', async () => {
    h.getMyProfile.mockResolvedValue(null);
    render(<AdminNav />);
    await waitFor(() => expect(h.getMyProfile).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: 'Profile' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Inbox' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Media' })).toBeTruthy();
  });
});
