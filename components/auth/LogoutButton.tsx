'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import AdultCheck from './AdultCheck';
import styles from './auth.module.css';

/** Quiet corner button for grown-ups (U10). Signs out only after the adult check passes. */
export default function LogoutButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function onPass() {
    setOpen(false);
    try {
      await createSupabaseBrowserClient().auth.signOut();
    } finally {
      router.push('/play/sign-in');
      router.refresh();
    }
  }

  return (
    <>
      <button type="button" className={styles.logout} aria-label="Sign out (grown-ups)" onClick={() => setOpen(true)}>
        <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7A5C50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" />
          <path d="M16 8l4 4-4 4" />
          <path d="M20 12H10" />
        </svg>
      </button>
      <AdultCheck open={open} onPass={onPass} onCancel={() => setOpen(false)} />
    </>
  );
}
