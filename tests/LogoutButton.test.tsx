import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  fireEvent.click(screen.getByRole('button', { name: 'Signout now!' }));
};

describe('LogoutButton (U10)', () => {
  it('the check is titled "Sign out now?" with a hint and the exit-door picture, not "Grown-ups only" (sign-out)', () => {
    render(<LogoutButton />);
    open();
    expect(screen.getByRole('heading', { name: 'Sign out now?' })).toBeTruthy();
    expect(screen.getByText('Finish the sum below to sign out.')).toBeTruthy();
    expect(screen.queryByText('Grown-ups only')).toBeNull();
    expect(screen.getByRole('dialog').querySelector('svg')).toBeTruthy();
  });

  it('wrong answer does not sign out', () => {
    render(<LogoutButton />);
    open();
    answer('1');
    expect(h.signOut).not.toHaveBeenCalled();
    expect(h.clear).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('correct answer signs out, clears the child and goes back to /play/sign-in', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<LogoutButton />);
    open();
    answer('20');
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/play/sign-in'), { timeout: 3000 });
    expect(h.signOut).toHaveBeenCalledTimes(1);
    expect(h.clear).toHaveBeenCalledTimes(1);
    expect(h.refresh).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('after the right sum a farewell shows with See you later! and the sign-out waits 2 s', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<LogoutButton />);
    open();
    answer('20');
    expect(screen.getByRole('status').textContent).toContain('See you later!');
    expect(h.signOut).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1999); });
    expect(h.signOut).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(h.signOut).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('stays on the page when signOut returns an error', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    h.signOut.mockResolvedValue({ error: { message: 'x' } });
    render(<LogoutButton />);
    open();
    answer('20');
    await waitFor(() => expect(h.signOut).toHaveBeenCalled(), { timeout: 3000 });
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
