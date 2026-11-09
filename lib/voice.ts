/**
 * Recorded greetings of the play door (who-are-you, hi-prince, hi-princess), shipped in `public/seed/sounds/`.
 * One voice at a time: a new line cuts the one still playing. A missing file or a blocked autoplay stays silent.
 */
export const VOICE_URL = {
  whoAreYou: '/seed/sounds/who-are-you.mp3',
  hiPrince: '/seed/sounds/hi-prince.mp3',
  hiPrincess: '/seed/sounds/hi-princess.mp3',
  seeYouLater: '/seed/sounds/see-you-later.mp3',
} as const;

let current: HTMLAudioElement | null = null;

export function playVoice(url: string): void {
  try {
    current?.pause();
    const audio = new Audio(url);
    current = audio;
    audio.play().catch(() => undefined);
  } catch {
    // no audio engine: nothing to say
  }
}

export function stopVoice(): void {
  try { current?.pause(); } catch { /* already silent */ }
  current = null;
}
