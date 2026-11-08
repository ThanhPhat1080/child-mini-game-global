'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { listMyChildren, type Child } from '@/lib/children';
import { BAN_REASONS } from '@/lib/policy/reasons';
import { mediaUrl } from '@/lib/media';
import { Pic } from '@/components/Pic';
import { BanDialog } from '@/components/admin/BanDialog';
import { BanTag } from '@/components/admin/BanTag';
import { ChildCard } from '@/components/admin/ChildCard';
import { ChildModal } from '@/components/admin/ChildModal';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { ContentViewDialog } from '@/components/admin/ContentViewDialog';
import { SpotViewDialog } from '@/components/admin/GlobalContent';
import { InitialsAvatar } from '@/components/admin/InitialsAvatar';
import { Toast, useToast } from '@/components/admin/Toast';
import { UsageBar } from '@/components/admin/UsageBar';
import { VisibilityBadge } from '@/components/admin/VisibilityBadge';
import { MAX_CHILDREN } from '@/lib/auth/limits';
import { mb } from '@/lib/people';
import { banParent, listContent, listPeople, removeChild, setQuota, storageUsedBy, TABLE_LABEL, unbanParent, type ContentItem, type PersonRow } from '@/lib/superAdmin';
import type { ContentTable } from '@/lib/review';
import styles from '@/app/admin/admin.module.css';
import ui from '@/components/admin/admin-ui.module.css';
import { AdminLoading } from './AdminLoading';

const MB = 1024 * 1024;

/** The games a parent's levels are grouped under, in the order the admin shows them. */
const GAMES: { table: ContentTable; heading: string }[] = [
  { table: 'quiz_sets', heading: 'Quiz sets' },
  { table: 'memory_cards', heading: 'Cards' },
  { table: 'spot_levels', heading: 'Spot' },
  { table: 'find_levels', heading: 'Find' },
];

type Editing = { mode: 'create' } | { mode: 'edit'; child: Child } | null;

/**
 * One parent (N14): ban or restore, storage quota, the children (add, edit the non-media fields, remove) and the
 * parent's levels, view only. Ban, restore and quota are optimistic: the page shows the new value first and puts the
 * old one back if the database refuses (CLAUDE.md, Optimistic UI). Removing a child is not optimistic.
 */
export default function ParentDetail({ id }: { id: string }) {
  // undefined while loading, null when no parent has this id
  const [person, setPerson] = useState<PersonRow | null | undefined>(undefined);
  const [kids, setKids] = useState<Child[] | null>(null);
  const [used, setUsed] = useState(0);
  const [levels, setLevels] = useState<ContentItem[] | null>(null);
  const [banning, setBanning] = useState(false);
  const [busy, setBusy] = useState(false);
  // the quota box text while it differs from the saved value; null shows the saved value
  const [quotaText, setQuotaText] = useState<string | null>(null);
  const [savingQuota, setSavingQuota] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [removing, setRemoving] = useState<Child | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [viewing, setViewing] = useState<ContentItem | null>(null);
  const { toast, show, close } = useToast();

  const load = useCallback(async () => {
    try {
      const [list, rows, usage, items] = await Promise.all([
        listPeople('parent'),
        listMyChildren(undefined, id),
        storageUsedBy([id]),
        listContent(undefined, { ownerId: id }),
      ]);
      setPerson(list.find((p) => p.userId === id) ?? null);
      setKids(rows);
      setUsed(usage[id] ?? 0);
      setLevels(items);
    } catch (e) { show('error', (e as Error).message); }
  }, [id, show]);
  useEffect(() => { void load(); }, [load]);

  async function ban(code: string, note: string) {
    if (!person) return;
    const before = person;
    setBanning(false);
    setPerson({ ...person, banned: true, banReasonCode: code, banNote: note || null });
    setBusy(true);
    try { await banParent(id, code, note); show('success', 'Parent banned.'); }
    catch (e) { setPerson(before); show('error', (e as Error).message); }
    finally { setBusy(false); }
  }

  async function unban() {
    if (!person) return;
    const before = person;
    setPerson({ ...person, banned: false, banReasonCode: null, banNote: null, bannedAt: null });
    setBusy(true);
    try { await unbanParent(id); show('success', 'Parent restored.'); }
    catch (e) { setPerson(before); show('error', (e as Error).message); }
    finally { setBusy(false); }
  }

  const quotaValid = quotaText !== null && Number.isFinite(Number(quotaText)) && Number(quotaText) >= 0;

  async function saveQuota() {
    if (!person || quotaText === null || !quotaValid) return;
    const before = person;
    const typed = quotaText;
    const bytes = Math.round(Number(typed) * MB);
    setPerson({ ...person, quotaBytes: bytes });
    setQuotaText(null);
    setSavingQuota(true);
    try { await setQuota(id, bytes); show('success', 'Quota changed.'); }
    catch (e) { setPerson(before); setQuotaText(typed); show('error', (e as Error).message); }
    finally { setSavingQuota(false); }
  }

  async function confirmRemove() {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      await removeChild(removing.id);
      setRemoving(null);
      show('success', 'Child removed.');
      await load();
    } catch (e) {
      setRemoving(null);
      show('error', (e as Error).message);
    } finally {
      setRemoveBusy(false);
    }
  }

  if (person === undefined) return <AdminLoading />;
  if (person === null) {
    return (
      <>
        <p className={styles.note}>This parent was not found.</p>
        <Link href="/admin/parents">Back to parents</Link>
        <Toast toast={toast} onClose={close} />
      </>
    );
  }

  const full = (kids?.length ?? 0) >= MAX_CHILDREN;
  const reason = BAN_REASONS.find((r) => r.code === person.banReasonCode)?.label ?? person.banReasonCode ?? '';
  const name = person.name || 'Unnamed parent';

  return (
    <>
      <Link href="/admin/parents" style={{ fontSize: 14, fontWeight: 700, color: '#8A5560' }}>← Parents</Link>

      <div className={styles.head}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <InitialsAvatar name={person.name} size={64} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1>{name}</h1>
              {person.banned && <BanTag />}
            </div>
            {person.banned && <p className={styles.sub}>Banned: {reason}{person.banNote ? ` · ${person.banNote}` : ''}</p>}
          </div>
        </div>
        {person.banned
          ? <button type="button" className={styles.ghost} disabled={busy} onClick={unban}>Unban</button>
          : <button type="button" className={styles.ghost} disabled={busy} onClick={() => setBanning(true)}>Ban</button>}
      </div>

      <section className={styles.section} aria-label="Storage" style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14, padding: '16px 20px' }}>
        <h2 style={{ marginRight: 4 }}>Storage</h2>
        <UsageBar inline used={used} quota={person.quotaBytes} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label htmlFor="quota-mb" style={{ fontSize: 14, fontWeight: 700 }}>Quota (MB)</label>
          <input
            id="quota-mb"
            className={styles.input}
            type="number"
            min={0}
            style={{ width: 110, height: 40 }}
            value={quotaText ?? String(mb(person.quotaBytes))}
            onChange={(e) => setQuotaText(e.target.value)}
          />
          <button type="button" className={styles.primary} style={{ height: 40, padding: '0 16px', fontSize: 14 }} disabled={savingQuota || !quotaValid} onClick={saveQuota}>Save</button>
        </div>
      </section>

      <section className={styles.section} aria-label="Children">
        <h2>Children</h2>
        <ul className={ui.childGrid}>
          {(kids ?? []).map((k) => (
            <li key={k.id}>
              <ChildCard child={k} onEdit={() => setEditing({ mode: 'edit', child: k })} onRemove={() => setRemoving(k)} />
            </li>
          ))}
          <li>
            <button type="button" className={ui.addCard} style={{ width: '100%', height: '100%' }} disabled={full || !kids} onClick={() => setEditing({ mode: 'create' })}>
              <span aria-hidden="true">+ </span>Add child
            </button>
          </li>
        </ul>
        {kids && kids.length === 0 && <p className={styles.note}>No children yet.</p>}
        {full && <p className={styles.note}>This parent has the most children allowed ({MAX_CHILDREN}).</p>}
      </section>

      <section className={styles.section} aria-label="Levels">
        <h2>Levels</h2>
        {levels && levels.length === 0 && <p className={styles.note}>No levels yet.</p>}
        {GAMES.map((g) => {
          const items = (levels ?? []).filter((l) => l.table === g.table);
          if (items.length === 0) return null;
          return (
            <div key={g.table} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#7A6458' }}>{g.heading}</h3>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
                {items.map((it) => {
                  const thumb = mediaUrl(it.images[0] ?? null);
                  const title = it.title || 'Untitled';
                  const body = (
                    <>
                      <span style={{ width: 56, height: 56, borderRadius: 12, background: '#FBF4E9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none', overflow: 'hidden' }}>
                        {thumb && <Pic src={thumb} alt="" style={{ maxWidth: 56, maxHeight: 56, objectFit: 'contain' }} />}
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
                        <strong style={{ overflowWrap: 'anywhere' }}>{title}</strong>
                        <span style={{ fontSize: 13, color: '#7A6458' }}>{TABLE_LABEL[it.table]}</span>
                      </span>
                      <VisibilityBadge visibility={it.visibility} />
                    </>
                  );
                  const rowStyle = { display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, background: '#fbf4e9', textAlign: 'left' as const, color: 'inherit', textDecoration: 'none', border: 'none', font: 'inherit', width: '100%' };
                  return (
                    <li key={`${it.table}:${it.id}`}>
                      {it.table === 'quiz_sets'
                        ? <Link href={`/admin/sets/${it.id}`} style={rowStyle}>{body}</Link>
                        : <button type="button" aria-label={`View ${TABLE_LABEL[it.table].toLowerCase()} ${title}`} style={{ ...rowStyle, cursor: 'pointer' }} onClick={() => setViewing(it)}>{body}</button>}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      {banning && (
        <BanDialog name={person.name} busy={busy} onCancel={() => setBanning(false)} onConfirm={ban} />
      )}
      {editing && (
        <ChildModal
          mode={editing.mode}
          parentId={id}
          child={editing.mode === 'edit' ? editing.child : undefined}
          onClose={() => setEditing(null)}
          onSaved={() => { show('success', 'Saved'); void load(); }}
          onNotice={show}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.display_name}?`}
          body="This deletes the child and their settings. This cannot be undone."
          button="Remove"
          busy={removeBusy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => void confirmRemove()}
        />
      )}
      {viewing && viewing.table === 'spot_levels' && <SpotViewDialog item={viewing} onClose={() => setViewing(null)} />}
      {viewing && viewing.table !== 'spot_levels' && <ContentViewDialog item={viewing} onClose={() => setViewing(null)} />}
      <Toast toast={toast} onClose={close} />
    </>
  );
}
