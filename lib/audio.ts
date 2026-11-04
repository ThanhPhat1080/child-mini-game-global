/**
 * One audio manager (ADR-016). Nothing plays until the child taps "enter",
 * so start sounds only from a click handler. Missing files are silent.
 * The background track lives here, so it keeps playing across screens.
 */
const PREF_KEY = 'hamy-music';

let music: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let wanted = true;
let retryArmed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export function playOnce(url: string | null): void {
  if (!url) return;
  const audio = new Audio(url);
  audio.play().catch(() => undefined);
}

/** Calls `fn` whenever the track loads, plays, pauses or the viewer's choice changes. */
export function subscribeMusic(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Loads the looping track at volume 0..100 without playing it. */
export function loadMusic(url: string | null, volume = 30): void {
  if (!url) return;
  if (!music || currentUrl !== url) {
    music?.pause();
    music = new Audio(url);
    music.loop = true;
    music.addEventListener('play', notify);
    music.addEventListener('pause', notify);
    currentUrl = url;
  }
  music.volume = Math.min(1, Math.max(0, volume / 100));
  notify();
}

/** Starts (or resumes) the track, unless the viewer turned music off. */
export function startMusic(url: string | null, volume = 30): void {
  loadMusic(url, volume);
  if (wanted) playMusic();
}

/** Plays the loaded track. If the browser blocks autoplay, retries on the next tap or key. */
function playMusic(): void {
  if (!music || !music.paused) return;
  music.play().catch(() => {
    if (retryArmed) return;
    retryArmed = true;
    const retry = () => {
      window.removeEventListener('pointerdown', retry);
      window.removeEventListener('keydown', retry);
      retryArmed = false;
      if (wanted) playMusic();
    };
    window.addEventListener('pointerdown', retry);
    window.addEventListener('keydown', retry);
  });
}

/** Resumes the track on a screen that is not the welcome screen, if the viewer wants music. */
export function resumeMusic(): void {
  if (wanted) playMusic();
}

/** The bottom-left button: sets the viewer's choice and plays or pauses right away. */
export function setMusicWanted(value: boolean): void {
  wanted = value;
  try {
    window.localStorage.setItem(PREF_KEY, value ? 'on' : 'off');
  } catch {
    // Private mode or blocked storage: the choice still holds for this screen.
  }
  if (value) playMusic();
  else music?.pause();
  notify();
}

/** Reads the viewer's saved choice. Defaults to on. */
export function restoreMusicPref(): void {
  try {
    wanted = window.localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    // Storage blocked: keep the choice made on this screen.
  }
  notify();
}

export function isMusicWanted(): boolean {
  return wanted;
}

export function isMusicPlaying(): boolean {
  return !!music && !music.paused;
}

export function hasMusic(): boolean {
  return currentUrl !== null;
}
