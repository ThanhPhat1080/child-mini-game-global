'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearActiveChild } from '@/lib/childSession';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import AdultCheck from './AdultCheck';
import ExitDoorIcon from './ExitDoorIcon';
import FarewellPopup from './FarewellPopup';
import styles from './auth.module.css';

/** The farewell stays this long before the parent is signed out (FP14). */
const FAREWELL_MS = 2000;

/** Quiet corner button for grown-ups (U10). After the adult check: a farewell for 2 s, then sign out, forget the active child, back to the play sign-in page (FS7). */
export default function LogoutButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [farewell, setFarewell] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function onPass() {
    setOpen(false);
    setFarewell(true);
    timer.current = setTimeout(() => void signOutNow(), FAREWELL_MS);
  }

  async function signOutNow() {
    let failed = false;
    try {
      const { error } = await createSupabaseBrowserClient().auth.signOut();
      failed = !!error;
    } catch {
      failed = true;
    }
    if (failed) {
      setFarewell(false); // still signed in: back to the page
      return;
    }
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
      <AdultCheck open={open} onPass={onPass} onCancel={() => setOpen(false)} title="Sign out now?" hint="Finish the sum below to sign out." icon={<ExitDoorIcon />} centered submitLabel="Signout now!" />
      {farewell && <FarewellPopup />}
    </>
  );
}
