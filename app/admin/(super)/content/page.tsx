'use client';

import { useCallback, useEffect, useState } from 'react';
import { deleteItem, listContent, listPeople, TABLE_LABEL, unpublishItem, type ContentItem } from '@/lib/superAdmin';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { Toast, useToast } from '@/components/admin/Toast';
import { VisibilityBadge } from '@/components/admin/VisibilityBadge';
import styles from '../../admin.module.css';

/** All-content browser (N5, V5): every item of every owner, unpublish a global one, or delete any. */
export default function ContentPage() {
  const [items, setItems] = useState<ContentItem[] | null>(null);
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<ContentItem | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, show, close } = useToast();

  const load = useCallback(async () => {
    try {
      const [all, parents, supers] = await Promise.all([listContent(), listPeople('parent'), listPeople('super_admin')]);
      setItems(all);
      setOwners(Object.fromEntries([...parents, ...supers].map((p) => [p.userId, p.name || 'Unnamed'])));
    } catch (e) { show('error', (e as Error).message); }
  }, [show]);
  useEffect(() => { void load(); }, [load]);

  async function run(fn: () => Promise<void>, done: string) {
    setBusy(true);
    try { await fn(); show('success', done); setConfirm(null); await load(); }
    catch (e) { show('error', (e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1>All content</h1>
          <p className={styles.sub}>Everything parents made. Unpublish a global item to send it back to its owner, or delete it.</p>
        </div>
      </div>
      {items && items.length === 0 && <p className={styles.note}>No content yet.</p>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
        {(items ?? []).map((it) => (
          <li key={`${it.table}:${it.id}`} className={styles.row} aria-label={`${TABLE_LABEL[it.table]} ${it.title}`}>
            <div className={styles.rowText}>
              <div className={styles.rowTitle}>{it.title || 'Untitled'}</div>
              <div className={styles.rowMeta}>{TABLE_LABEL[it.table]} · {it.ownerId ? owners[it.ownerId] ?? 'Unknown owner' : 'Platform'}</div>
            </div>
            <VisibilityBadge visibility={it.visibility} />
            {it.visibility === 'global' && <button type="button" className={styles.ghost} disabled={busy} onClick={() => run(() => unpublishItem(it.table, it.id), 'Unpublished.')}>Unpublish</button>}
            <button type="button" className={styles.ghost} disabled={busy} aria-label={`Delete ${it.title}`} onClick={() => setConfirm(it)}>Delete</button>
          </li>
        ))}
      </ul>
      {confirm && (
        <ConfirmDialog title={`Delete “${confirm.title || 'this item'}”?`} body="It is removed for its owner and for everyone. This can’t be undone." button="Delete" busy={busy}
          onCancel={() => setConfirm(null)} onConfirm={() => run(() => deleteItem(confirm.table, confirm.id), 'Deleted.')} />
      )}
      <Toast toast={toast} onClose={close} />
    </>
  );
}
