'use client';

import { useState, type FormEvent } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import styles from '@/app/admin/admin.module.css';

/** At most this many messages a day (the database trigger enforces it too; spec IN4, U17). */
export const MAX_PER_DAY = 5;

/**
 * "Contact the Super Admin" (IN4, IN5): a text box and Send, shared by the suspended page and the Inbox.
 * It writes one row to `support_messages`. `onSent` runs after a message is stored. `initiallyLimited` turns the
 * form off at once when the parent has already used the day's messages.
 */
export function ContactForm({ onSent, initiallyLimited = false }: { onSent?: () => void; initiallyLimited?: boolean }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [limited, setLimited] = useState(initiallyLimited);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setStatus(null);
    const { error } = await createSupabaseBrowserClient().from('support_messages').insert({ body: body.trim() });
    setBusy(false);
    if (!error) {
      setBody('');
      setStatus({ kind: 'ok', text: 'Message sent. The Super Admin will read it.' });
      onSent?.();
      return;
    }
    if (/rate_limited/i.test(error.message)) {
      setLimited(true);
      setStatus({ kind: 'error', text: `You can send ${MAX_PER_DAY} messages a day. Please try again tomorrow.` });
      return;
    }
    setStatus({ kind: 'error', text: 'Could not send the message. Please try again.' });
  }

  return (
    <form onSubmit={send} aria-label="Message form" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label htmlFor="support-body" style={{ fontWeight: 700 }}>Contact the Super Admin</label>
      <textarea id="support-body" rows={4} maxLength={2000} value={body} disabled={limited} onChange={(e) => setBody(e.target.value)} />
      <button type="submit" className={styles.primary} disabled={busy || limited || !body.trim()}>{busy ? 'Sending…' : 'Send message'}</button>
      {status && (
        <p role={status.kind === 'error' ? 'alert' : 'status'} className={styles.sub} style={{ color: status.kind === 'error' ? '#A8484F' : '#3F6B48' }}>
          {status.text}
        </p>
      )}
    </form>
  );
}
