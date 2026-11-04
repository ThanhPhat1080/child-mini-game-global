import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ getMyProfile: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({ auth: { signOut: vi.fn() } }) }));
vi.mock('@/lib/auth/roles', () => ({ getMyProfile: h.getMyProfile }));
vi.mock('next/navigation', () => ({ usePathname: () => '/admin/sets', useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

import { AdminNav } from '@/components/AdminNav';

beforeEach(() => h.getMyProfile.mockReset());
afterEach(cleanup);

describe('AdminNav (N2)', () => {
  it('shows only links allowed for the role: a parent gets Children, no Settings', async () => {
    h.getMyProfile.mockResolvedValue({ role: 'parent' });
    render(<AdminNav />);
    expect(await screen.findByRole('link', { name: 'Children' })).toHaveProperty('pathname', '/admin/children');
    expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull();
    for (const n of ['Media', 'Quiz sets', 'Cards', 'Spot', 'Find']) expect(screen.getByRole('link', { name: n })).toBeTruthy();
    for (const n of ['Review queue', 'Parents', 'All content', 'Messages']) expect(screen.queryByRole('link', { name: n })).toBeNull();
  });

  it('a Super Admin gets no Children link', async () => {
    h.getMyProfile.mockResolvedValue({ role: 'super_admin' });
    render(<AdminNav />);
    await waitFor(() => expect(screen.getByText('Super Admin')).toBeTruthy());
    expect(screen.queryByRole('link', { name: 'Children' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Quiz sets' })).toBeTruthy();
    for (const [name, href] of [['Review queue', '/admin/queue'], ['Parents', '/admin/parents'], ['All children', '/admin/all-children'], ['All content', '/admin/content'], ['Messages', '/admin/messages']]) {
      expect(screen.getByRole('link', { name })).toHaveProperty('pathname', href);
    }
  });

  it('shows no role-specific link until the profile is known, or when it cannot be read', async () => {
    h.getMyProfile.mockResolvedValue(null);
    render(<AdminNav />);
    await waitFor(() => expect(h.getMyProfile).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: 'Children' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Media' })).toBeTruthy();
  });
});
