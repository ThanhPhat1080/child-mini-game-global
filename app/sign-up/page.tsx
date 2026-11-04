'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import PolicyCarousel from '@/components/auth/PolicyCarousel';
import { POLICY_VERSION } from '@/lib/policy/slides';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import styles from '../admin/admin.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function friendlyError(err: { message?: string; code?: string }): string {
  const message = err.message ?? '';
  if (err.code === 'user_already_exists' || /already registered/i.test(message)) {
    return 'This email already has an account. Try signing in instead.';
  }
  if (err.code === 'weak_password' || /should be at least|weak/i.test(message)) {
    return 'That password is too weak. Try a longer one with letters and numbers.';
  }
  return 'Something went wrong. Please try again.';
}

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const eErr = EMAIL_RE.test(email.trim()) ? null : 'Enter a valid email address.';
    const pErr = password.length >= 8 ? null : 'Password must be at least 8 characters.';
    setEmailError(eErr);
    setPasswordError(pErr);
    setError(null);
    if (eErr || pErr) return;
    setCarouselOpen(true);
  }

  async function onAccept() {
    setCarouselOpen(false);
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { policy_version: POLICY_VERSION },
          emailRedirectTo: `${location.origin}/admin/sign-in`,
        },
      });
      if (signUpError) {
        setError(friendlyError(signUpError));
        return;
      }
      setDone(true);
    } catch {
      setError(friendlyError({}));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${styles.page} ${styles.signWrap}`}>
      <div className={styles.signCol}>
        <div className={styles.signBrand}>
          <span className={styles.brand} style={{ fontSize: 28 }}>Parent Admin</span>
        </div>

        {done ? (
          <div className={styles.card}>
            <h1>Check your email to confirm your account</h1>
            <p className={styles.sub}>We sent a link to {email.trim()}. Open it, then sign in.</p>
            <Link href="/admin/sign-in" className={styles.primary}>Go to sign in</Link>
          </div>
        ) : (
          <form className={styles.card} onSubmit={onSubmit} noValidate>
            <div>
              <h1>Create a parent account</h1>
              <p className={styles.sub}>Make quizzes and games for your child.</p>
            </div>
            <div className={styles.fieldGroup}>
              <label htmlFor="su-email">Email</label>
              <input id="su-email" className={styles.input} type="email" placeholder="parent@example.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              {emailError && <p role="alert" className={styles.error}>{emailError}</p>}
            </div>
            <div className={styles.fieldGroup}>
              <label htmlFor="su-password">Password</label>
              <input id="su-password" className={styles.input} type="password" placeholder="At least 8 characters" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              {passwordError && <p role="alert" className={styles.error}>{passwordError}</p>}
            </div>
            {error && <p role="alert" className={styles.error}>{error}</p>}
            <button type="submit" className={styles.primary} disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
            <p className={styles.foot}>Already have an account? <Link href="/admin/sign-in">Sign in</Link></p>
          </form>
        )}
      </div>
      <PolicyCarousel open={carouselOpen} onClose={() => setCarouselOpen(false)} onAccept={onAccept} />
    </div>
  );
}
