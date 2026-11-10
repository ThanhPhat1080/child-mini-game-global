import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ ding: vi.fn(), loadMusic: vi.fn(), resumeMusic: vi.fn(), path: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => h.path }));
vi.mock('@/lib/settings', () => ({ getMyChildSettings: () => Promise.resolve(null) }));
vi.mock('@/lib/audio', () => ({
  hasMusic: () => true, isMusicPlaying: () => false, loadMusic: h.loadMusic, restoreMusicPref: vi.fn(),
  resumeMusic: h.resumeMusic, setMusicWanted: vi.fn(), subscribeMusic: () => () => undefined,
}));

vi.mock('@/lib/sfx', () => ({ softDing: h.ding }));

import { MusicButton } from '@/components/MusicButton';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('MusicButton (C1)', () => {
  it.each(['/', '/play', '/play/sign-in', '/games'])('loads the built-in track and tries to play on arrival at %s', async (path) => {
    h.path = path;
    render(<MusicButton />);
    await vi.waitFor(() => expect(h.resumeMusic).toHaveBeenCalled());
    expect(h.loadMusic).toHaveBeenCalledWith('/seed/sounds/background-track.mp3', 30);
  });

  it('dings softly on a tap of any button or link, but not on the music button itself', () => {
    h.path = '/games';
    render(<><a href="/x">Go</a><button type="button">Play</button><button type="button" disabled>Off</button><p>text</p><MusicButton /></>);
    fireEvent.click(screen.getByText('Go'));
    fireEvent.click(screen.getByText('Play'));
    fireEvent.click(screen.getByText('Off'));
    fireEvent.click(screen.getByText('text'));
    fireEvent.click(screen.getByRole('button', { name: /background music/ }));
    expect(h.ding).toHaveBeenCalledTimes(2);
  });
});
