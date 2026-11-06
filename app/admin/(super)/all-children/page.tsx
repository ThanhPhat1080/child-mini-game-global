'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { listAllChildren, removeChild, type AdminChild } from '@/lib/superAdmin';
import { matches, sortBy, type SortOrder } from '@/lib/people';
import { BanTag } from '@/components/admin/BanTag';
import { ChildCard } from '@/components/admin/ChildCard';
import { ChildModal } from '@/components/admin/ChildModal';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { ListToolbar } from '@/components/admin/ListToolbar';
import { Toast, useToast } from '@/components/admin/Toast';
import styles from '../../admin.module.css';
import ui from '@/components/admin/admin-ui.module.css';

/**
 * Every child with their parent (N15): large cards in two columns, search by login, display or parent name, sort.
 * Super Admin edits go through ChildModal in parent mode (N16); removing asks first.
 */
export default function AllChildrenPage() {
  const [kids, setKids] = useState<AdminChild[] | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOrder>('newest');
  const [editing, setEditing] = useState<AdminChild | null>(null);
  const [target, setTarget] = useState<AdminChild | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, show, close } = useToast();

  const load = useCallback(async () => {
    try {
      setKids(await listAllChildren());
    } catch (e) { show('error', (e as Error).message); }
  }, [show]);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => sortBy(
    (kids ?? []).filter((k) => matches(query, k.display_name, k.child_name, k.parent_name)),
    sort,
    (k) => ({ created: k.created_at ?? '', name: k.display_name || k.child_name }),
  ), [kids, query, sort]);

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
          <p className={styles.sub}>Every child and the parent each belongs to.</p>
        </div>
      </div>

      <ListToolbar
        query={query}
        onQuery={setQuery}
        searchLabel="Search children and parents"
        placeholder="Search by login, name or parent"
        sort={sort}
        onSort={setSort}
      />

      {kids && kids.length === 0 && <p className={styles.note}>No children yet.</p>}
      {kids && kids.length > 0 && shown.length === 0 && <p className={styles.note}>No children match.</p>}

      <ul className={`${ui.childGrid} ${ui.childGridLg}`}>
        {shown.map((k) => (
          <li key={k.id}>
            <ChildCard
              child={k}
              size="lg"
              onEdit={() => setEditing(k)}
              onRemove={() => setTarget(k)}
              footer={(
                <>
                  <Link href={`/admin/parents/${k.parent_id}`} style={{ fontWeight: 600, color: '#8A5560' }}>{k.parent_name || 'Unknown parent'}</Link>
                  {k.parent_banned && <BanTag />}
                </>
              )}
            />
          </li>
        ))}
      </ul>

      {editing && (
        <ChildModal
          mode="edit"
          child={editing}
          parentId={editing.parent_id}
          onClose={() => setEditing(null)}
          onSaved={() => { show('success', 'Saved'); void load(); }}
          onNotice={show}
        />
      )}

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
