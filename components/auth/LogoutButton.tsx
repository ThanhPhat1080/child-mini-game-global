'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearActiveChild } from '@/lib/childSession';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import AdultCheck from './AdultCheck';
import styles from './auth.module.css';

/** Quiet corner button for grown-ups (U10). After the adult check: sign out, forget the active child, back to the play sign-in page (FS7). */
export default function LogoutButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function onPass() {
    setOpen(false);
    let failed = false;
    try {
      const { error } = await createSupabaseBrowserClient().auth.signOut();
      failed = !!error;
    } catch {
      failed = true;
    }
    if (failed) return; // still signed in: stay on the page
    clearActiveChild();
    router.push('/play/sign-in');
    router.refresh();
  }

  return (
    <>
      <button type="button" className={styles.leave} aria-label="Sign out (grown-ups)" onClick={() => setOpen(true)}>
        <svg aria-hidden="true" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#7A5C50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <g transform="matrix(-1 0 0 1 24 0)">
            <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" />
            <path d="M16 8l4 4-4 4" />
            <path d="M20 12H10" />
          </g>
        </svg>
      </button>
      <AdultCheck open={open} onPass={onPass} onCancel={() => setOpen(false)} />
    </>
  );
}
