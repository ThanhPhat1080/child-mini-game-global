'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { listMessages, listPeople, markMessage, type PersonRow, type SupportMessage } from '@/lib/superAdmin';
import { matches, sortBy, type SortOrder } from '@/lib/people';
import { ListToolbar } from '@/components/admin/ListToolbar';
import { ParentRow } from '@/components/admin/ParentRow';
import { Toast, useToast } from '@/components/admin/Toast';
import styles from '../../admin.module.css';
import ui from '@/components/admin/admin-ui.module.css';

type Tab = 'pending' | 'history';
const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'az', label: 'Parent A–Z' },
];

/**
 * Messages from parents (U17, N9, N17). Pending = not resolved; History = resolved. Search and sort by the parent.
 * Each change tells the nav (cp:messages-changed) so its red dot updates.
 */
export default function MessagesPage() {
  const [msgs, setMsgs] = useState<SupportMessage[] | null>(null);
  const [parents, setParents] = useState<Record<string, PersonRow>>({});
  const [tab, setTab] = useState<Tab>('pending');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOrder>('newest');
  const { toast, show, close } = useToast();

  const load = useCallback(async () => {
    try {
      const [m, people] = await Promise.all([listMessages(), listPeople('parent')]);
      setMsgs(m);
      setParents(Object.fromEntries(people.map((p) => [p.userId, p])));
    } catch (e) { show('error', (e as Error).message); }
  }, [show]);
  useEffect(() => { void load(); }, [load]);

  const nameOf = (userId: string) => parents[userId]?.name ?? '';

  const visible = useMemo(() => {
    const inTab = (msgs ?? []).filter((m) => (tab === 'pending' ? !m.resolvedAt : !!m.resolvedAt) && matches(query, nameOf(m.fromUser)));
    // newest first; for A to Z the stable sort keeps the newest first within one parent
    const newest = sortBy(inTab, 'newest', (m) => ({ created: m.createdAt, name: '' }));
    return sort === 'az' ? sortBy(newest, 'az', (m) => ({ created: m.createdAt, name: nameOf(m.fromUser) || 'A parent' })) : newest;
  }, [msgs, tab, query, sort, parents]);

  async function mark(id: string, patch: { read?: boolean; resolved?: boolean }) {
    try {
      await markMessage(id, patch);
      window.dispatchEvent(new Event('cp:messages-changed'));
      await load();
    } catch (e) { show('error', (e as Error).message); }
  }

  const tabButton = (value: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === value}
      className={`${ui.tab} ${tab === value ? ui.tabActive : ''}`}
      onClick={() => setTab(value)}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1>Messages</h1>
          <p className={styles.sub}>Notes from parents, including suspended ones.</p>
        </div>
      </div>

      <div role="tablist" aria-label="Messages" className={ui.tabs}>
        {tabButton('pending', 'Pending')}
        {tabButton('history', 'History')}
      </div>

      <ListToolbar
        query={query}
        onQuery={setQuery}
        searchLabel="Search by parent name"
        placeholder="Search by parent name"
        sort={sort}
        onSort={setSort}
        sortOptions={SORT_OPTIONS}
      />

      {msgs && visible.length === 0 && (
        <p className={styles.note}>
          {query.trim() ? 'No messages match.' : tab === 'pending' ? 'No pending messages.' : 'No resolved messages.'}
        </p>
      )}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
        {visible.map((m) => {
          const parent = parents[m.fromUser];
          const summary = { userId: m.fromUser, name: parent?.name ?? '', banned: parent?.banned ?? false, quotaBytes: parent?.quotaBytes ?? 0 };
          return (
            <li key={m.id} className={styles.section} aria-label={`Message from ${parent?.name || 'a parent'}`} style={{ opacity: m.resolvedAt ? 0.7 : 1 }}>
              <ParentRow parent={summary} />
              <p>{new Date(m.createdAt).toLocaleString('en-GB')} · {m.resolvedAt ? 'Resolved' : m.readAt ? 'Read' : 'New'}</p>
              <p style={{ whiteSpace: 'pre-wrap', color: '#4A3830', fontSize: 15 }}>{m.body}</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {!m.readAt && <button type="button" className={styles.ghost} onClick={() => mark(m.id, { read: true })}>Mark read</button>}
                {!m.resolvedAt
                  ? <button type="button" className={styles.primary} onClick={() => mark(m.id, { resolved: true })}>Mark resolved</button>
                  : <button type="button" className={styles.ghost} onClick={() => mark(m.id, { resolved: false })}>Reopen</button>}
              </div>
            </li>
          );
        })}
      </ul>
      <Toast toast={toast} onClose={close} />
    </>
  );
}
