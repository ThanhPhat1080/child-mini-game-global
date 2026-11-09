'use client';

import { useState } from 'react';
import { publishOwn, unpublishItem } from '@/lib/superAdmin';
import type { ContentTable, Visibility } from '@/lib/review';
import s from '@/components/admin/admin-ui.module.css';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';

/**
 * A Super Admin's own row (V8, V10): "Publish to everyone" for a private row (no review), "Unpublish" for a
 * global one. A pending row shows "Under review" (it can only come from a parent's share).
 */
export function GlobalToggle({ table, id, visibility, onChanged }: {
  table: ContentTable; id: string; visibility: Visibility; onChanged?: (v: Visibility) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<'publish' | 'unpublish' | null>(null);

  async function run(next: Visibility, fn: () => Promise<void>) {
    setBusy(true); setError(null);
    try {
      await fn();
      onChanged?.(next);
    } catch (e) {
      setError((e as Error).message || 'Could not change the sharing.');
    } finally {
      setBusy(false);
      setAsking(null);
    }
  }

  // Same look as the admin Save button (SaveButtons): `.btn` alone has no colour or size.
  const base = { height: 40, padding: '0 18px', borderRadius: 10, fontSize: 14, fontWeight: 700, fontFamily: 'Nunito, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 } as const;
  const primary = { ...base, border: 'none', background: '#5A4038', color: '#fff' } as const;
  const ghost = { ...base, border: '1.5px solid #E3D5C4', background: '#fff', color: '#4A3830' } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
      {visibility === 'private' && (
        <button type="button" className={s.btn} style={primary} disabled={busy} onClick={() => setAsking('publish')}>
          Publish to everyone
        </button>
      )}
      {visibility === 'global' && (
        <button type="button" className={`${s.btn} ${s.ghost}`} style={ghost} disabled={busy} onClick={() => setAsking('unpublish')}>
          Unpublish
        </button>
      )}
      {visibility === 'pending' && <p role="status" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#7A5410' }}>Under review.</p>}
      {asking === 'publish' && (
        <ConfirmDialog
          tone="neutral"
          title="Publish to everyone?"
          body="It becomes a global item that every family's children can play. You can unpublish it later."
          button="Publish"
          busy={busy}
          onCancel={() => setAsking(null)}
          onConfirm={() => void run('global', () => publishOwn(table, id))}
        />
      )}
      {asking === 'unpublish' && (
        <ConfirmDialog
          tone="neutral"
          title="Unpublish this item?"
          body="It is hidden from every child again and goes back to private. You can publish it again later."
          button="Unpublish"
          busy={busy}
          onCancel={() => setAsking(null)}
          onConfirm={() => void run('private', () => unpublishItem(table, id))}
        />
      )}
      {error && <p role="alert" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#A8484F' }}>{error}</p>}
    </div>
  );
}
