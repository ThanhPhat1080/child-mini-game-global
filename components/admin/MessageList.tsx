'use client';

import styles from '@/app/admin/admin.module.css';
import ui from '@/components/admin/admin-ui.module.css';
import { STATUS_LABEL, messageStatus, type OwnMessage } from '@/lib/inbox';

/** The parent's own messages with their status (IN6, IN7). Newest first, as the data arrives. */
export function MessageList({ messages }: { messages: OwnMessage[] | null }) {
  return (
    <section aria-labelledby="your-messages">
      <h2 id="your-messages" className={styles.sub} style={{ fontSize: 18, fontWeight: 700, color: '#4a3830', margin: '0 0 10px' }}>Your messages</h2>
      {messages && messages.length === 0 && (
        <p className={styles.note}>No messages yet. Write to the Super Admin above whenever you need help.</p>
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(messages ?? []).map((m) => (
          <li key={m.id} className={`${styles.section} ${ui.msgItem}`} style={{ padding: '14px 18px', gap: 6 }}>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.body}</p>
            <span className={styles.sub} style={{ fontSize: 13 }}>
              {new Date(m.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {' · '}
              <strong>{STATUS_LABEL[messageStatus(m)]}</strong>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
