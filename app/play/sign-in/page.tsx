'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pic } from '@/components/Pic';
import { SkyScene } from '@/components/play/SkyScene';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import styles from '../../admin/admin.module.css';
import play from './playSignIn.module.css';

const FRIENDLY = 'That email or password does not look right. Please try again.';
const GENERIC = 'Something went wrong. Please try again.';

/** Grown-up sign-in on the child's device (U9, FS1-FS4). The @supabase/ssr browser client persists the session cookie. */
export default function PlaySignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);

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
      router.push('/play');
      router.refresh();
    } catch {
      setError(GENERIC);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={play.wrap}>
      <SkyScene />
      <Pic src="/images/princess.webp" alt="" width={520} height={655} className={`${play.hero} ${play.heroLeft}`} />
      <Pic src="/images/prince.webp" alt="" width={520} height={655} className={`${play.hero} ${play.heroRight}`} />
      <div className={play.col}>
        <div className={play.brandRow}>
          <span className={styles.brand} style={{ fontSize: 28 }}>childPlayer</span>
          <span className={play.tag}>
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 11h4M8 9v4M15 12h.01M18 10h.01" />
              <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258A4 4 0 0 0 17.32 5z" />
            </svg>
            Play area
          </span>
        </div>
        <form className={styles.card} onSubmit={onSubmit} noValidate>
          <div>
            <h1>Grown-ups, sign in</h1>
            <p className={styles.sub}>Sign in and play along with your child.</p>
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
        <div className={play.signupRow}>
          <span>No account yet?</span>
          <Link href="/sign-up?from=play">Sign up now</Link>
          <button
            type="button"
            className={play.helpBtn}
            aria-label="How do I create an account?"
            aria-expanded={help}
            aria-controls="play-help"
            onClick={() => setHelp((v) => !v)}
          >
            ?
          </button>
        </div>
        {help && (
          <div id="play-help" className={play.helpPanel}>
            <p>childPlayer is a calm game space for young children. You set up the games, then play along with your child.</p>
            <ol>
              <li>Create an account with your email.</li>
              <li>Open the link we email you to confirm it.</li>
              <li>Sign in, open Parent configuration and add your child.</li>
            </ol>
          </div>
        )}
        <p className={styles.foot}>Managing content? <Link href="/admin/sign-in">Go to Parent Admin</Link></p>
      </div>
    </div>
  );
}
