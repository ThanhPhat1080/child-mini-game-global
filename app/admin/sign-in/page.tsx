'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { adminAccess, getMyProfile } from '@/lib/auth/roles';
import styles from '../admin.module.css';

/** Where each adminAccess result goes after sign-in (U11). */
const DESTINATION = { ok: '/admin', forbidden: '/admin/forbidden', banned: '/admin/suspended' } as const;

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError('Wrong email or password.');
      setBusy(false);
      return;
    }

    const access = adminAccess(await getMyProfile(supabase));
    if (access === 'signin') {
      await supabase.auth.signOut();
      setError('This account cannot open the admin yet. Please try again later.');
      setBusy(false);
      return;
    }

    router.push(DESTINATION[access]);
    router.refresh();
  }

  return (
    <div className={`${styles.page} ${styles.signWrap}`}>
      <div className={styles.signCol}>
        <div className={styles.signBrand}>
          <span className={styles.crownDot} style={{ width: 52, height: 52 }}>
            <svg aria-hidden="true" width="30" height="22" viewBox="0 0 60 42" fill="#F6E2A6" stroke="#B08A48" strokeWidth="3" strokeLinejoin="round">
              <path d="M4 38 L8 10 L20 24 L30 4 L40 24 L52 10 L56 38 Z" />
            </svg>
          </span>
          <span className={styles.brand} style={{ fontSize: 28 }}>Parent Admin</span>
        </div>

        <form className={styles.card} onSubmit={onSubmit}>
          <div>
            <h1>Parent Admin sign-in</h1>
            <p className={styles.sub}>Manage greeting, music and quiz content.</p>
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor="em">Email</label>
            <input id="em" className={styles.input} type="email" placeholder="parent@example.com" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor="pw">Password</label>
            <input id="pw" className={styles.input} type="password" placeholder="••••••••" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <button type="submit" className={styles.primary} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>

        <p className={styles.foot}><Link href="/sign-up">Create a parent account</Link></p>
        <p className={styles.foot}>Want to play? <Link href="/play/sign-in">Go to the play area</Link></p>
        <p className={styles.foot}>Parents and Super Admins · Supabase Auth</p>
      </div>
    </div>
  );
}
