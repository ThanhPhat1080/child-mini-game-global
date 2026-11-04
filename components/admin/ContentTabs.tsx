import type { Scope } from '@/lib/review';
import s from '@/components/admin/admin-ui.module.css';

/** "Mine" (editable) and "Global" (read-only) tabs of a parent's content area (N3). */
export function ContentTabs({ scope, onChange }: { scope: Scope; onChange: (s: Scope) => void }) {
  const tab = (value: Scope, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={scope === value}
      className={`${s.btn} ${scope === value ? '' : s.ghost}`}
      style={{ height: 38, padding: '0 18px', fontWeight: 700 }}
      onClick={() => onChange(value)}
    >
      {label}
    </button>
  );
  return (
    <div role="tablist" aria-label="Content" style={{ display: 'flex', gap: 8 }}>
      {tab('mine', 'Mine')}
      {tab('global', 'Global')}
    </div>
  );
}
