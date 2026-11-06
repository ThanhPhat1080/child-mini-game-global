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

describe('default feedback sounds', () => {
  it('yay() with no upload plays public/seed/sounds/hooray.mp3, and ohOh()/applause() their own files', async () => {
    const urls: string[] = [];
    vi.stubGlobal('Audio', class { constructor(public src: string) { urls.push(src); } addEventListener() {} play() { return Promise.resolve(); } pause() {} });
    const { yay, ohOh, applause, DEFAULT_FEEDBACK_SOUNDS } = await import('@/lib/sfx');
    yay(); ohOh(); applause(3);
    expect(urls).toEqual([DEFAULT_FEEDBACK_SOUNDS.hooray, DEFAULT_FEEDBACK_SOUNDS.ohoh, DEFAULT_FEEDBACK_SOUNDS.complete]);
    expect(DEFAULT_FEEDBACK_SOUNDS.hooray).toBe('/seed/sounds/hooray.mp3');
  });

  it('a default file that fails to load falls back to the synthesized sound once', async () => {
    const fired: (() => void)[] = [];
    const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 0 };
    const node = () => ({ connect: (n: unknown) => n, disconnect() {}, start() {}, stop() {}, gain: param, frequency: param, type: '' });
    vi.stubGlobal('AudioContext', class { state = 'running'; currentTime = 0; destination = {}; createGain = node; createOscillator = node; });
    vi.stubGlobal('Audio', class { addEventListener(_: string, f: () => void) { fired.push(f); } play() { return Promise.resolve(); } pause() {} });
    const { yay } = await import('@/lib/sfx');
    yay();
    fired[0]();
    expect(spoken.map((u) => u.text)).toEqual(['Yay! Hooray!']);
  });

  it('an upload wins over the default file', async () => {
    const urls: string[] = [];
    vi.stubGlobal('Audio', class { constructor(public src: string) { urls.push(src); } play() { return Promise.resolve(); } pause() {} });
    const { yay } = await import('@/lib/sfx');
    yay('/media/mine.mp3');
    expect(urls).toEqual(['/media/mine.mp3']);
  });
});

describe('applause speaks only as a fallback', () => {
  it('does not speak while the default complete.mp3 plays; speaks once if the file fails to load', async () => {
    const fired: (() => void)[] = [];
    vi.stubGlobal('Audio', class { addEventListener(_: string, f: () => void) { fired.push(f); } play() { return Promise.resolve(); } pause() {} });
    const { applause } = await import('@/lib/sfx');
    const speak = vi.fn();
    applause(3, speak);
    expect(speak).not.toHaveBeenCalled();
    fired[0]();
    expect(speak).toHaveBeenCalledTimes(1);
  });
});
