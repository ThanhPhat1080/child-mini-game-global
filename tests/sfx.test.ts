import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { speakKid } from '@/lib/sfx';

const spoken: { lang: string; voice: unknown; text: string }[] = [];
const voice = (name: string, lang: string) => ({ name, lang }) as SpeechSynthesisVoice;
let voices: SpeechSynthesisVoice[] = [];

beforeEach(() => {
  spoken.length = 0;
  voices = [];
  vi.stubGlobal('SpeechSynthesisUtterance', class { lang = ''; voice: unknown = null; pitch = 1; rate = 1; volume = 1; constructor(public text: string) {} });
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { cancel: () => undefined, getVoices: () => voices, speak: (u: { lang: string; voice: unknown; text: string }) => spoken.push(u) } });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('speakKid language', () => {
  it('always speaks en-US, even when no voices have loaded yet', () => {
    speakKid('Hello');
    expect(spoken[0].lang).toBe('en-US');
    expect(spoken[0].voice).toBeNull();
  });

  it('leaves the voice to the browser default, with lang en-US, even when voices are installed', () => {
    voices = [voice('Linh', 'vi-VN'), voice('Google UK English Female', 'en-GB'), voice('Google US English', 'en-US')];
    speakKid('Hello');
    expect(spoken[0].voice).toBeNull();
    expect(spoken[0].lang).toBe('en-US');
  });
});
