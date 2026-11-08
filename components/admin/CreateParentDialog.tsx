'use client';

import { useId, useState } from 'react';
import { createAccount } from '@/lib/superAdmin';
import { ModalClose } from '@/components/ModalClose';
import styles from '@/app/admin/admin.module.css';

/**
 * Create a parent (N13): name, email and password through /api/users (the same checks as the account form).
 * On success it hands back the new user id, so the page can open that parent's detail.
 */
export function CreateParentDialog({ onCreated, onCancel }: { onCreated: (userId: string) => void; onCancel: () => void }) {
  const titleId = useId();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const userId = await createAccount({ role: 'parent', email, password, displayName: name });
      onCreated(userId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const requestClose = () => { if (!busy) onCancel(); };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(74,56,48,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box', zIndex: 50 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') requestClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} style={{ position: 'relative', background: '#fff', borderRadius: 20, padding: 28, maxWidth: 480, width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'Nunito, sans-serif', color: '#4A3830' }}>
        <ModalClose onClick={requestClose} disabled={busy} />
        <h2 id={titleId} style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>Create parent</h2>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className={styles.fieldGroup}>
            <label htmlFor={`${titleId}-name`}>Name</label>
            <input id={`${titleId}-name`} className={styles.input} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor={`${titleId}-email`}>Email</label>
            <input id={`${titleId}-email`} className={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor={`${titleId}-password`}>Password (at least 8 characters)</label>
            <input id={`${titleId}-password`} className={styles.input} type="password" minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className={styles.ghost} disabled={busy} onClick={requestClose}>Cancel</button>
            <button type="submit" className={styles.primary} disabled={busy}>{busy ? 'Creating…' : 'Create parent'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
