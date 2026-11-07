/** The two halves of a picture: left (rose) and right (sky), with a round tab between them. */
export const PAIR_LEFT = 'M27,0 H168 V135 A33,33 0 0 1 168,201 V336 H27 Q0,336 0,309 V27 Q0,0 27,0 Z';
export const PAIR_RIGHT = 'M168,0 H309 Q336,0 336,27 V309 Q336,336 309,336 H168 V201 A33,33 0 0 0 168,135 Z';
export const PAIR_ROSE = '#EBB7BC';
export const PAIR_SKY = '#A9C6DE';
/** The Puzzle Pairs berry: card title, game-list icon ring, help badge. */
export const PAIRS_BERRY = '#A2577F';

/** The two halves apart, drawn wide (the game-list card and the help popup). Decorative. */
export function PairsHalves({ width }: { width: number }) {
  return (
    <svg aria-hidden="true" width={width} height={(width * 344) / 368} viewBox="-16 -4 368 344" fill="none" strokeLinejoin="round">
      <path d={PAIR_LEFT} transform="translate(-8 0)" fill={PAIR_ROSE} stroke={PAIRS_BERRY} strokeWidth="8" />
      <path d={PAIR_RIGHT} transform="translate(8 0)" fill={PAIR_SKY} stroke={PAIRS_BERRY} strokeWidth="8" />
    </svg>
  );
}

/** The round mark: the two halves on a pale circle (the game-list icon, the empty picture screen). Decorative. */
export function PairsMark({ size, ring = 2 }: { size: number; /** Width of the circle's ring, in the 24-unit drawing. */ ring?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" fill="#F8EAF2" stroke={PAIRS_BERRY} strokeWidth={ring} />
      <g transform="translate(6.3 6.3) scale(0.034)" stroke={PAIRS_BERRY} strokeWidth="14">
        <path d={PAIR_LEFT} fill={PAIR_ROSE} />
        <path d={PAIR_RIGHT} fill={PAIR_SKY} />
      </g>
    </svg>
  );
}
