'use client';

import { useCallback, useEffect, useState } from 'react';
import { listAllChildren, removeChild, type AdminChild } from '@/lib/superAdmin';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { Toast, useToast } from '@/components/admin/Toast';
import styles from '../../admin.module.css';

/** Every child with their parent (N5). Read-only except removing a child, which asks first. */
export default function AllChildrenPage() {
  const [kids, setKids] = useState<AdminChild[] | null>(null);
  const [target, setTarget] = useState<AdminChild | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, show, close } = useToast();

  const load = useCallback(async () => {
    try {
      setKids(await listAllChildren());
    } catch (e) { show('error', (e as Error).message); }
  }, [show]);
  useEffect(() => { void load(); }, [load]);

  async function confirmRemove() {
    if (!target) return;
    setBusy(true);
    try {
      await removeChild(target.id);
      setTarget(null);
      show('success', 'Child removed.');
      await load();
    } catch (e) {
      setTarget(null);
      show('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

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
          <li key={k.id} className={styles.row}>
            <div className={styles.rowText}>
              <div className={styles.rowTitle}>{k.display_name || k.child_name || 'Unnamed child'}</div>
              <div className={styles.rowMeta}>Parent: {k.parent_name || 'Unknown parent'}</div>
            </div>
            <button type="button" className={styles.ghost} onClick={() => setTarget(k)}>Remove</button>
          </li>
        ))}
      </ul>
      {target && (
        <ConfirmDialog
          title="Remove this child?"
          body={`${target.display_name || target.child_name} and their settings will be deleted. This cannot be undone.`}
          button="Remove"
          busy={busy}
          onCancel={() => setTarget(null)}
          onConfirm={() => void confirmRemove()}
        />
      )}
      <Toast toast={toast} onClose={close} />
    </>
  );
}
