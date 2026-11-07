'use client';

import Link from 'next/link';
import { GENDER_THEME } from '@/lib/childTheme';
import type { Child } from '@/lib/children';
import { mediaUrl } from '@/lib/media';
import { Pic } from '@/components/Pic';
import { BanTag } from '@/components/admin/BanTag';
import s from './admin-ui.module.css';

/**
 * One child on the parent's Children page: gender colors, avatar, names, age band, Edit and Remove (KU1, KU2).
 * `size="lg"` is the larger card of the Super Admin's Children page; `parent` adds the parent line under the age,
 * linking to the parent's page (N15). Without `onEdit` / `onRemove` the card is read-only and shows no buttons (N11).
 */
export function ChildCard({ child, onEdit, onRemove, size, parent }: {
  child: Child; onEdit?: () => void; onRemove?: () => void; size?: 'lg';
  parent?: { id: string; name: string; banned: boolean };
}) {
  const t = GENDER_THEME[child.gender];
  const src = mediaUrl(child.avatar_path);
  return (
    <div
      data-testid="child-card"
      data-size={size ?? 'md'}
      className={`${s.childCard} ${size === 'lg' ? s.childCardLg : ''}`}
      style={{ background: t.bg, color: t.text, borderColor: t.accent }}
    >
      <div className={s.childAvatar} style={{ borderColor: t.accent }}>
        {src ? <Pic src={src} alt="" className={s.childAvatarImg} /> : <span aria-hidden="true" style={{ fontSize: 26, fontWeight: 800 }}>{[...child.display_name][0]?.toUpperCase()}</span>}
      </div>
      <div className={s.childBody}>
        <div className={s.childName}>{child.display_name}</div>
        <div className={s.childLogin}>@{child.child_name}</div>
        <div className={s.childMeta}>
          <span aria-hidden="true">{t.icon}</span>
          <span className={s.childBand}>{child.age_band}</span>
        </div>
        {parent && (
          <div className={s.childParent}>
            <span>Parent:</span>
            <Link href={`/admin/parents/${parent.id}`} className={s.parentLink}>
              {parent.name || 'Unknown parent'}
              <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
            </Link>
            {parent.banned && <BanTag />}
          </div>
        )}
      </div>
      {(onEdit || onRemove) && (
        <div className={s.childActions}>
          {onEdit && (
            <span className={s.tipWrap}>
              <button type="button" className={s.iconBtn} aria-label={`Edit ${child.display_name}`} onClick={onEdit}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
              </button>
              <span role="tooltip" className={s.tip}>Edit</span>
            </span>
          )}
          {onRemove && (
            <span className={s.tipWrap}>
              <button type="button" className={s.iconBtn} aria-label={`Remove ${child.display_name}`} onClick={onRemove}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" /></svg>
              </button>
              <span role="tooltip" className={s.tip}>Remove</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
