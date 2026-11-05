'use client';

import { useState } from 'react';
import { createAccount, type CreatedRole } from '@/lib/superAdmin';
import styles from '@/app/admin/admin.module.css';

/** Super Admin creates a parent or Super Admin through /api/users (N5, U8). */
export function CreateAccountForm({ roles, onCreated, onError }: {
  roles: CreatedRole[]; onCreated: (message: string) => void; onError: (message: string) => void;
}) {
  const [role, setRole] = useState<CreatedRole>(roles[0]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createAccount({ role, email, password, displayName: name });
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
            {roles.map((r) => <option key={r} value={r}>{r === 'super_admin' ? 'Super Admin' : 'Parent'}</option>)}
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
