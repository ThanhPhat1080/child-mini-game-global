'use client';

import { useContentScope, type Scope } from '@/lib/review';

const ICON = { width: 64, height: 64, viewBox: '0 0 24 24', fill: 'none', strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

/**
 * Child switch between the family's own content and the approved global content (N6). Pictures only:
 * a house and a globe. The labels are for assistive tech. The choice is remembered and read by the games.
 */
export function ScopeSwitch() {
  const { scope, setScope } = useContentScope();
  const btn = (value: Scope, label: string, icon: React.ReactNode) => (
    <button
      key={value}
      type="button"
      className="hm-tap"
      aria-label={label}
      aria-pressed={scope === value}
      onClick={() => setScope(value)}
      style={{ width: 120, height: 120, borderRadius: 60, border: scope === value ? '8px solid #E59AA1' : '8px solid transparent', background: '#fff', boxShadow: '0 8px 0 #EADCC8', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', cursor: 'pointer' }}
    >
      {icon}
    </button>
  );
  return (
    <div role="group" aria-label="Which games" style={{ position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 24 }}>
      {btn('mine', 'My family', <svg {...ICON} stroke="#7A5C50"><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>)}
      {btn('global', 'Everyone', <svg {...ICON} stroke="#7A5C50"><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" /></svg>)}
    </div>
  );
}
