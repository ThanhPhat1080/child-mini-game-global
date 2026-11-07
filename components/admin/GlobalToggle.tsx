'use client';

import { useState } from 'react';
import { publishOwn, unpublishItem } from '@/lib/superAdmin';
import type { ContentTable, Visibility } from '@/lib/review';
import s from '@/components/admin/admin-ui.module.css';

/**
 * A Super Admin's own row (V8, V10): "Publish to everyone" for a private row (no review), "Unpublish" for a
 * global one. A pending row shows "Under review" (it can only come from a parent's share).
 */
export function GlobalToggle({ table, id, visibility, onChanged }: {
  table: ContentTable; id: string; visibility: Visibility; onChanged?: (v: Visibility) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(next: Visibility, fn: () => Promise<void>) {
    setBusy(true); setError(null);
    try {
      await fn();
      onChanged?.(next);
    } catch (e) {
      setError((e as Error).message || 'Could not change the sharing.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
      {visibility === 'private' && (
        <button type="button" className={s.btn} disabled={busy} onClick={() => void run('global', () => publishOwn(table, id))}>
          Publish to everyone
        </button>
      )}
      {visibility === 'global' && (
        <button type="button" className={`${s.btn} ${s.ghost}`} disabled={busy} onClick={() => void run('private', () => unpublishItem(table, id))}>
          Unpublish
        </button>
      )}
      {visibility === 'pending' && <p role="status" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#7A5410' }}>Under review.</p>}
      {error && <p role="alert" style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#A8484F' }}>{error}</p>}
    </div>
  );
}
