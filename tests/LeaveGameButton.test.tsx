import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ push: vi.fn(), clear: vi.fn(), stop: vi.fn(), get: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock('@/lib/childSession', () => ({ clearActiveChild: h.clear }));
vi.mock('@/lib/audio', () => ({ stopMusic: h.stop }));
vi.mock('@/lib/settings', () => ({ getMyChildSettings: h.get }));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null) => (p ? `/media/${p}` : null) }));

import LeaveGameButton from '@/components/auth/LeaveGameButton';

beforeEach(() => {
  vi.clearAllMocks();
  h.get.mockResolvedValue({ child_name: 'Bi', avatar_path: null, gender: 'male' });
});
afterEach(cleanup);

const open = () => fireEvent.click(screen.getByRole('button', { name: 'Leave game' }));
const dialog = () => screen.queryByRole('dialog', { name: 'Leave game?' });

describe('LeaveGameButton (FP11-FP13)', () => {
  it('opens with focus on Stay, and needs no sum', () => {
    render(<LeaveGameButton />);
    open();
    expect(dialog()).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Stay' }));
    expect(screen.queryByTestId('adult-question')).toBeNull();
  });
  it.each([
    ['Stay', () => fireEvent.click(screen.getByRole('button', { name: 'Stay' }))],
    ['X', () => fireEvent.click(screen.getByRole('button', { name: 'Close' }))],
    ['Esc', () => fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })],
    ['outside', () => fireEvent.mouseDown(document.querySelector('[data-leave-overlay]') as Element)],
  ])('%s stays in the game and returns focus to the button', (_n, act) => {
    render(<LeaveGameButton />);
    open();
    act();
    expect(dialog()).toBeNull();
    expect(h.clear).not.toHaveBeenCalled();
    expect(h.push).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Leave game' }));
  });
  it('Leave clears the child, stops the music and goes to the picker', () => {
    render(<LeaveGameButton />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(h.stop).toHaveBeenCalledTimes(1);
    expect(h.clear).toHaveBeenCalledTimes(1);
    expect(h.push).toHaveBeenCalledWith('/play');
  });
  it('shows the first letter when the child has no avatar', async () => {
    render(<LeaveGameButton />);
    open();
    await waitFor(() => expect(screen.getByRole('dialog').textContent).toContain('B'));
  });
});
