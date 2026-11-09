/**
 * A small round badge for a set or level the family made (not a global one): a little house, in a soft rose circle.
 * Decorative only; the child cannot read, and the star (top-right) still means "finished".
 */
export function FamilyBadge({ size = 88, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <span
      data-family-badge
      aria-hidden="true"
      style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, background: '#F5D3D7', border: `${Math.round(size / 11)}px solid #FBF4E9`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', pointerEvents: 'none', ...style }}
    >
      <svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="#FBE9EB" stroke="#B8737B" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>
    </span>
  );
}
