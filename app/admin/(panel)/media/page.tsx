'use client';

import { useEffect, useState } from 'react';
import { getMyQuota, type Quota } from '@/lib/media/quota';
import { QuotaMeter } from '@/components/admin/QuotaMeter';
import { MediaLibrary } from '@/components/admin/MediaLibraryDialog';
import { useMyRole } from '@/lib/review';

type Kind = 'image' | 'audio';

const iconProps = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

const TABS: { kind: Kind; label: string; icon: React.ReactNode }[] = [
  { kind: 'image', label: 'Image library', icon: <svg {...iconProps}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg> },
  { kind: 'audio', label: 'Sound library', icon: <svg {...iconProps}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg> },
];

/**
 * Media: the pictures and sounds of the family. A parent sees their own; a Super Admin sees their own and every parent's
 * (view only for the parents'), with the storage of all families. The same actions as the library pop-up (upload, rename, sort, view, delete).
 */
export default function MediaPage() {
  const [kind, setKind] = useState<Kind>('image');
  const [quota, setQuota] = useState<Quota | null>(null);
  const role = useMyRole();
  const scope = role === 'super_admin' ? 'all' : 'own';
  useEffect(() => { void getMyQuota().then(setQuota, () => setQuota(null)); }, [kind]);
  return (
    <>
      <div>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>Media</h1>
        <p style={{ margin: '6px 0 0', color: '#7A6458', fontSize: 15 }}>All pictures and sounds. Double click a name to rename it, click a picture to see it full size.</p>
      </div>
      {quota && <QuotaMeter used={quota.used} quota={quota.quota} />}
      <div role="tablist" aria-label="Media type" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TABS.map((t) => {
          const on = t.kind === kind;
          return (
            <button key={t.kind} type="button" role="tab" aria-selected={on} onClick={() => setKind(t.kind)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 18px', borderRadius: 10, border: on ? '2px solid #5A4038' : '1.5px solid #E3D5C4', background: on ? '#fff' : 'transparent', color: '#4A3830', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              {t.icon}{t.label}
            </button>
          );
        })}
      </div>
      {role && <MediaLibrary key={`${kind}:${scope}`} mode="page" kind={kind} scope={scope} />}
    </>
  );
}
