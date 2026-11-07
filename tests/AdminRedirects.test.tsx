import { beforeEach, describe, expect, it, vi } from 'vitest';

// PR11, PR12: the old Children and Settings routes, and the admin landing page, send a parent to Profile.

const h = vi.hoisted(() => ({ redirect: vi.fn(), getMyProfile: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    h.redirect(url);
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
}));
vi.mock('@/lib/auth/roles', () => ({ getMyProfile: h.getMyProfile }));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: async () => ({}) }));

import ChildrenRoute from '@/app/admin/(panel)/children/page';
import SettingsRoute from '@/app/admin/(panel)/settings/page';
import AdminHome from '@/app/admin/page';

beforeEach(() => {
  h.redirect.mockReset();
  h.getMyProfile.mockReset();
});

describe('old routes send a parent to Profile (PR11)', () => {
  it('/admin/children redirects to /admin/profile', () => {
    expect(() => ChildrenRoute()).toThrow('NEXT_REDIRECT /admin/profile');
    expect(h.redirect).toHaveBeenCalledWith('/admin/profile');
  });

  it('/admin/settings redirects to /admin/profile', () => {
    expect(() => SettingsRoute()).toThrow('NEXT_REDIRECT /admin/profile');
    expect(h.redirect).toHaveBeenCalledWith('/admin/profile');
  });
});

describe('admin landing page (PR12)', () => {
  it('a parent lands on Profile', async () => {
    h.getMyProfile.mockResolvedValue({ role: 'parent' });
    await expect(AdminHome()).rejects.toThrow('NEXT_REDIRECT /admin/profile');
  });

  it('a Super Admin still lands on the parents list', async () => {
    h.getMyProfile.mockResolvedValue({ role: 'super_admin' });
    await expect(AdminHome()).rejects.toThrow('NEXT_REDIRECT /admin/parents');
  });
});
