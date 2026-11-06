import { mb, usageLevel, type UsageLevel } from '@/lib/people';
import s from './admin-ui.module.css';

/** Fill colour per level: green below 70%, orange 70-85%, red above 85% (N10). */
const FILL: Record<UsageLevel, string> = { ok: '#3F6B48', warn: '#C27A1A', high: '#A8484F' };

/** "12 / 50 MB" with a bar, for a parent's storage (N10, N14). QuotaMeter stays for the media page. */
export function UsageBar({ used, quota }: { used: number; quota: number }) {
  const level = usageLevel(used, quota);
  const pct = quota > 0 ? Math.min(100, (used / quota) * 100) : used > 0 ? 100 : 0;
  return (
    <div className={s.usage}>
      <span className={s.usageText} style={{ color: level === 'ok' ? '#4A3830' : FILL[level] }}>{mb(used)} / {mb(quota)} MB</span>
      <div role="progressbar" aria-label="Storage used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} data-level={level} className={s.usageBar}>
        <div className={s.usageFill} style={{ width: `${pct}%`, background: FILL[level] }} />
      </div>
    </div>
  );
}
