'use client';

import { useCallback, useEffect, useState } from 'react';
import { listPeople, type PersonRow } from '@/lib/superAdmin';
import { CreateAccountForm } from '@/components/admin/CreateAccountForm';
import { Toast, useToast } from '@/components/admin/Toast';
import styles from '../../admin.module.css';

/** Every child with their parent (N5), and creating a child for a parent. */
export default function AllChildrenPage() {
  const [kids, setKids] = useState<PersonRow[] | null>(null);
  const [parents, setParents] = useState<PersonRow[]>([]);
  const { toast, show, close } = useToast();

  const load = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([listPeople('child'), listPeople('parent')]);
      setKids(c); setParents(p);
    } catch (e) { show('error', (e as Error).message); }
  }, [show]);
  useEffect(() => { void load(); }, [load]);

  const parentName = (id: string | null) => parents.find((p) => p.userId === id)?.name || 'Unknown parent';

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1>Children</h1>
          <p className={styles.sub}>All children and the parent each belongs to.</p>
        </div>
      </div>
      {kids && kids.length === 0 && <p className={styles.note}>No children yet.</p>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
        {(kids ?? []).map((k) => (
          <li key={k.userId} className={styles.row}>
            <div className={styles.rowText}>
              <div className={styles.rowTitle}>{k.name || 'Unnamed child'}</div>
              <div className={styles.rowMeta}>Parent: {parentName(k.parentId)}</div>
            </div>
          </li>
        ))}
      </ul>
      <CreateAccountForm roles={['child']} parents={parents} onCreated={(m) => { show('success', m); void load(); }} onError={(m) => show('error', m)} />
      <Toast toast={toast} onClose={close} />
    </>
  );
}
