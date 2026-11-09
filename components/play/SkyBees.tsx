import styles from './SkyScene.module.css';

export type Point = [number, number];

/** One flight of a bee: from where it is to `to`, in `secs`, with `waves` gentle swings of `amp` px; it then rests `rest` seconds. */
export type BeeLeg = { to: Point; secs: number; waves: number; amp: number; rest: number };
/** A bee starts off-screen at `from`, flies its legs (landing on flowers on the way) and starts again `wait` seconds after the last one. */
export type BeeRoute = { id: string; from: Point; legs: BeeLeg[]; wait: number; scale: number };

/** A wavy path from a to b: `waves` arcs that swing left and right of the straight line. */
export function wavePath([x1, y1]: Point, [x2, y2]: Point, waves: number, amp: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const r = (v: number) => Math.round(v * 10) / 10;
  let d = `M${r(x1)} ${r(y1)}`;
  for (let k = 0; k < waves; k++) {
    const s = k % 2 ? -1 : 1;
    const a = k / waves;
    const b = (k + 1) / waves;
    const c1 = [x1 + dx * (a + (b - a) / 3) + nx * amp * s, y1 + dy * (a + (b - a) / 3) + ny * amp * s];
    const c2 = [x1 + dx * (a + (2 * (b - a)) / 3) + nx * amp * s, y1 + dy * (a + (2 * (b - a)) / 3) + ny * amp * s];
    d += ` C${r(c1[0])} ${r(c1[1])} ${r(c2[0])} ${r(c2[1])} ${r(x1 + dx * b)} ${r(y1 + dy * b)}`;
  }
  return d;
}

/** A small round bee seen from the front (so it never needs to turn around), wings buzzing. */
function BeeBody() {
  return (
    <g>
      <g transform="rotate(-28 -8 -10)"><ellipse className={styles.beeWing} cx="-8" cy="-17" rx="7" ry="10" fill="#FFFFFF" fillOpacity="0.85" stroke="#B9D0E2" strokeWidth="1.5" /></g>
      <g transform="rotate(28 8 -10)"><ellipse className={styles.beeWing} cx="8" cy="-17" rx="7" ry="10" fill="#FFFFFF" fillOpacity="0.85" stroke="#B9D0E2" strokeWidth="1.5" /></g>
      <path d="M-4 -10 Q-7 -18 -10 -21 M4 -10 Q7 -18 10 -21" fill="none" stroke="#7A5C50" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="-10" cy="-21" r="2" fill="#7A5C50" />
      <circle cx="10" cy="-21" r="2" fill="#7A5C50" />
      <ellipse cx="0" cy="0" rx="14" ry="12.5" fill="#F7DC8C" stroke="#C9A26A" strokeWidth="1.6" />
      <path d="M-13 4 Q0 8 13 4 M-10 9.5 Q0 12.5 10 9.5" fill="none" stroke="#9A7A62" strokeWidth="2.6" strokeLinecap="round" opacity="0.8" />
      <circle cx="-5" cy="-3" r="2.4" fill="#5A4038" />
      <circle cx="5" cy="-3" r="2.4" fill="#5A4038" />
      <circle cx="-4.3" cy="-3.8" r="0.9" fill="#FFFFFF" />
      <circle cx="5.7" cy="-3.8" r="0.9" fill="#FFFFFF" />
      <ellipse cx="-8.5" cy="1" rx="2.6" ry="1.6" fill="#F2A7B2" opacity="0.7" />
      <ellipse cx="8.5" cy="1" rx="2.6" ry="1.6" fill="#F2A7B2" opacity="0.7" />
      <path d="M-2 1 Q0 2.6 2 1" fill="none" stroke="#5A4038" strokeWidth="1.1" strokeLinecap="round" />
    </g>
  );
}

/**
 * Bees that weave over the meadow, land on a flower, rest, then fly on (SVG animateMotion, one per leg, chained by begin times; ids use "_" because a "-" in a SMIL begin reads as an offset).
 * Hidden until the first leg starts, so nothing sits in the corner at load; hidden entirely under prefers-reduced-motion (CSS).
 */
export function SkyBees({ routes }: { routes: BeeRoute[] }) {
  return (
    <g className={styles.bees}>
      {routes.map((bee, i) => {
        const points = [bee.from, ...bee.legs.map((l) => l.to)];
        const last = `${bee.id}_${bee.legs.length - 1}`;
        return (
          <g key={bee.id} data-bee={bee.id} visibility="hidden">
            <set attributeName="visibility" to="visible" begin={`${bee.id}_0.begin`} fill="freeze" />
            {bee.legs.map((leg, k) => (
              <animateMotion
                key={k}
                id={`${bee.id}_${k}`}
                path={wavePath(points[k], leg.to, leg.waves, leg.amp)}
                dur={`${leg.secs}s`}
                begin={k === 0 ? `${i * 2.5}s; ${last}.end+${bee.wait}s` : `${bee.id}_${k - 1}.end+${bee.legs[k - 1].rest}s`}
                fill="freeze"
                calcMode="spline"
                keyTimes="0;1"
                keySplines="0.45 0 0.55 1"
              />
            ))}
            <g transform={`scale(${bee.scale})`}>
              <g className={styles.beeHover}><BeeBody /></g>
            </g>
          </g>
        );
      })}
    </g>
  );
}
