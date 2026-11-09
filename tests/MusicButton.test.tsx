import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ loadMusic: vi.fn(), resumeMusic: vi.fn(), path: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => h.path }));
vi.mock('@/lib/settings', () => ({ getMyChildSettings: () => Promise.resolve(null) }));
vi.mock('@/lib/audio', () => ({
  hasMusic: () => true, isMusicPlaying: () => false, loadMusic: h.loadMusic, restoreMusicPref: vi.fn(),
  resumeMusic: h.resumeMusic, setMusicWanted: vi.fn(), subscribeMusic: () => () => undefined,
}));

import { MusicButton } from '@/components/MusicButton';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('MusicButton (C1)', () => {
  it.each(['/', '/play', '/play/sign-in', '/games'])('loads the built-in track and tries to play on arrival at %s', async (path) => {
    h.path = path;
    render(<MusicButton />);
    await vi.waitFor(() => expect(h.resumeMusic).toHaveBeenCalled());
    expect(h.loadMusic).toHaveBeenCalledWith('/seed/sounds/background-track.mp3', 30);
  });
});
