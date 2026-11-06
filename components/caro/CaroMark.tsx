import type { Player } from '@/lib/caro/rules';

/** X is rose and O is sky (the child's two player colours; the same blue as Spot). */
export const X_ROSE = '#D9707C';
export const O_SKY = '#5F86A8';

export const markColor = (p: Player): string => (p === 'X' ? X_ROSE : O_SKY);

/** A drawn X (two crossed strokes) or O (a ring) in a `size` box. Text-free: the child cannot read. */
export function CaroMark({ player, size = 180 }: { player: Player; size?: number }) {
  const color = markColor(player);
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ display: 'block' }}>
      {player === 'X' ? (
        <g stroke={color} strokeWidth="13" strokeLinecap="round">
          <path d="M22 22 L78 78" />
          <path d="M78 22 L22 78" />
        </g>
      ) : (
        <circle cx="50" cy="50" r="31" stroke={color} strokeWidth="13" />
      )}
    </svg>
  );
}
