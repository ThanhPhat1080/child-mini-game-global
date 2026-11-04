'use client';

import { useEffect, useState } from 'react';
import { AdminSignOutButton } from '@/components/AdminSignOutButton';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getMyProfile, type Profile } from '@/lib/auth/roles';
import { BAN_REASONS } from '@/lib/policy/reasons';
import styles from '../admin.module.css';

const MAX_PER_DAY = 5;

/**
 * Shown to a banned parent who opens /admin (U13, U15, U17): why, when, and a box to contact the Super Admin.
 * The database allows at most 5 messages a day; the form turns off once it says so.
 */
export default function SuspendedPage() {
  const [me, setMe] = useState<Profile | null>(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [limited, setLimited] = useState(false);

  useEffect(() => {
    getMyProfile(createSupabaseBrowserClient()).then(setMe, () => setMe(null));
  }, []);

  const reason = BAN_REASONS.find((r) => r.code === me?.ban_reason_code);
  const date = me?.banned_at ? new Date(me.banned_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true); setStatus(null);
    const { error } = await createSupabaseBrowserClient().from('support_messages').insert({ body: body.trim() });
    setBusy(false);
    if (!error) { setBody(''); return setStatus({ kind: 'ok', text: 'Message sent. The Super Admin will read it.' }); }
    if (/rate_limited/i.test(error.message)) {
      setLimited(true);
      return setStatus({ kind: 'error', text: `You can send ${MAX_PER_DAY} messages a day. Please try again tomorrow.` });
    }
    setStatus({ kind: 'error', text: 'Could not send the message. Please try again.' });
  }

  return (
    <div className={`${styles.page} ${styles.signWrap}`}>
      <div className={styles.signCol}>
        <div className={styles.card}>
          <h1>Your account is suspended</h1>
          {reason && <p className={styles.sub}><strong>{reason.label}</strong><br />{reason.en}</p>}
          {me?.ban_note && <p className={styles.sub}>Note from the Super Admin: {me.ban_note}</p>}
          {date && <p className={styles.sub}>Since {date}.</p>}
          <p className={styles.sub}>Your children can still play. Their games from other families stay available.</p>

          <form onSubmit={send} aria-label="Message form" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label htmlFor="support-body" style={{ fontWeight: 700 }}>Contact the Super Admin</label>
            <textarea id="support-body" rows={4} maxLength={2000} value={body} disabled={limited} onChange={(e) => setBody(e.target.value)} />
            <button type="submit" className={styles.primary} disabled={busy || limited || !body.trim()}>{busy ? 'Sending…' : 'Send message'}</button>
            {status && <p role={status.kind === 'error' ? 'alert' : 'status'} className={styles.sub} style={{ color: status.kind === 'error' ? '#A8484F' : '#3F6B48' }}>{status.text}</p>}
          </form>
          <AdminSignOutButton />
        </div>
      </div>
    </div>
  );
}
