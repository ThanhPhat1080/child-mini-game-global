import type { Player } from '@/lib/caro/rules';

/** X is blue and O is red: the two player colours of Caro X O. */
export const X_BLUE = '#3D7DD8';
export const O_RED = '#E0555F';

export const markColor = (p: Player): string => (p === 'X' ? X_BLUE : O_RED);

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
