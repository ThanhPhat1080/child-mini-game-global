import { describe, expect, it } from 'vitest';
import { DEFAULT_MUSIC_URL } from '@/lib/defaultMusic';

describe('default background music (C1, A2)', () => {
  it('is the built-in track', () => {
    expect(DEFAULT_MUSIC_URL).toBe('/seed/sounds/background-track.mp3');
  });
});
