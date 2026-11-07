'use client';

import { useEffect, useState } from 'react';
import { ContactForm } from '@/components/admin/ContactForm';
import { AdminSignOutButton } from '@/components/AdminSignOutButton';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getMyProfile, type Profile } from '@/lib/auth/roles';
import { BAN_REASONS } from '@/lib/policy/reasons';
import styles from '../admin.module.css';

/**
 * Shown to a banned parent who opens /admin (U13, U15, U17): why, when, and a box to contact the Super Admin.
 * The database allows at most 5 messages a day; the form turns off once it says so.
 */
export default function SuspendedPage() {
  const [me, setMe] = useState<Profile | null>(null);

  useEffect(() => {
    getMyProfile(createSupabaseBrowserClient()).then(setMe, () => setMe(null));
  }, []);

  const reason = BAN_REASONS.find((r) => r.code === me?.ban_reason_code);
  const date = me?.banned_at ? new Date(me.banned_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  return (
    <div className={`${styles.page} ${styles.signWrap}`}>
      <div className={styles.signCol}>
        <div className={styles.card}>
          <h1>Your account is suspended</h1>
          {reason && <p className={styles.sub}><strong>{reason.label}</strong><br />{reason.en}</p>}
          {me?.ban_note && <p className={styles.sub}>Note from the Super Admin: {me.ban_note}</p>}
          {date && <p className={styles.sub}>Since {date}.</p>}
          <p className={styles.sub}>Your children can still play. Their games from other families stay available.</p>

          <ContactForm />
          <AdminSignOutButton />
        </div>
      </div>
    </div>
  );
}
