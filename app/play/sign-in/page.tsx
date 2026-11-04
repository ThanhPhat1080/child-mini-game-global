'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import styles from '../../admin/admin.module.css';

const FRIENDLY = 'That email or password does not look right. Please try again.';
const GENERIC = 'Something went wrong. Please try again.';

/** Grown-up sign-in on the child's device (U9). The @supabase/ssr browser client persists the session cookie. */
export default function PlaySignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await createSupabaseBrowserClient().auth.signInWithPassword({ email: email.trim(), password });
      if (err) {
        setError(err.code === 'invalid_credentials' || /invalid login/i.test(err.message ?? '') ? FRIENDLY : GENERIC);
        return;
      }
      router.push('/games');
      router.refresh();
    } catch {
      setError(GENERIC);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${styles.page} ${styles.signWrap}`}>
      <div className={styles.signCol}>
        <div className={styles.signBrand}>
          <span className={styles.brand} style={{ fontSize: 28 }}>HaMy</span>
        </div>
        <form className={styles.card} onSubmit={onSubmit} noValidate>
          <div>
            <h1>Grown-ups, sign in</h1>
            <p className={styles.sub}>Sign in once and this device remembers you.</p>
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor="ps-email">Email</label>
            <input id="ps-email" className={styles.input} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor="ps-password">Password</label>
            <input id="ps-password" className={styles.input} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <button type="submit" className={styles.primary} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </div>
  );
}
