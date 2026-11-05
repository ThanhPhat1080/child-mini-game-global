'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import PolicyCarousel from '@/components/auth/PolicyCarousel';
import { signInPathFor, type SignInPath } from '@/lib/auth/signInPath';
import { POLICY_VERSION } from '@/lib/policy/slides';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import styles from '../admin/admin.module.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldError = { field: 'email' | 'password' | 'form'; message: string };

function friendlyError(err: { message?: string; code?: string }): FieldError {
  const message = err.message ?? '';
  const code = err.code ?? '';
  if (code === 'user_already_exists' || code === 'email_exists' || /already (been )?registered/i.test(message)) {
    return { field: 'email', message: 'This email already has an account. Try signing in instead.' };
  }
  if (code === 'email_address_invalid' || code === 'validation_failed' || /email address .* is invalid/i.test(message)) {
    return { field: 'email', message: 'This email address is not valid. Check it for typos, or use a different one.' };
  }
  if (code === 'email_address_not_authorized') {
    return { field: 'email', message: 'We cannot send mail to this address yet. Try a different email.' };
  }
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || /rate limit/i.test(message)) {
    return { field: 'form', message: 'Too many attempts. Wait a few minutes, then try again.' };
  }
  if (code === 'weak_password' || /should be at least|weak/i.test(message)) {
    return { field: 'password', message: 'That password is too weak. Try a longer one with letters and numbers.' };
  }
  return { field: 'form', message: 'Something went wrong. Please try again.' };
}

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [carouselOpen, setCarouselOpen] = useState(false);
  // read on mount, not with useSearchParams: that would need a Suspense boundary (FS6)
  const [signInPath, setSignInPath] = useState<SignInPath>('/admin/sign-in');
  useEffect(() => setSignInPath(signInPathFor(window.location.search)), []);
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
          emailRedirectTo: `${location.origin}${signInPath}`,
        },
      });
      if (signUpError) {
        const fe = friendlyError(signUpError);
        if (fe.field === 'email') setEmailError(fe.message);
        else if (fe.field === 'password') setPasswordError(fe.message);
        else setError(fe.message);
        return;
      }
      setDone(true);
    } catch {
      setError(friendlyError({}).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${styles.page} ${styles.signWrap}`}>
      <div className={styles.signCol}>
        <div className={styles.signBrand}>
          <span className={styles.brand} style={{ fontSize: 28 }}>{signInPath === '/play/sign-in' ? 'ABC Play' : 'Parent Admin'}</span>
        </div>

        {done ? (
          <div className={styles.card}>
            <h1>Check your email to confirm your account</h1>
            <p className={styles.sub}>We sent a link to {email.trim()}. Open it, then sign in.</p>
            <Link href={signInPath} className={styles.primary}>Go to sign in</Link>
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
            <p className={styles.foot}>Already have an account? <Link href={signInPath}>Sign in</Link></p>
          </form>
        )}
      </div>
      <PolicyCarousel open={carouselOpen} onClose={() => setCarouselOpen(false)} onAccept={onAccept} />
    </div>
  );
}
