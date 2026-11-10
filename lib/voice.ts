/**
 * Recorded greetings of the play door (who-are-you, hi-prince, hi-princess), shipped in `public/seed/sounds/`.
 * One voice at a time: a new line cuts the one still playing. A missing file or a blocked autoplay stays silent.
 */
export const VOICE_URL = {
  welcomeDoor: '/seed/sounds/welcome-0.mp3',
  whoAreYou: '/seed/sounds/who-are-you.mp3',
  hiPrince: '/seed/sounds/hi-prince.mp3',
  hiPrincess: '/seed/sounds/hi-princess.mp3',
  welcomeGuest: '/seed/sounds/welcome-1.mp3',
  seeYouLater: '/seed/sounds/see-you-later.mp3',
} as const;

let current: HTMLAudioElement | null = null;

/** `retryOnTap`: when the browser blocks sound before the first tap, the line plays on that first tap or key instead. */
export function playVoice(url: string, opts: { retryOnTap?: boolean } = {}): void {
  try {
    current?.pause();
    const audio = new Audio(url);
    current = audio;
    audio.play().catch(() => {
      if (!opts.retryOnTap) return;
      const retry = () => {
        window.removeEventListener('pointerdown', retry);
        window.removeEventListener('keydown', retry);
        if (current === audio) audio.play().catch(() => undefined);
      };
      window.addEventListener('pointerdown', retry);
      window.addEventListener('keydown', retry);
    });
  } catch {
    // no audio engine: nothing to say
  }
}

export function stopVoice(): void {
  try { current?.pause(); } catch { /* already silent */ }
  current = null;
}
