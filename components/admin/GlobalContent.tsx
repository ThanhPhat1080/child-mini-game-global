'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getMyUserId, type ContentTable, type Visibility } from '@/lib/review';
import { parentNames } from '@/lib/superAdmin';
import { mediaUrl } from '@/lib/media';
import { Pic } from '@/components/Pic';
import { VisibilityBadge } from './VisibilityBadge';
import { panel } from './editor-parts';
import { SpotMarkerEditor } from './SpotMarkerEditor';
import { ModalClose } from '@/components/ModalClose';
import type { Difference } from '@/lib/spot/types';

type Item = {
  id: string; title: string; images: (string | null)[]; differences?: Difference[];
  /** Parents' view only: the owner's name and the row's status (V9). */
  owner?: string; visibility?: Visibility;
};

const QUERY: Record<'memory_cards' | 'spot_levels' | 'find_levels', { cols: string; map: (r: Record<string, unknown>) => Omit<Item, 'id'> }> = {
  memory_cards: { cols: 'id, owner_id, word, image_path', map: (r) => ({ title: String(r.word ?? ''), images: [r.image_path as string | null] }) },
  spot_levels: {
    cols: 'id, owner_id, image_a_path, image_b_path, differences',
    map: (r) => ({ title: 'Spot the differences', images: [r.image_a_path as string | null, r.image_b_path as string | null], differences: (r.differences as Difference[]) ?? [] }),
  },
  find_levels: {
    cols: 'id, owner_id, image_path, objects',
    map: (r) => ({ title: Array.isArray(r.objects) ? (r.objects as { word?: string }[]).map((o) => o.word).filter(Boolean).join(', ') : '', images: [r.image_path as string | null] }),
  },
};

/** Spot level opened from the Global tab: both pictures larger, with the differences marked (read-only). */
export function SpotViewDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(74,56,48,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box', zIndex: 50 }}>
      <div role="dialog" aria-modal="true" aria-label="Spot the differences level" style={{ position: 'relative', background: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 1000, maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box', boxShadow: '0 20px 60px rgba(74,56,48,0.3)', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'Nunito, sans-serif', color: '#4A3830' }}>
        <ModalClose onClick={onClose} />
        <h2 style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>Spot the differences</h2>
        <SpotMarkerEditor srcA={mediaUrl(item.images[0])} srcB={mediaUrl(item.images[1])} differences={item.differences ?? []} onChange={() => undefined} readOnly />
      </div>
    </div>
  );
}

/**
 * Read-only lists (N3, V9). `global` (default): approved content of other families; no edit, delete or save controls.
 * `parents`: every active row a parent owns, of any status, with the owner's name and a status badge (Super Admin only).
 * Spot levels open to view (View mode) in both.
 */
export function GlobalContent({ table, mode = 'global' }: { table: Exclude<ContentTable, 'quiz_sets' | 'card_groups'>; mode?: 'global' | 'parents' }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<Item | null>(null);

  useEffect(() => {
    let live = true;
    const q = QUERY[table];
    (async () => {
      if (mode === 'parents') {
        const sb = createSupabaseBrowserClient();
        const names = await parentNames(sb);
        const ids = [...names.keys()];
        const res = ids.length === 0
          ? { data: [], error: null }
          : await sb.from(table).select(`${q.cols}, visibility`).in('owner_id', ids).eq('active', true).order('created_at');
        if (!live) return;
        if (res.error) return setError(res.error.message);
        const rows = (res.data ?? []) as unknown as Record<string, unknown>[];
        setItems(rows.map((r) => ({
          id: String(r.id), ...q.map(r),
          owner: names.get(String(r.owner_id)) || 'Parent',
          visibility: r.visibility as Visibility,
        })));
        return;
      }
      const [me, res] = await Promise.all([
        getMyUserId(),
        createSupabaseBrowserClient().from(table).select(q.cols).eq('visibility', 'global').order('created_at'),
      ]);
      if (!live) return;
      if (res.error) return setError(res.error.message);
      const rows = (res.data ?? []) as unknown as Record<string, unknown>[];
      setItems(rows.filter((r) => r.owner_id !== me).map((r) => ({ id: String(r.id), ...q.map(r) })));
    })().catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, [table, mode]);

  if (error) return <p role="alert" style={{ color: '#A8484F', fontWeight: 700 }}>{error}</p>;
  if (!items) return <p style={{ color: '#7A6458' }}>Loading…</p>;
  if (items.length === 0) return <p style={{ color: '#7A6458' }}>{mode === 'parents' ? 'No parent has shared anything yet.' : 'Nothing has been shared with everyone yet.'}</p>;
  const card = (it: Item) => (
    <>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', height: 96, alignItems: 'center', background: '#FBF4E9', borderRadius: 12 }}>
        {it.images.map((p, i) => (mediaUrl(p) ? <Pic key={i} src={mediaUrl(p) ?? ''} alt="" style={{ maxWidth: 88, maxHeight: 88, objectFit: 'contain' }} /> : null))}
      </div>
      <strong>{it.title}</strong>
      {it.owner && <span style={{ fontSize: 13, color: '#7A6458', fontWeight: 700 }}>{it.owner}</span>}
      <VisibilityBadge visibility={it.visibility ?? 'global'} />
    </>
  );
  return (
    <>
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
      {items.map((it, n) => (
        <li key={it.id} style={{ ...panel, padding: 14, gap: 8 }}>
          {table === 'spot_levels' ? (
            <button type="button" aria-label={`View spot level ${n + 1}`} onClick={() => setOpened(it)}
              style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 0, border: 'none', background: 'transparent', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
              {card(it)}
            </button>
          ) : card(it)}
        </li>
      ))}
    </ul>
    {opened && <SpotViewDialog item={opened} onClose={() => setOpened(null)} />}
    </>
  );
}
