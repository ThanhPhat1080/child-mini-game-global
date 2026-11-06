import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ getMyProfile: vi.fn(), pendingMessageCount: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }) }));
vi.mock('@/lib/auth/roles', () => ({ getMyProfile: h.getMyProfile }));
vi.mock('@/lib/superAdmin', () => ({ pendingMessageCount: h.pendingMessageCount }));
vi.mock('next/navigation', () => ({ usePathname: () => '/admin/sets', useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

import { AdminNav } from '@/components/AdminNav';

beforeEach(() => {
  h.getMyProfile.mockReset();
  h.pendingMessageCount.mockReset().mockResolvedValue(0);
});
afterEach(cleanup);

describe('AdminNav (N2)', () => {
  it('shows only links allowed for the role: a parent gets Children, no Settings', async () => {
    h.getMyProfile.mockResolvedValue({ role: 'parent' });
    render(<AdminNav />);
    expect(await screen.findByRole('link', { name: 'Children' })).toHaveProperty('pathname', '/admin/children');
    expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull();
    for (const n of ['Media', 'Quiz sets', 'Cards', 'Spot', 'Find']) expect(screen.getByRole('link', { name: n })).toBeTruthy();
    for (const n of ['Review queue', 'Parents', 'Messages']) expect(screen.queryByRole('link', { name: n })).toBeNull();
    expect(h.pendingMessageCount).not.toHaveBeenCalled();
  });

  it("a Super Admin's Children link is the all-children page, and there are no content links", async () => {
    h.getMyProfile.mockResolvedValue({ role: 'super_admin' });
    render(<AdminNav />);
    await waitFor(() => expect(screen.getByText('Super Admin')).toBeTruthy());
    expect(screen.getByRole('link', { name: 'Quiz sets' })).toBeTruthy();
    for (const [name, href] of [['Review queue', '/admin/queue'], ['Parents', '/admin/parents'], ['Children', '/admin/all-children'], ['Messages', '/admin/messages']]) {
      expect(screen.getByRole('link', { name })).toHaveProperty('pathname', href);
    }
    expect(screen.queryByRole('link', { name: 'All content' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'All children' })).toBeNull();
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
    expect(screen.queryByRole('link', { name: 'Children' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Media' })).toBeTruthy();
  });
});
