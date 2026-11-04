'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Play / pause preview of one sound at a time (A25). Each sound has a key (its bucket path), so rows can
 * ask "is this one playing?" without building its URL. Starting another key stops the first.
 * Pausing keeps the position; toggling the same key again resumes it. Stops on unmount.
 */
export function useSoundPreview() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [paused, setPaused] = useState(true);

  const stop = useCallback(() => {
    const a = audio.current;
    audio.current = null;
    if (a) {
      a.pause();
      a.onended = null;
    }
    setKey(null);
    setPaused(true);
  }, []);

  useEffect(() => stop, [stop]);

  const toggle = useCallback((next: string, url: string | null) => {
    const a = audio.current;
    if (a && key === next) {
      if (a.paused) {
        // Browsers return a promise that rejects when playback is blocked; a missing promise means it started.
        setPaused(false);
        const resumed: Promise<void> | undefined = a.play();
        resumed?.catch(() => setPaused(true));
      } else {
        a.pause();
        setPaused(true);
      }
      return;
    }
    if (!url) return;
    if (a) {
      a.pause();
      a.onended = null;
    }
    const fresh = new Audio(url);
    fresh.onended = () => { setKey(null); setPaused(true); };
    audio.current = fresh;
    setKey(next);
    setPaused(false);
    const started: Promise<void> | undefined = fresh.play();
    started?.catch(() => { setKey(null); setPaused(true); });
  }, [key]);

  /** True when `next` is the current sound and it is playing. */
  const isPlaying = (next: string | null) => key !== null && key === next && !paused;

  return { toggle, stop, isPlaying };
}
