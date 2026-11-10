// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

// GT4 / GU7: a visitor leaving the game sees "See you later!" (no sum), then the guest is erased.
const h = vi.hoisted(() => ({ push: vi.fn(), stop: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock('@/lib/audio', () => ({ stopMusic: h.stop }));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({ from: () => { throw new Error('no db'); } }) }));

import LeaveGameButton from '@/components/auth/LeaveGameButton';
import { clearVisitor, getVisitor, saveVisitor } from '@/lib/visitor';

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
  it('Leave asks no sum: it shows See you later, then erases the visitor and goes to the chooser', () => {
    vi.useFakeTimers();
    try {
      render(<LeaveGameButton />);
      fireEvent.click(screen.getByRole('button', { name: 'Leave game' }));
      fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
      expect(screen.queryByTestId('adult-question')).toBeNull();
      expect(screen.getByText('See you later!')).toBeTruthy();
      expect(h.push).not.toHaveBeenCalled();
      expect(getVisitor()).not.toBeNull();
      act(() => { vi.advanceTimersByTime(2000); });
      expect(h.push).toHaveBeenCalledWith('/play/sign-in');
      expect(h.stop).toHaveBeenCalled();
      expect(getVisitor()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
