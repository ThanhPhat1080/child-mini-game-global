import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  rpc: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  profile: null as unknown,
}));
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithPassword: h.signIn, signOut: h.signOut }, rpc: h.rpc }),
}));
vi.mock('@/lib/auth/roles', async (orig) => ({
  ...(await orig<typeof import('@/lib/auth/roles')>()),
  getMyProfile: async () => h.profile,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }) }));

import SignInPage from '@/app/admin/sign-in/page';

const parent = { user_id: 'p1', role: 'parent', banned: false };

beforeEach(() => {
  h.signIn.mockReset().mockResolvedValue({ data: {}, error: null });
  h.signOut.mockReset().mockResolvedValue({ error: null });
  h.rpc.mockReset();
  h.push.mockReset();
  h.refresh.mockReset();
  h.profile = parent;
});
afterEach(cleanup);

function submit() {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'mum@example.com' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'longenough1' } });
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
}

describe('Admin sign-in routes by role (U11)', () => {
  it.each([
    ['parent', parent, '/admin'],
    ['super admin', { ...parent, role: 'super_admin' }, '/admin'],
    ['banned parent', { ...parent, banned: true }, '/admin/suspended'],
  ])('%s -> %s', async (_n, profile, target) => {
    h.profile = profile;
    render(<SignInPage />);
    submit();
    await waitFor(() => expect(h.push).toHaveBeenCalledWith(target));
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('shows an error and signs out when there is no profile', async () => {
    h.profile = null;
    render(<SignInPage />);
    submit();
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(h.signOut).toHaveBeenCalled();
    expect(h.push).not.toHaveBeenCalled();
  });

  it('shows an error on wrong credentials', async () => {
    h.signIn.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } });
    render(<SignInPage />);
    submit();
    expect((await screen.findByRole('alert')).textContent).toMatch(/email or password/i);
  });
});
