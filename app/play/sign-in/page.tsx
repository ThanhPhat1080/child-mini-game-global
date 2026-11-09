'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pic } from '@/components/Pic';
import { BounceText } from '@/components/BounceText';
import { SkyScene } from '@/components/play/SkyScene';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { clearVisitor } from '@/lib/visitor';
import { EntryChooser } from '@/components/play/EntryChooser';
import styles from '../../admin/admin.module.css';
import play from './playSignIn.module.css';

const FRIENDLY = 'That email or password does not look right. Please try again.';
const GENERIC = 'Something went wrong. Please try again.';
const BRAND = 'ABC Play';

/**
 * The play device's door (U9, FS1-FS4, GU1): the chooser (Log in | Guest) first; Log in shows the grown-up sign-in form
 * in place. The @supabase/ssr browser client persists the session cookie.
 */
export default function PlaySignIn() {
  const router = useRouter();
  const [mode, setMode] = useState<'choose' | 'login'>('choose');
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
      // A parent wins: signing in erases any visitor data on this device (GU8, Q14).
      clearVisitor();
      router.push('/play');
      router.refresh();
    } catch {
      setError(GENERIC);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${play.wrap} hm-child`}>
      <div className={play.sky}><SkyScene lively /></div>
      <Pic src="/images/princess.webp" alt="" width={520} height={655} className={`${play.hero} ${play.heroLeft}`} />
      <Pic src="/images/prince.webp" alt="" width={520} height={655} className={`${play.hero} ${play.heroRight}`} />
      <div className={play.col}>
        <div className={play.brandRow}>
          <Pic src="/seed/fish.svg" alt="" width={84} height={84} className={play.logo} />
          <span className={`${styles.brand} ${play.brandText}`}>
            <BounceText text={BRAND} delay={1.8} />
          </span>
        </div>
        {mode === 'choose' ? (
          <div className={play.rest}>
            <EntryChooser onLogin={() => setMode('login')} />
          </div>
        ) : (
        <div className={play.rest}>
          <button type="button" className={play.backText} onClick={() => setMode('choose')}>
            <span aria-hidden="true">&larr;</span> Back
          </button>
          <form className={styles.card} onSubmit={onSubmit} noValidate>
            <div className={play.loginHead}>
              <h1>Let's play together</h1>
              <p className={styles.sub}>Sign in and play along with your child.</p>
            </div>
            <div className={styles.fieldGroup}>
              <label htmlFor="ps-email">Parent Email</label>
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
              <p>ABC Play is a calm game space for young children. You set up the games, then play along with your child.</p>
              <ol>
                <li>Create an account with your email.</li>
                <li>Open the link we email you to confirm it.</li>
                <li>Sign in, open Parent configuration and add your child.</li>
              </ol>
            </div>
          )}
          <p className={styles.foot}>Managing content? <Link href="/admin/sign-in">Go to Parent Admin</Link></p>
        </div>
        )}
      </div>
    </div>
  );
}
