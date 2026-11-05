'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearActiveChild } from '@/lib/childSession';
import AdultCheck from './AdultCheck';
import styles from './auth.module.css';

/** Quiet corner button for grown-ups (K11). After the adult check: forget the active child and show the picker. No sign-out. */
export default function SwitchChildButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function onPass() {
    setOpen(false);
    clearActiveChild();
    router.push('/play');
  }

  return (
    <>
      <button type="button" className={styles.logout} aria-label="Switch child (grown-ups)" onClick={() => setOpen(true)}>
        <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7A5C50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="8" r="3" />
          <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" />
          <path d="M17 6l3 3-3 3" />
          <path d="M20 9h-5" />
        </svg>
      </button>
      <AdultCheck open={open} onPass={onPass} onCancel={() => setOpen(false)} />
    </>
  );
}
