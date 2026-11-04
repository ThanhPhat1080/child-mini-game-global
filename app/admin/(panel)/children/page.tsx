'use client';

import { useCallback, useEffect, useState } from 'react';
import { mediaUrl } from '@/lib/media';
import { listMyChildren, type ChildSummary } from '@/lib/settings';
import { MAX_CHILDREN } from '@/lib/auth/limits';
import { ChildForm } from '@/components/admin/ChildForm';
import { Toast, useToast } from '@/components/admin/Toast';
import { Pic } from '@/components/Pic';
import styles from '../../admin.module.css';

const ADD_ERRORS: Record<string, string> = {
  child_limit: `You already have ${MAX_CHILDREN} children.`,
  email_taken: 'That email is already used.',
  invalid_body: 'Check the email, a password of at least 8 characters and a name.',
  forbidden: 'You are not allowed to add a child.',
  unauthenticated: 'Please sign in again.',
};

/** Parent dashboard (N2): the parent's children (at most 5), add one, edit name, avatar and sounds. */
export default function ChildrenPage() {
  const [kids, setKids] = useState<ChildSummary[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast, show, close } = useToast();

  const load = useCallback(async () => {
    try {
      setKids(await listMyChildren());
    } catch {
      show('error', 'Could not load your children.');
    }
  }, [show]);

  useEffect(() => { void load(); }, [load]);

  const full = (kids?.length ?? 0) >= MAX_CHILDREN;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/children', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName: name }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        return show('error', ADD_ERRORS[body?.error ?? ''] ?? 'Could not add the child.');
      }
      setEmail(''); setPassword(''); setName(''); setAdding(false);
      show('success', 'Child added.');
      await load();
    } catch {
      show('error', 'Could not add the child.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1>Children</h1>
          <p className={styles.sub}>Up to {MAX_CHILDREN} children. Each one signs in with their own email and password.</p>
        </div>
        <button type="button" className={styles.primary} disabled={full || adding || !kids} onClick={() => setAdding(true)}>
          Add child
        </button>
      </div>

      {full && <p className={styles.note}>You have reached the limit of {MAX_CHILDREN} children.</p>}

      {adding && (
        <form className={styles.section} onSubmit={add} aria-label="Add child">
          <div className={styles.fieldGroup}>
            <label htmlFor="child-name">Child&apos;s name</label>
            <input id="child-name" className={styles.input} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor="child-email">Email for the child</label>
            <input id="child-email" className={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor="child-password">Password (at least 8 characters)</label>
            <input id="child-password" className={styles.input} type="password" value={password} minLength={8} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className={styles.primary} disabled={busy}>{busy ? 'Adding…' : 'Create child'}</button>
            <button type="button" className={styles.ghost} disabled={busy} onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </form>
      )}

      {kids && kids.length === 0 && !adding && <p className={styles.note}>No children yet. Add the first one.</p>}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
        {(kids ?? []).map((k) => (
          <li key={k.child_id}>
            <div className={styles.row}>
              <div className={styles.avatar} style={{ width: 48, height: 48 }}>
                {mediaUrl(k.avatar_path) && <Pic src={mediaUrl(k.avatar_path) ?? ''} alt="" className={styles.avatarImg} />}
              </div>
              <div className={styles.rowText}>
                <div className={styles.rowTitle}>{k.child_name || 'Unnamed child'}</div>
              </div>
              <button type="button" className={styles.ghost} onClick={() => setEditing(editing === k.child_id ? null : k.child_id)}>
                {editing === k.child_id ? 'Close' : 'Edit'}
              </button>
            </div>
            {editing === k.child_id && (
              <ChildForm
                childId={k.child_id}
                onClose={() => setEditing(null)}
                onSaved={(s) => setKids((all) => all && all.map((x) => (x.child_id === s.child_id ? { ...x, child_name: s.child_name, avatar_path: s.avatar_path } : x)))}
              />
            )}
          </li>
        ))}
      </ul>

      <Toast toast={toast} onClose={close} />
    </>
  );
}
