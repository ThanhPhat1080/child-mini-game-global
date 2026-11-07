'use client';

import { useState } from 'react';
import { requestEdit, shareItem, type ContentTable, type Visibility } from '@/lib/review';
import s from '@/components/admin/admin-ui.module.css';
import { GlobalToggle } from './GlobalToggle';

/**
 * Sharing controls of one row (V2-V4): a private row gets "Share with all children"; a pending row shows
 * "Under review"; a global row offers "Request edit". A Super Admin's own row gets publish and unpublish instead (V10).
 * Keep this outside an EditLock: it must stay usable.
 */
export function ShareToggle({ table, id, visibility, onChanged, superOwned }: {
  table: ContentTable; id: string; visibility: Visibility; onChanged?: (v: Visibility) => void; superOwned?: boolean;
}) {
  if (superOwned) return <GlobalToggle table={table} id={id} visibility={visibility} onChanged={onChanged} />;
  return <ParentShare table={table} id={id} visibility={visibility} onChanged={onChanged} />;
}

function ParentShare({ table, id, visibility, onChanged }: {
  table: ContentTable; id: string; visibility: Visibility; onChanged?: (v: Visibility) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  async function share() {
    setBusy(true); setError(null);
    try {
      await shareItem(table, id);
      onChanged?.('pending');
    } catch (e) {
      setError((e as Error).message || 'Could not share.');
    } finally {
      setBusy(false);
    }
  }

  async function ask() {
    setBusy(true); setError(null);
    try {
      await requestEdit(table, id, note);
      setSent(true); setAsking(false); setNote('');
    } catch (e) {
      setError((e as Error).message || 'Could not send the request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
      {visibility === 'private' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
          <input type="checkbox" role="switch" checked={false} disabled={busy} onChange={() => void share()} style={{ width: 18, height: 18, margin: 0 }} />
          Share with all children
        </label>
      )}
      {visibility === 'pending' && <p role="status" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#7A5410' }}>Under review. You can edit it again if it is sent back.</p>}
      {visibility === 'global' && !asking && !sent && (
        <button type="button" className={`${s.btn} ${s.ghost}`} onClick={() => setAsking(true)}>Request edit</button>
      )}
      {visibility === 'global' && asking && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignSelf: 'stretch' }}>
          <label htmlFor={`edit-note-${id}`} style={{ fontSize: 13, fontWeight: 700 }}>What would you like to change?</label>
          <textarea id={`edit-note-${id}`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className={s.btn} disabled={busy} onClick={() => void ask()}>Send request</button>
            <button type="button" className={`${s.btn} ${s.ghost}`} disabled={busy} onClick={() => setAsking(false)}>Cancel</button>
          </div>
        </div>
      )}
      {sent && <p role="status" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#3F6B48' }}>Edit request sent. A Super Admin will unpublish it.</p>}
      {error && <p role="alert" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#A8484F' }}>{error}</p>}
    </div>
  );
}
