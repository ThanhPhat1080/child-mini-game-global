'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import styles from '@/app/admin/admin.module.css';

/** Sign-out for the open admin status pages (forbidden, suspended). Asks first, like the admin menu. */
export function AdminSignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await createSupabaseBrowserClient().auth.signOut();
    } finally {
      router.push('/admin/sign-in');
      router.refresh();
    }
  }

  return (
    <>
      <button type="button" className={styles.primary} onClick={() => setAsking(true)} disabled={busy}>
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
      {asking && (
        <ConfirmDialog
          tone="neutral"
          title="Sign out?"
          body="You will need to sign in again to use the admin."
          button="Sign out"
          busy={busy}
          onCancel={() => setAsking(false)}
          onConfirm={() => void signOut()}
        />
      )}
    </>
  );
}
