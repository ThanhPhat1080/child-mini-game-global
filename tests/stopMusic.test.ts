import { beforeEach, describe, expect, it, vi } from 'vitest';

class FakeAudio {
  static made: FakeAudio[] = [];
  paused = true;
  loop = false;
  volume = 1;
  constructor(public src: string) { FakeAudio.made.push(this); }
  addEventListener() {}
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}

beforeEach(() => { vi.resetModules(); FakeAudio.made = []; vi.stubGlobal('Audio', FakeAudio); localStorage.clear(); });

describe('stopMusic (FP13)', () => {
  it('stops the track, keeps the saved choice, and the next child loads their own track', async () => {
    const a = await import('@/lib/audio');
    a.setMusicWanted(true);
    a.startMusic('/one.mp3', 30);
    expect(a.isMusicPlaying()).toBe(true);
    const saved = localStorage.getItem('childPlayer-music');
    a.stopMusic();
    expect(a.isMusicPlaying()).toBe(false);
    expect(a.hasMusic()).toBe(false);
    expect(a.isMusicWanted()).toBe(true);
    expect(localStorage.getItem('childPlayer-music')).toBe(saved);
    a.startMusic('/two.mp3', 30);
    expect(FakeAudio.made.at(-1)?.src).toBe('/two.mp3');
    expect(a.isMusicPlaying()).toBe(true);
    expect(FakeAudio.made[0].paused).toBe(true);
  });
});
