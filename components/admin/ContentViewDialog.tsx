'use client';

import { useEffect, useId } from 'react';
import { mediaUrl } from '@/lib/media';
import { TABLE_LABEL, type ContentItem } from '@/lib/superAdmin';
import { Pic } from '@/components/Pic';
import { ModalClose } from '@/components/ModalClose';
import { VisibilityBadge } from '@/components/admin/VisibilityBadge';

/** A card or find level opened from a parent's detail page: large pictures and the sounds, read-only (N14). */
export function ContentViewDialog({ item, onClose }: { item: ContentItem; onClose: () => void }) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const title = item.title || 'Untitled';
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(74,56,48,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box', zIndex: 50 }}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} style={{ position: 'relative', background: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 760, maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'Nunito, sans-serif', color: '#4A3830' }}>
        <ModalClose onClick={onClose} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingRight: 40 }}>
          <h2 id={titleId} style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>{title}</h2>
          <span style={{ fontSize: 14, color: '#7A6458' }}>{TABLE_LABEL[item.table]}</span>
          <VisibilityBadge visibility={item.visibility} />
        </div>
        {item.images.length > 0 && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', background: '#FBF4E9', borderRadius: 14, padding: 12 }}>
            {item.images.map((p, i) => mediaUrl(p) && (
              <Pic key={`${p}-${i}`} src={mediaUrl(p) ?? ''} alt={`${title} picture ${i + 1}`} style={{ maxWidth: '100%', maxHeight: 360, objectFit: 'contain' }} />
            ))}
          </div>
        )}
        {item.sounds.map((p, i) => mediaUrl(p) && (
          <audio key={`${p}-${i}`} controls preload="none" src={mediaUrl(p) ?? ''} aria-label={`${title} sound ${i + 1}`} />
        ))}
      </div>
    </div>
  );
}
