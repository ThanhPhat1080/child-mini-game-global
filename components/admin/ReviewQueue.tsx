'use client';

import { useCallback, useEffect, useState } from 'react';
import { approveItem, listPending, rejectItem, TABLE_LABEL, type ContentItem } from '@/lib/superAdmin';
import type { ContentTable } from '@/lib/review';
import { mediaUrl } from '@/lib/media';
import { Toast, useToast } from '@/components/admin/Toast';
import { Pic } from '@/components/Pic';
import styles from '@/app/admin/admin.module.css';

/**
 * The review queue of one game (V3, V8): the parent's pending rows of `tables` with their images and sounds.
 * Approve creates a global copy the Super Admin owns and sends the parent's row back to private. Reject sends
 * it back with a reason.
 */
export function ReviewQueue({ tables }: { tables: ContentTable[] }) {
  const [items, setItems] = useState<ContentItem[] | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast, show, close } = useToast();

  const load = useCallback(async () => {
    try { setItems(await listPending(undefined, tables)); } catch (e) { show('error', (e as Error).message); }
  }, [show, tables]);
  useEffect(() => { void load(); }, [load]);

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    try { await fn(); show('success', done); setRejecting(null); setNote(''); await load(); }
    catch (e) { show('error', (e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <p className={styles.sub} style={{ margin: 0 }}>Shared by parents. Approve to create a global copy you own; the parent keeps the original, back in private.</p>
      {items && items.length === 0 && <p className={styles.note}>Nothing is waiting for review.</p>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 14 }}>
        {(items ?? []).map((it) => {
          const key = `${it.table}:${it.id}`;
          return (
            <li key={key} className={styles.section} aria-label={`${TABLE_LABEL[it.table]} ${it.title}`}>
              <div>
                <h2>{it.title || 'Untitled'}</h2>
                <p>{TABLE_LABEL[it.table]}</p>
              </div>
              {it.images.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {it.images.map((p, i) => mediaUrl(p) && <Pic key={`${p}-${i}`} src={mediaUrl(p) ?? ''} alt={`${it.title} picture ${i + 1}`} style={{ width: 84, height: 84, objectFit: 'contain', background: '#FBF4E9', borderRadius: 10 }} />)}
                </div>
              )}
              {it.sounds.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {it.sounds.map((p, i) => <audio key={`${p}-${i}`} controls preload="none" src={mediaUrl(p) ?? undefined} aria-label={`${it.title} sound ${i + 1}`} />)}
                </div>
              )}
              {rejecting === key ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label htmlFor={`note-${key}`} style={{ fontSize: 14, fontWeight: 700 }}>Reason for the parent</label>
                  <textarea id={`note-${key}`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className={styles.primary} disabled={busy || !note.trim()} onClick={() => run(() => rejectItem(it.table, it.id, note.trim()), 'Sent back to the parent.')}>Send back</button>
                    <button type="button" className={styles.ghost} disabled={busy} onClick={() => { setRejecting(null); setNote(''); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className={styles.primary} disabled={busy} onClick={() => run(() => approveItem(it.table, it.id), 'Approved. A global copy was created.')}>Approve</button>
                  <button type="button" className={styles.ghost} disabled={busy} onClick={() => setRejecting(key)}>Reject</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Toast toast={toast} onClose={close} />
    </>
  );
}
