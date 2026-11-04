import type { Visibility } from '@/lib/review';

const LOOK: Record<Visibility, { label: string; bg: string; fg: string }> = {
  private: { label: 'Private', bg: '#F3ECE3', fg: '#6E5A4E' },
  pending: { label: 'Under review', bg: '#FCF1D2', fg: '#7A5410' },
  global: { label: 'Global', bg: '#E3EEDD', fg: '#3F6B48' },
};

/** Status of a content row (N4): Private, Under review, or Global with a lock (read-only for the owner). */
export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  const l = LOOK[visibility];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700, background: l.bg, color: l.fg }}>
      {visibility === 'global' && (
        <svg aria-hidden="true" data-testid="lock" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
      )}
      {l.label}
    </span>
  );
}
