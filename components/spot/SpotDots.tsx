/** Progress for Spot the Differences: one dot per difference, the first `found` lit. Picture-only, named for assistive tech. */
export function SpotDots({ total, found }: { total: number; found: number }) {
  return (
    <div role="img" aria-label={`Found ${found} of ${total}`} style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
      {Array.from({ length: total }, (_, i) => {
        const on = i < found;
        return (
          <span
            key={i}
            data-spot-dot
            data-lit={i < found ? 'true' : undefined}
            style={{ width: 44, height: 44, borderRadius: 22, boxSizing: 'border-box', background: on ? '#F6E3A8' : '#fff', border: `6px solid ${on ? '#E5C979' : '#EADCC8'}`, boxShadow: on ? '0 0 0 6px rgba(246,227,168,.5)' : 'none', transition: 'background .4s ease, box-shadow .4s ease' }}
          />
        );
      })}
    </div>
  );
}
