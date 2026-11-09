/**
 * A small round badge for a set or level the family made (not a global one): a star in a soft rose circle.
 * Decorative only; the child cannot read.
 */
export function FamilyBadge({ size = 88, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <span
      data-family-badge
      aria-hidden="true"
      style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, background: '#F5D3D7', border: `${Math.round(size / 11)}px solid #FBF4E9`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', pointerEvents: 'none', ...style }}
    >
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="#F6E2A6" stroke="#B8903F" strokeWidth="1.5" strokeLinejoin="round"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" /></svg>
    </span>
  );
}
