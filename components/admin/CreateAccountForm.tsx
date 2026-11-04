'use client';

import { useState } from 'react';
import { createAccount, type CreatedRole } from '@/lib/superAdmin';
import styles from '@/app/admin/admin.module.css';

/** Super Admin creates a parent, child or Super Admin through /api/users (N5, U8). */
export function CreateAccountForm({ roles, parents = [], onCreated, onError }: {
  roles: CreatedRole[]; parents?: { userId: string; name: string }[]; onCreated: (message: string) => void; onError: (message: string) => void;
}) {
  const [role, setRole] = useState<CreatedRole>(roles[0]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [parentId, setParentId] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createAccount({ role, email, password, displayName: name, ...(role === 'child' ? { parentId } : {}) });
      setName(''); setEmail(''); setPassword('');
      onCreated('Account created.');
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.section} onSubmit={submit} aria-label="Create account">
      <h2>Create an account</h2>
      {roles.length > 1 && (
        <div className={styles.fieldGroup}>
          <label htmlFor="acc-role">Role</label>
          <select id="acc-role" className={styles.input} value={role} onChange={(e) => setRole(e.target.value as CreatedRole)}>
            {roles.map((r) => <option key={r} value={r}>{r === 'super_admin' ? 'Super Admin' : r === 'parent' ? 'Parent' : 'Child'}</option>)}
          </select>
        </div>
      )}
      {role === 'child' && (
        <div className={styles.fieldGroup}>
          <label htmlFor="acc-parent">Parent</label>
          <select id="acc-parent" className={styles.input} value={parentId} onChange={(e) => setParentId(e.target.value)} required>
            <option value="">Choose a parent…</option>
            {parents.map((p) => <option key={p.userId} value={p.userId}>{p.name || p.userId}</option>)}
          </select>
        </div>
      )}
      <div className={styles.fieldGroup}>
        <label htmlFor="acc-name">Name</label>
        <input id="acc-name" className={styles.input} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className={styles.fieldGroup}>
        <label htmlFor="acc-email">Email</label>
        <input id="acc-email" className={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className={styles.fieldGroup}>
        <label htmlFor="acc-password">Password (at least 8 characters)</label>
        <input id="acc-password" className={styles.input} type="password" minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <button type="submit" className={styles.primary} disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
    </form>
  );
}
