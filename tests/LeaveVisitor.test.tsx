// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

// GT4 / GU7: a visitor leaving the game answers the two-digit sum; a right answer erases the guest.
const h = vi.hoisted(() => ({ push: vi.fn(), stop: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock('@/lib/audio', () => ({ stopMusic: h.stop }));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({ from: () => { throw new Error('no db'); } }) }));

import LeaveGameButton from '@/components/auth/LeaveGameButton';
import { clearVisitor, getVisitor, saveVisitor } from '@/lib/visitor';

function sumOf(): number {
  const text = screen.getByTestId('adult-question').textContent ?? '';
  const [a, b] = text.split('=')[0].split('+').map((x) => Number(x.trim()));
  return a + b;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  clearVisitor();
  saveVisitor({ name: 'Mai', gender: 'female', ageBand: '2-5' });
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  clearVisitor();
});

describe('LeaveGameButton for a visitor (GU7)', () => {
  it('Leave asks the two-digit sum first and does not leave yet', () => {
    render(<LeaveGameButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Leave game' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(screen.getByTestId('adult-question')).toBeTruthy();
    expect(h.push).not.toHaveBeenCalled();
    expect(getVisitor()).not.toBeNull();
  });

  it('a right answer stops the music, erases the visitor and goes to the sign-in chooser', async () => {
    render(<LeaveGameButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Leave game' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    const answer = sumOf();
    fireEvent.change(screen.getByLabelText('Answer'), { target: { value: String(answer) } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/play/sign-in'));
    expect(h.stop).toHaveBeenCalled();
    expect(getVisitor()).toBeNull();
  });

  it('a wrong answer keeps the visitor playing', () => {
    render(<LeaveGameButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Leave game' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    fireEvent.change(screen.getByLabelText('Answer'), { target: { value: String(sumOf() + 1) } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(h.push).not.toHaveBeenCalled();
    expect(getVisitor()).not.toBeNull();
  });

  it('Cancel closes the sum and keeps the visitor', () => {
    render(<LeaveGameButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Leave game' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('adult-question')).toBeNull();
    expect(h.push).not.toHaveBeenCalled();
    expect(getVisitor()).not.toBeNull();
  });
});
