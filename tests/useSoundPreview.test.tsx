import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSoundPreview } from '@/components/admin/useSoundPreview';

const made: { src: string; pause: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn> }[] = [];

beforeEach(() => {
  made.length = 0;
  vi.stubGlobal('Audio', class {
    src: string;
    paused = true;
    onended: (() => void) | null = null;
    play = vi.fn(() => { this.paused = false; return Promise.resolve(); });
    pause = vi.fn(() => { this.paused = true; });
    constructor(src: string) {
      this.src = src;
      made.push({ src, pause: this.pause, play: this.play });
    }
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('useSoundPreview (A25)', () => {
  it('plays, then pauses, then resumes the same sound', () => {
    const { result } = renderHook(() => useSoundPreview());
    act(() => result.current.toggle('cards/a.mp3', 'https://cdn/a.mp3'));
    expect(made).toHaveLength(1);
    expect(result.current.isPlaying('cards/a.mp3')).toBe(true);

    act(() => result.current.toggle('cards/a.mp3', 'https://cdn/a.mp3'));
    expect(made[0].pause).toHaveBeenCalled();
    expect(result.current.isPlaying('cards/a.mp3')).toBe(false);

    act(() => result.current.toggle('cards/a.mp3', 'https://cdn/a.mp3'));
    expect(made, 'resume reuses the same element').toHaveLength(1);
    expect(made[0].play).toHaveBeenCalledTimes(2);
    expect(result.current.isPlaying('cards/a.mp3')).toBe(true);
  });

  it('starting another sound stops the first', () => {
    const { result } = renderHook(() => useSoundPreview());
    act(() => result.current.toggle('cards/a.mp3', 'https://cdn/a.mp3'));
    act(() => result.current.toggle('cards/b.mp3', 'https://cdn/b.mp3'));
    expect(made[0].pause).toHaveBeenCalled();
    expect(made[1].src).toBe('https://cdn/b.mp3');
    expect(result.current.isPlaying('cards/a.mp3')).toBe(false);
    expect(result.current.isPlaying('cards/b.mp3')).toBe(true);
  });

  it('stop and unmount pause the sound', () => {
    const { result, unmount } = renderHook(() => useSoundPreview());
    act(() => result.current.toggle('cards/a.mp3', 'https://cdn/a.mp3'));
    act(() => result.current.stop());
    expect(made[0].pause).toHaveBeenCalled();
    expect(result.current.isPlaying('cards/a.mp3')).toBe(false);

    act(() => result.current.toggle('cards/a.mp3', 'https://cdn/a.mp3'));
    unmount();
    expect(made[1].pause).toHaveBeenCalled();
  });

  it('a missing URL does nothing', () => {
    const { result } = renderHook(() => useSoundPreview());
    act(() => result.current.toggle('cards/a.mp3', null));
    expect(made).toHaveLength(0);
  });
});
