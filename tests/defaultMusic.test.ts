import { describe, expect, it } from 'vitest';
import { DEFAULT_MUSIC_URL, musicUrl } from '@/lib/defaultMusic';

describe('default background music (C1, A2)', () => {
  it('uses the built-in track when no file is chosen', () => {
    expect(DEFAULT_MUSIC_URL).toBe('/seed/sounds/background-track.mp3');
    expect(musicUrl(null)).toBe(DEFAULT_MUSIC_URL);
    expect(musicUrl(undefined)).toBe(DEFAULT_MUSIC_URL);
  });
  it('a chosen file wins', () => {
    expect(musicUrl('/media/snd/mine.mp3')).toBe('/media/snd/mine.mp3');
  });
});
