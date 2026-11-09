'use client';

import { useCallback, useEffect, useState } from 'react';
import { deleteChild, listMyChildren, type Child } from '@/lib/children';
import { MAX_CHILDREN } from '@/lib/auth/limits';
import { ChildCard } from '@/components/admin/ChildCard';
import { ChildModal } from '@/components/admin/ChildModal';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { Toast, useToast } from '@/components/admin/Toast';
import styles from '@/app/admin/admin.module.css';
import ui from '@/components/admin/admin-ui.module.css';

type Editing = { mode: 'create' } | { mode: 'edit'; child: Child } | null;

/**
 * The parent's children (KU1-KU8), as a section of Profile (PR11): the cards (at most 5), add, edit and remove.
 * Nothing is optimistic. The same behaviour as the Children page before it moved here.
 */
export function ChildrenPanel() {
  const [kids, setKids] = useState<Child[] | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [removing, setRemoving] = useState<Child | null>(null);
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

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    try {
      const res = await deleteChild(removing.id);
      if (!res.ok) return show('error', 'Could not remove the child.');
      setRemoving(null);
      show('success', 'Child removed.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="your-children" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 id="your-children" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Your children</h2>
        <p className={styles.sub}>Up to {MAX_CHILDREN} children. Each one signs in with a login name and a PIN.</p>
      </div>

      {full && <p className={styles.note}>You have reached the limit of {MAX_CHILDREN} children.</p>}
      {kids && kids.length === 0 && <p className={styles.note}>No children yet. Add the first one.</p>}

      <ul className={`${ui.childGrid} ${ui.childGridLg}`}>
        {(kids ?? []).map((k) => (
          <li key={k.id}>
            <ChildCard child={k} size="lg" onEdit={() => setEditing({ mode: 'edit', child: k })} onRemove={() => setRemoving(k)} />
          </li>
        ))}
        <li>
          <button type="button" className={ui.addCard} style={{ width: '100%', height: '100%' }} disabled={full || !kids} onClick={() => setEditing({ mode: 'create' })}>
            <span aria-hidden="true">+ </span>Add child
          </button>
        </li>
      </ul>

      {editing && (
        <ChildModal
          mode={editing.mode}
          child={editing.mode === 'edit' ? editing.child : undefined}
          onClose={() => setEditing(null)}
          onSaved={() => { show('success', 'Saved'); void load(); }}
          onNotice={show}
        />
      )}

      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.display_name}?`}
          body="This deletes the child and their sounds settings. This cannot be undone."
          button="Remove child"
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={confirmRemove}
        />
      )}

      <Toast toast={toast} onClose={close} />
    </section>
  );
}
