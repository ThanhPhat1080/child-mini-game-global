'use client';

import { useCallback, useEffect, useState } from 'react';
import { listMessages, listPeople, markMessage, type SupportMessage } from '@/lib/superAdmin';
import { Toast, useToast } from '@/components/admin/Toast';
import styles from '../../admin.module.css';

/** Messages from parents (U17, N9): mark read and resolved. */
export default function MessagesPage() {
  const [msgs, setMsgs] = useState<SupportMessage[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const { toast, show, close } = useToast();

  const load = useCallback(async () => {
    try {
      const [m, parents] = await Promise.all([listMessages(), listPeople('parent')]);
      setMsgs(m);
      setNames(Object.fromEntries(parents.map((p) => [p.userId, p.name || 'Unnamed parent'])));
    } catch (e) { show('error', (e as Error).message); }
  }, [show]);
  useEffect(() => { void load(); }, [load]);

  async function mark(id: string, patch: { read?: boolean; resolved?: boolean }) {
    try { await markMessage(id, patch); await load(); } catch (e) { show('error', (e as Error).message); }
  }

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1>Messages</h1>
          <p className={styles.sub}>Notes from parents, including suspended ones.</p>
        </div>
      </div>
      {msgs && msgs.length === 0 && <p className={styles.note}>No messages.</p>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
        {(msgs ?? []).map((m) => (
          <li key={m.id} className={styles.section} aria-label={`Message from ${names[m.fromUser] ?? 'a parent'}`} style={{ opacity: m.resolvedAt ? 0.7 : 1 }}>
            <div>
              <h2>{names[m.fromUser] ?? 'A parent'}</h2>
              <p>{new Date(m.createdAt).toLocaleString('en-GB')} · {m.resolvedAt ? 'Resolved' : m.readAt ? 'Read' : 'New'}</p>
            </div>
            <p style={{ whiteSpace: 'pre-wrap', color: '#4A3830', fontSize: 15 }}>{m.body}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              {!m.readAt && <button type="button" className={styles.ghost} onClick={() => mark(m.id, { read: true })}>Mark read</button>}
              {!m.resolvedAt
                ? <button type="button" className={styles.primary} onClick={() => mark(m.id, { resolved: true })}>Mark resolved</button>
                : <button type="button" className={styles.ghost} onClick={() => mark(m.id, { resolved: false })}>Reopen</button>}
            </div>
          </li>
        ))}
      </ul>
      <Toast toast={toast} onClose={close} />
    </>
  );
}
