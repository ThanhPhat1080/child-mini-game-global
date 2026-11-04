import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ getMyProfile: vi.fn() }));
vi.mock('@/lib/auth/roles', () => ({ getMyProfile: h.getMyProfile }));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: async () => ({}) }));
vi.mock('@/components/AdminNav', () => ({ AdminNav: () => <nav>nav</nav> }));
vi.mock('@/components/AdminSignOutButton', () => ({ AdminSignOutButton: () => <button type="button">Sign out</button> }));
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

import SuperLayout from '@/app/admin/(super)/layout';

beforeEach(() => h.getMyProfile.mockReset());
afterEach(cleanup);

describe('Super Admin console guard (N5)', () => {
  it('shows the children to a Super Admin inside the panel shell', async () => {
    h.getMyProfile.mockResolvedValue({ role: 'super_admin' });
    render(await SuperLayout({ children: <p>secret queue</p> }));
    expect(screen.getByText('secret queue')).toBeTruthy();
    expect(screen.getByText('nav')).toBeTruthy();
  });

  it.each([
    ['a parent', { role: 'parent', banned: false }],
    ['a child', { role: 'child' }],
    ['nobody', null],
  ])('non-super-admin (%s) sees the forbidden page and never the children', async (_n, profile) => {
    h.getMyProfile.mockResolvedValue(profile);
    render(await SuperLayout({ children: <p>secret queue</p> }));
    expect(screen.queryByText('secret queue')).toBeNull();
    expect(screen.getByRole('heading', { name: /don.t have permission/i })).toBeTruthy();
    expect(screen.getByText(/only for the Super Admin/)).toBeTruthy();
  });
});
