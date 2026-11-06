'use client';

import Link from 'next/link';
import { useId, type ReactNode } from 'react';
import type { PersonRow } from '@/lib/superAdmin';
import { BanTag } from '@/components/admin/BanTag';
import { InitialsAvatar } from '@/components/admin/InitialsAvatar';
import { RedDot } from '@/components/admin/RedDot';
import { UsageBar } from '@/components/admin/UsageBar';
import s from './admin-ui.module.css';

export type ParentSummary = Pick<PersonRow, 'userId' | 'name' | 'banned' | 'quotaBytes'>;

/**
 * One parent as a row (N10-N12). With `onToggle` it has a chevron and shows `children` when expanded; without it
 * the row is a plain header (the Messages page). `used` adds the storage bar, `childCount` the "Children: N" line,
 * `pendingMessages` the message icon with a red dot.
 */
export function ParentRow({ parent, used, childCount, pendingMessages, expanded, onToggle, children }: {
  parent: ParentSummary; used?: number; childCount?: number; pendingMessages?: boolean;
  expanded?: boolean; onToggle?: () => void; children?: ReactNode;
}) {
  const bodyId = useId();
  const name = parent.name || 'Unnamed parent';
  return (
    <div className={s.parentRow}>
      <div className={s.parentHead}>
        {onToggle && (
          <button
            type="button"
            className={`${s.chev} ${expanded ? s.chevOpen : ''}`}
            aria-expanded={!!expanded}
            aria-controls={expanded ? bodyId : undefined}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${name}`}
            onClick={onToggle}
          >
            <svg aria-hidden="true" className={s.chevIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        )}
        <InitialsAvatar name={parent.name} />
        <div className={s.parentMain}>
          <div className={s.parentNameLine}>
            <Link href={`/admin/parents/${parent.userId}`} className={s.parentName}>{name}</Link>
            {parent.banned && <BanTag />}
          </div>
          {used !== undefined && <UsageBar used={used} quota={parent.quotaBytes} />}
          {childCount !== undefined && <span className={s.childCount}>Children: {childCount}</span>}
        </div>
        {pendingMessages && (
          <span className={s.iconTag}>
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            <RedDot label="Pending messages" />
          </span>
        )}
      </div>
      {expanded && children && <div id={bodyId} className={s.parentKids}>{children}</div>}
    </div>
  );
}
