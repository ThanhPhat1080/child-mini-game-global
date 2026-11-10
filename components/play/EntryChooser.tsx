'use client';

import { useRef, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { Pic } from '@/components/Pic';
import { VISITOR_HEAD } from '@/lib/visitor';
import styles from './EntryChooser.module.css';

/**
 * The two doors on the play device (spec GU1): Log in opens the parent form in place, Guest goes to the visitor setup.
 * Keyboard: Left and Right move between the cards, Enter or Space pick (ADR keynav). The focus ring stays visible.
 */
export function EntryChooser({ onLogin }: { onLogin(): void }) {
  const loginRef = useRef<HTMLDivElement>(null);
  const guestRef = useRef<HTMLAnchorElement>(null);

  function moveFocus(e: KeyboardEvent<HTMLElement>, from: 'login' | 'guest') {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    (from === 'login' ? guestRef.current : loginRef.current)?.focus();
  }

  return (
    <div className={styles.row}>
      <div
        ref={loginRef}
        role="button"
        tabIndex={0}
        className={styles.card}
        onClick={onLogin}
        onKeyDown={(e) => {
          moveFocus(e, 'login');
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onLogin();
          }
        }}
      >
        <Pic src="/seed/fish.svg" alt="" width={96} height={96} className={styles.fish} />
        <span className={styles.label}>Log in</span>
      </div>
      <Link
        ref={guestRef}
        href="/play/guest"
        aria-label="Play as guest"
        className={styles.card}
        onKeyDown={(e) => moveFocus(e, 'guest')}
      >
        <span className={styles.duo} aria-hidden="true">
          <Pic src={VISITOR_HEAD.male} alt="" width={96} height={96} className={styles.head} />
          <Pic src={VISITOR_HEAD.female} alt="" width={96} height={96} className={`${styles.head} ${styles.headGirl}`} />
        </span>
        <span className={styles.label}>Guest</span>
      </Link>
    </div>
  );
}
