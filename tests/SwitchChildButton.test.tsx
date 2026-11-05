import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ signOut: vi.fn(), push: vi.fn(), clear: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({ auth: { signOut: h.signOut } }) }));
vi.mock('@/lib/childSession', () => ({ clearActiveChild: h.clear }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push, refresh: vi.fn() }) }));

import SwitchChildButton from '@/components/auth/SwitchChildButton';

beforeEach(() => {
  h.signOut.mockReset();
  h.push.mockReset();
  h.clear.mockReset();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const open = () => fireEvent.click(screen.getByRole('button', { name: 'Switch child (grown-ups)' }));
const answer = (v: string) => {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: v } });
  fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));
};

describe('SwitchChildButton (K11)', () => {
  it('wrong sum does nothing', () => {
    render(<SwitchChildButton />);
    open();
    answer('1');
    expect(h.clear).not.toHaveBeenCalled();
    expect(h.push).not.toHaveBeenCalled();
  });

  it('right sum clears the child and goes to /play without signing out', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<SwitchChildButton />);
    open();
    answer('12');
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/play'));
    expect(h.clear).toHaveBeenCalledTimes(1);
    expect(h.signOut).not.toHaveBeenCalled();
  });

  it('cancel does nothing', () => {
    render(<SwitchChildButton />);
    open();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(h.clear).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
