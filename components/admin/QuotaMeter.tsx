const MB = 1024 * 1024;
const WARN_AT = 0.9;

/**
 * "12 / 50 MB" with a bar; turns to the warning colour at 90% (N4, Q4). `quota` null is a Super Admin: the total of
 * all families, with no bar.
 */
export function QuotaMeter({ used, quota }: { used: number; quota: number | null }) {
  const fmt = (b: number) => (Math.round((b / MB) * 10) / 10).toString();
  if (quota === null) {
    return <span style={{ fontSize: 14, fontWeight: 700, color: '#4A3830' }}>Storage, all families: {fmt(used)} MB</span>;
  }
  const ratio = quota > 0 ? Math.min(1, used / quota) : 1;
  const warn = ratio >= WARN_AT;
  const color = warn ? '#A8484F' : '#3F6B48';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 320 }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: warn ? '#A8484F' : '#4A3830' }}>
        Storage: {fmt(used)} / {fmt(quota)} MB
      </span>
      <div role="progressbar" aria-label="Storage used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}
        data-warn={warn ? 'true' : 'false'} style={{ height: 10, borderRadius: 5, background: '#EFE3D3', overflow: 'hidden' }}>
        <div style={{ width: `${ratio * 100}%`, height: '100%', background: color }} />
      </div>
      {warn && <span role="status" style={{ fontSize: 13, color: '#A8484F' }}>Almost full. Delete files you no longer use.</span>}
    </div>
  );
}
