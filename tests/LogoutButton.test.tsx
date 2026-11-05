import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ signOut: vi.fn(), push: vi.fn(), refresh: vi.fn(), clear: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({ auth: { signOut: h.signOut } }) }));
vi.mock('@/lib/childSession', () => ({ clearActiveChild: h.clear }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }) }));

import LogoutButton from '@/components/auth/LogoutButton';

beforeEach(() => {
  h.signOut.mockReset().mockResolvedValue({ error: null });
  h.push.mockReset();
  h.refresh.mockReset();
  h.clear.mockReset();
});
afterEach(cleanup);

const open = () => fireEvent.click(screen.getByRole('button', { name: 'Sign out (grown-ups)' }));
const answer = (v: string) => {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: v } });
  fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));
};

describe('LogoutButton (U10)', () => {
  it('wrong answer does not sign out', () => {
    render(<LogoutButton />);
    open();
    answer('1');
    expect(h.signOut).not.toHaveBeenCalled();
    expect(h.clear).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('correct answer signs out, clears the child and goes back to /admin/sign-in', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<LogoutButton />);
    open();
    answer('12');
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/admin/sign-in'));
    expect(h.signOut).toHaveBeenCalledTimes(1);
    expect(h.clear).toHaveBeenCalledTimes(1);
    expect(h.refresh).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('stays on the page when signOut returns an error', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    h.signOut.mockResolvedValue({ error: { message: 'x' } });
    render(<LogoutButton />);
    open();
    answer('12');
    await waitFor(() => expect(h.signOut).toHaveBeenCalled());
    await Promise.resolve();
    expect(h.push).not.toHaveBeenCalled();
    expect(h.clear).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('cancel does not sign out', () => {
    render(<LogoutButton />);
    open();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(h.signOut).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
