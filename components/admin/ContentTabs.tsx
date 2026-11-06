import type { Role } from '@/lib/auth/roles';
import type { Scope } from '@/lib/review';
import s from '@/components/admin/admin-ui.module.css';
import { RedDot } from './RedDot';

/**
 * The tabs of a game's content area. A parent has "Mine" and "Global" (N3). A Super Admin has "Mine",
 * "Review queue" (with a red dot and the count, V3) and "Parent published" (view only, V9).
 */
export function ContentTabs({ scope, onChange, role, pending = 0 }: {
  scope: Scope; onChange: (s: Scope) => void; role?: Role | null; pending?: number;
}) {
  const tab = (value: Scope, label: string, extra?: React.ReactNode, accessible?: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={scope === value}
      aria-label={accessible}
      className={`${s.tab} ${scope === value ? s.tabActive : ''}`}
      onClick={() => onChange(value)}
    >
      {label}
      {extra}
    </button>
  );
  return (
    <div role="tablist" aria-label="Content" className={s.tabs}>
      {tab('mine', 'Mine')}
      {role === 'super_admin' ? (
        <>
          {tab(
            'queue',
            'Review queue',
            pending > 0 ? <span style={{ position: 'relative', display: 'inline-block', width: 8, height: 8, marginLeft: 8 }}><RedDot /></span> : null,
            pending > 0 ? `Review queue, ${pending} pending` : 'Review queue',
          )}
          {tab('parents', 'Parent published')}
        </>
      ) : (
        tab('global', 'Global')
      )}
    </div>
  );
}
