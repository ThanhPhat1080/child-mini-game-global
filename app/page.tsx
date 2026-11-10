'use client';

import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { isGuestPlay } from '@/lib/childSession';
import { clearVisitor, getVisitor, hasVisitorMarker } from '@/lib/visitor';
import { mediaUrl } from '@/lib/media';
import { playVoice, VOICE_URL } from '@/lib/voice';
import { playOnce, startMusic } from '@/lib/audio';
import { DEFAULT_MUSIC_URL, MUSIC_VOLUME } from '@/lib/defaultMusic';
import { BOY_WELCOME_VARS, GENDER_THEME } from '@/lib/childTheme';
import { useActiveChild } from '@/lib/useActiveChild';
import { ChildScreen } from '@/components/ChildScreen';
import { LivelyScene } from '@/components/play/LivelyScene';
import { BounceText } from '@/components/BounceText';
import styles from './welcome.module.css';
import { Pic } from '@/components/Pic';

const CROWN = 'M4 38 L8 10 L20 24 L30 4 L40 24 L52 10 L56 38 Z';

/** Welcome (C1, FP9). Nothing plays until the child taps the big button (ADR-016). The picture and colors follow the child's gender. */
export default function Welcome() {
  const child = useActiveChild();
  const router = useRouter();
  const settings = child.settings;
  // A bare or forged visitor cookie (marker, no saved data) and no child: back to the sign-in chooser (Review Focus 1).
  // A failed load with a real child or a real visitor stays on the page, as before.
  useEffect(() => {
    if (child.status !== 'failed' || getVisitor() || isGuestPlay() || !hasVisitorMarker()) return;
    clearVisitor();
    router.replace('/play/sign-in');
  }, [child.status, router]);
  const known = child.status !== 'loading';
  const [entered, setEntered] = useState(false);
  const theme = GENDER_THEME[child.gender ?? 'female'];
  const vars = child.gender === 'male' ? (BOY_WELCOME_VARS as CSSProperties) : undefined;

  function onEnter() {
    setEntered(true);
    // a guest or visitor has no recorded greeting of their own: the built-in welcome plays
    const own = mediaUrl(settings?.greeting_path);
    if (own) playOnce(own);
    else if (getVisitor() || isGuestPlay()) playVoice(VOICE_URL.welcomeGuest);
    startMusic(DEFAULT_MUSIC_URL, MUSIC_VOLUME);
  }

  return (
    <ChildScreen music leave>
      <div className={styles.scene} data-welcome-scene style={vars}>

        <LivelyScene>
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
        </LivelyScene>

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
              {child.avatarUrl ? (
                <Pic src={child.avatarUrl} alt="" className={styles.avatarImg} />
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
    </ChildScreen>
  );
}
