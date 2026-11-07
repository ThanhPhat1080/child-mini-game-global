'use client';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { mediaUrl } from '@/lib/media';
import { playOnce, startMusic } from '@/lib/audio';
import { BOY_WELCOME_VARS, GENDER_THEME } from '@/lib/childTheme';
import { useActiveChild } from '@/lib/useActiveChild';
import { Stage } from '@/components/Stage';
import { BounceText } from '@/components/BounceText';
import { MusicButton } from '@/components/MusicButton';
import LeaveGameButton from '@/components/auth/LeaveGameButton';
import styles from './welcome.module.css';
import { Pic } from '@/components/Pic';

const CROWN = 'M4 38 L8 10 L20 24 L30 4 L40 24 L52 10 L56 38 Z';

/** Welcome (C1, FP9). Nothing plays until the child taps the big button (ADR-016). The picture and colors follow the child's gender. */
export default function Welcome() {
  const child = useActiveChild();
  const settings = child.settings;
  const known = child.status !== 'loading';
  const [entered, setEntered] = useState(false);
  const theme = GENDER_THEME[child.gender ?? 'female'];
  const vars = child.gender === 'male' ? (BOY_WELCOME_VARS as CSSProperties) : undefined;

  function onEnter() {
    setEntered(true);
    playOnce(mediaUrl(settings?.greeting_path));
    startMusic(mediaUrl(settings?.music_path), settings?.music_volume ?? 30);
  }

  return (
    <Stage>
      <div className={styles.scene} data-welcome-scene style={vars}>
        <svg aria-hidden="true" width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
          <circle cx="1620" cy="190" r="96" fill="#F6E2A6" />
          <circle cx="1620" cy="190" r="140" fill="#F6E2A6" opacity="0.35" />
          <g className={styles.drift}>
            <ellipse cx="320" cy="180" rx="130" ry="44" fill="#FFFFFF" opacity="0.9" />
            <ellipse cx="400" cy="160" rx="90" ry="40" fill="#FFFFFF" opacity="0.9" />
          </g>
          <g className={styles.drift}>
            <ellipse cx="1100" cy="120" rx="110" ry="36" fill="#FFFFFF" opacity="0.8" />
          </g>
          <path d="M0 860 C 320 760 620 800 960 860 C 1300 920 1600 820 1920 840 L1920 1080 L0 1080 Z" fill="#D9E3CC" />
          <path d="M0 950 C 400 880 800 930 1180 970 C 1500 1000 1720 940 1920 950 L1920 1080 L0 1080 Z" fill="#C7D6BA" />
          <circle cx="260" cy="930" r="10" fill="#EBB7BC" />
          <circle cx="300" cy="950" r="8" fill="#F6E2A6" />
          <circle cx="1500" cy="960" r="10" fill="#EBB7BC" />
          <circle cx="1540" cy="940" r="8" fill="#FFFFFF" />
        </svg>

        {known && (
          <div className={`${styles.princess} ${styles.float}`}>
            <Pic src={theme.hero} alt={theme.heroAlt} width={520} height={655} />
            <svg aria-hidden="true" width="520" height="655" viewBox="0 0 520 655">
              <g className={styles.twinkle} style={{ transformOrigin: '40px 190px' }}>
                <path d="M40 168 L45 185 L62 190 L45 195 L40 212 L35 195 L18 190 L35 185 Z" fill="#F6E2A6" />
              </g>
              <g className={styles.twinkle} style={{ transformOrigin: '490px 120px', animationDelay: '1.2s' }}>
                <path d="M490 98 L494 114 L510 120 L494 126 L490 142 L486 126 L470 120 L486 114 Z" fill="#F6E2A6" />
              </g>
              <g className={styles.twinkle} style={{ transformOrigin: '500px 470px', animationDelay: '2.2s' }}>
                <path d="M500 456 L503 467 L514 470 L503 473 L500 484 L497 473 L486 470 L497 467 Z" fill="#EBB7BC" />
              </g>
            </svg>
          </div>
        )}

        <MusicButton />
        <LeaveGameButton />

        {!known ? null : !entered ? (
          <div className={`${styles.center} ${styles.enterWrap}`}>
            <p className={styles.playNow}><BounceText text="Play now" delay={0.3} /></p>
            <button type="button" className={`${styles.enterBtn} ${styles.breathe}`} aria-label="Tap to enter" onClick={onEnter}>
              <svg aria-hidden="true" width="170" height="170" viewBox="0 0 24 24" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round">
                <path d="M8 5.5v13l10.5-6.5z" />
              </svg>
            </button>
            <p className={styles.hint}>Tap to enter · sound on</p>
          </div>
        ) : (
          <div className={`${styles.center} ${styles.enteredWrap}`}>
            <div className={`${styles.crownCircle} ${styles.float}`}>
              {mediaUrl(settings?.avatar_path) ? (
                <Pic src={mediaUrl(settings?.avatar_path) ?? ''} alt="" className={styles.avatarImg} />
              ) : (
                <svg aria-hidden="true" width="120" height="84" viewBox="0 0 60 42" fill="#F6E2A6" stroke="#C9A05A" strokeWidth="2" strokeLinejoin="round">
                  <path d={CROWN} />
                  <circle cx="30" cy="4" r="3" fill="#EBB7BC" stroke="none" />
                </svg>
              )}
              <div className={styles.bars} aria-hidden="true">
                <span className={styles.wave1} style={{ height: 40 }} />
                <span className={styles.wave2} style={{ height: 64 }} />
                <span className={styles.wave1} style={{ height: 30 }} />
              </div>
            </div>
            <h1 className={styles.greeting}>{settings?.child_name || ''}</h1>
            <Link href="/games" className={`${styles.start} ${styles.breathe}`} aria-label="Start game">
              <span className={styles.startIcon}>
                <svg aria-hidden="true" width="52" height="52" viewBox="0 0 24 24" fill="#7FA889">
                  <path d="M8 5.5v13l10.5-6.5z" />
                </svg>
              </span>
              <span className={styles.startText}>Start game</span>
            </Link>
          </div>
        )}
      </div>
    </Stage>
  );
}
