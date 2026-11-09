'use client';

import { useEffect, useReducer } from 'react';
import { usePathname } from 'next/navigation';
import { getMyChildSettings } from '@/lib/settings';
import { DEFAULT_MUSIC_URL, MUSIC_VOLUME } from '@/lib/defaultMusic';
import {
  hasMusic,
  isMusicPlaying,
  loadMusic,
  restoreMusicPref,
  resumeMusic,
  setMusicWanted,
  subscribeMusic,
} from '@/lib/audio';
import styles from './MusicButton.module.css';

/** Play / pause button for the background music, bottom-right on every child screen. */
export function MusicButton() {
  const pathname = usePathname();
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => subscribeMusic(rerender), []);

  useEffect(() => {
    restoreMusicPref();
    getMyChildSettings()
      .then((data) => {
        loadMusic(DEFAULT_MUSIC_URL, MUSIC_VOLUME);
        // The welcome screen waits for the "tap to enter" press (ADR-016).
        if (pathname !== '/') resumeMusic();
      }, () => undefined);
  }, [pathname]);

  const playing = isMusicPlaying();
  const available = hasMusic();
  const label = playing ? 'Pause background music' : 'Play background music';
  const iconColor = playing ? '#7A5C50' : '#A8968A';

  return (
    <button
      type="button"
      className={`${styles.btn} ${playing ? styles.on : styles.off}`}
      aria-label={label}
      aria-pressed={playing}
      aria-disabled={!available}
      title={available ? label : 'No background music yet'}
      onClick={() => {
        if (!available) return;
        setMusicWanted(!playing);
      }}
    >
      <svg aria-hidden="true" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
        {!playing && <path d="M3 3l18 18" />}
      </svg>
    </button>
  );
}
