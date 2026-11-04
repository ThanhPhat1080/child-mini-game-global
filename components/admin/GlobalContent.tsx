'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getMyUserId, type ContentTable } from '@/lib/review';
import { mediaUrl } from '@/lib/media';
import { Pic } from '@/components/Pic';
import { VisibilityBadge } from './VisibilityBadge';
import { panel } from './editor-parts';

type Item = { id: string; title: string; images: (string | null)[] };

const QUERY: Record<'memory_cards' | 'spot_levels' | 'find_levels', { cols: string; map: (r: Record<string, unknown>) => Omit<Item, 'id'> }> = {
  memory_cards: { cols: 'id, owner_id, word, image_path', map: (r) => ({ title: String(r.word ?? ''), images: [r.image_path as string | null] }) },
  spot_levels: { cols: 'id, owner_id, image_a_path, image_b_path', map: (r) => ({ title: 'Spot the differences', images: [r.image_a_path as string | null, r.image_b_path as string | null] }) },
  find_levels: {
    cols: 'id, owner_id, image_path, objects',
    map: (r) => ({ title: Array.isArray(r.objects) ? (r.objects as { word?: string }[]).map((o) => o.word).filter(Boolean).join(', ') : '', images: [r.image_path as string | null] }),
  },
};

/** Approved content of other families, read-only (N3): no edit, delete or save controls. */
export function GlobalContent({ table }: { table: Exclude<ContentTable, 'quiz_sets' | 'card_groups'> }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const q = QUERY[table];
    (async () => {
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
  }, [table]);

  if (error) return <p role="alert" style={{ color: '#A8484F', fontWeight: 700 }}>{error}</p>;
  if (!items) return <p style={{ color: '#7A6458' }}>Loading…</p>;
  if (items.length === 0) return <p style={{ color: '#7A6458' }}>Nothing has been shared with everyone yet.</p>;
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
      {items.map((it) => (
        <li key={it.id} style={{ ...panel, padding: 14, gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', height: 96, alignItems: 'center', background: '#FBF4E9', borderRadius: 12 }}>
            {it.images.map((p, i) => (mediaUrl(p) ? <Pic key={i} src={mediaUrl(p) ?? ''} alt="" style={{ maxWidth: 88, maxHeight: 88, objectFit: 'contain' }} /> : null))}
          </div>
          <strong>{it.title}</strong>
          <VisibilityBadge visibility="global" />
        </li>
      ))}
    </ul>
  );
}
