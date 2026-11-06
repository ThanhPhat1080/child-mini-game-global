'use client';

import type { ReactNode } from 'react';
import { GENDER_THEME } from '@/lib/childTheme';
import type { Child } from '@/lib/children';
import { mediaUrl } from '@/lib/media';
import { Pic } from '@/components/Pic';
import s from './admin-ui.module.css';

/**
 * One child on the parent's Children page: gender colors, avatar, names, age band, Edit and Remove (KU1, KU2).
 * `size="lg"` is the larger card of the Super Admin's Children page; `footer` adds a row under the names (N15).
 * Without `onEdit` / `onRemove` the card is read-only and shows no buttons (N11).
 */
export function ChildCard({ child, onEdit, onRemove, size, footer }: {
  child: Child; onEdit?: () => void; onRemove?: () => void; size?: 'lg'; footer?: ReactNode;
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
      </div>
      {footer && <div className={s.childFooter}>{footer}</div>}
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
