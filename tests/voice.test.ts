import { afterEach, describe, expect, it, vi } from 'vitest';
import { playVoice, stopVoice, VOICE_URL } from '@/lib/voice';

const made: { url: string; play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn> }[] = [];

afterEach(() => { vi.unstubAllGlobals(); made.length = 0; stopVoice(); });

describe('play door voices', () => {
  it('plays a line and cuts the previous one', () => {
    vi.stubGlobal('Audio', function (url: string) {
      const a = { url, play: vi.fn(() => Promise.resolve()), pause: vi.fn() };
      made.push(a);
      return a;
    });
    playVoice(VOICE_URL.whoAreYou);
    playVoice(VOICE_URL.hiPrince);
    expect(made.map((a) => a.url)).toEqual(['/seed/sounds/who-are-you.mp3', '/seed/sounds/hi-prince.mp3']);
    expect(made[0].pause).toHaveBeenCalled();
    expect(made[1].play).toHaveBeenCalled();
  });

  it('stays silent when the browser blocks play', async () => {
    vi.stubGlobal('Audio', function () { return { play: () => Promise.reject(new Error('blocked')), pause: vi.fn() }; });
    expect(() => playVoice(VOICE_URL.hiPrincess)).not.toThrow();
  });
});
