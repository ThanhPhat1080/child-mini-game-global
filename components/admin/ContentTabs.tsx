import type { Scope } from '@/lib/review';
import s from '@/components/admin/admin-ui.module.css';

/** "Mine" (editable) and "Global" (read-only) tabs of a parent's content area (N3). */
export function ContentTabs({ scope, onChange }: { scope: Scope; onChange: (s: Scope) => void }) {
  const tab = (value: Scope, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={scope === value}
      className={`${s.tab} ${scope === value ? s.tabActive : ''}`}
      onClick={() => onChange(value)}
    >
      {label}
    </button>
  );
  return (
    <div role="tablist" aria-label="Content" className={s.tabs}>
      {tab('mine', 'Mine')}
      {tab('global', 'Global')}
    </div>
  );
}
