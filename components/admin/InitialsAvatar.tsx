import { initials } from '@/lib/people';

/** A parent's picture stand-in: 1-2 uppercase initials on a soft circle (N10). The name is shown beside it, so it is hidden from screen readers. */
export function InitialsAvatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: '50%', flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: '#F5D9C4', color: '#8A5560', border: '3px solid #FBF4E9', boxSizing: 'border-box',
        fontFamily: "'Baloo 2', Nunito, sans-serif", fontWeight: 700, fontSize: Math.round(size * 0.4), lineHeight: 1,
      }}
    >
      {initials(name)}
    </span>
  );
}
