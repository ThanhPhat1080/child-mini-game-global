'use client';

import { useCallback, useEffect, useState } from 'react';
import { listPeople, type PersonRow } from '@/lib/superAdmin';
import { CreateAccountForm } from '@/components/admin/CreateAccountForm';
import { Toast, useToast } from '@/components/admin/Toast';
import styles from '../../admin.module.css';

/**
 * Super Admins: view the list and add one. Not linked from the menu; open /admin/super directly.
 * Read-only on purpose: no edit, ban or remove for another Super Admin.
 */
export default function SuperAdminsPage() {
  const [admins, setAdmins] = useState<PersonRow[] | null>(null);
  const { toast, show, close } = useToast();

  const load = useCallback(async () => {
    try { setAdmins(await listPeople('super_admin')); } catch (e) { show('error', (e as Error).message); }
  }, [show]);
  useEffect(() => { void load(); }, [load]);

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1>Super Admins</h1>
          <p className={styles.sub}>Everyone who can run this console. You can add one; existing accounts are view only.</p>
        </div>
      </div>
      {admins && admins.length === 0 && <p className={styles.note}>No Super Admins yet.</p>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
        {(admins ?? []).map((a) => (
          <li key={a.userId} className={styles.row} aria-label={`Super Admin ${a.name}`}>
            <div className={styles.rowText}>
              <div className={styles.rowTitle}>{a.name || 'Unnamed'}</div>
              <div className={styles.rowMeta}>Added {new Date(a.createdAt).toLocaleDateString('en-GB')}</div>
            </div>
          </li>
        ))}
      </ul>
      <CreateAccountForm roles={['super_admin']} onCreated={(m) => { show('success', m); void load(); }} onError={(m) => show('error', m)} />
      <Toast toast={toast} onClose={close} />
    </>
  );
}
