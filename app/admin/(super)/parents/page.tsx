'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listAllChildren, listPeople, pendingSenders, storageUsedBy, type AdminChild, type PersonRow } from '@/lib/superAdmin';
import { matches, sortBy, type SortOrder } from '@/lib/people';
import { ChildCard } from '@/components/admin/ChildCard';
import { CreateParentDialog } from '@/components/admin/CreateParentDialog';
import { ListToolbar } from '@/components/admin/ListToolbar';
import { ParentRow } from '@/components/admin/ParentRow';
import { RedDot } from '@/components/admin/RedDot';
import { Toast, useToast } from '@/components/admin/Toast';
import styles from '@/app/admin/admin.module.css';
import s from '@/components/admin/admin-ui.module.css';

/**
 * Parents (N10-N13): search by a parent or child name, sort, a red dot and a filter for parents with pending
 * messages, expand to read-only children, and create a parent. Ban and quota live on the parent's detail page.
 */
export default function ParentsPage() {
  const router = useRouter();
  const [parents, setParents] = useState<PersonRow[] | null>(null);
  const [kids, setKids] = useState<AdminChild[]>([]);
  const [used, setUsed] = useState<Record<string, number>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOrder>('newest');
  const [onlyMessages, setOnlyMessages] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const { toast, show, close } = useToast();

  const load = useCallback(async () => {
    try {
      const [list, allKids, senders] = await Promise.all([listPeople('parent'), listAllChildren(), pendingSenders()]);
      setParents(list);
      setKids(allKids);
      setPending(senders);
      setUsed(await storageUsedBy(list.map((p) => p.userId)));
    } catch (e) { show('error', (e as Error).message); }
  }, [show]);
  useEffect(() => { void load(); }, [load]);

  const kidsOf = useCallback((id: string) => kids.filter((k) => k.parent_id === id), [kids]);

  const shown = useMemo(() => sortBy(
    (parents ?? []).filter((p) =>
      (!onlyMessages || pending.has(p.userId))
      && (matches(query, p.name) || kidsOf(p.userId).some((k) => matches(query, k.display_name, k.child_name)))),
    sort,
    (p) => ({ created: p.createdAt, name: p.name }),
  ), [parents, onlyMessages, pending, query, sort, kidsOf]);

  const allOpen = shown.length > 0 && shown.every((p) => open.has(p.userId));
  const toggleAll = () => setOpen(allOpen ? new Set() : new Set(shown.map((p) => p.userId)));
  const toggleOne = (id: string) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1>Parents</h1>
          <p className={styles.sub}>Each family in one list. Open a parent to ban, restore or change their storage.</p>
        </div>
      </div>

      <ListToolbar
        query={query}
        onQuery={setQuery}
        searchLabel="Search parents and children"
        placeholder="Search by parent or child name"
        sort={sort}
        onSort={setSort}
      >
        <button
          type="button"
          className={styles.ghost}
          aria-pressed={onlyMessages}
          style={{ background: onlyMessages ? '#F8DCDF' : undefined }}
          onClick={() => setOnlyMessages((v) => !v)}
        >
          <span className={s.iconTag} style={{ marginRight: 8 }}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            {pending.size > 0 && <RedDot />}
          </span>
          Messages
        </button>
        <button type="button" className={styles.ghost} disabled={shown.length === 0} onClick={toggleAll}>
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
        <button type="button" className={styles.primary} style={{ height: 40, padding: '0 16px', fontSize: 14 }} onClick={() => setCreating(true)}>
          Create parent
        </button>
      </ListToolbar>

      {parents && parents.length === 0 && <p className={styles.note}>No parents yet.</p>}
      {parents && parents.length > 0 && shown.length === 0 && <p className={styles.note}>No parents match.</p>}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
        {shown.map((p) => {
          const ks = kidsOf(p.userId);
          return (
            <li key={p.userId}>
              <ParentRow
                parent={p}
                used={used[p.userId] ?? 0}
                childCount={ks.length}
                pendingMessages={pending.has(p.userId)}
                expanded={open.has(p.userId)}
                onToggle={() => toggleOne(p.userId)}
              >
                {ks.length === 0
                  ? <p className={styles.note}>No children yet.</p>
                  : ks.map((k) => <ChildCard key={k.id} child={k} />)}
              </ParentRow>
            </li>
          );
        })}
      </ul>

      {creating && (
        <CreateParentDialog
          onCancel={() => setCreating(false)}
          onCreated={(userId) => { setCreating(false); router.push(`/admin/parents/${userId}`); }}
        />
      )}
      <Toast toast={toast} onClose={close} />
    </>
  );
}
