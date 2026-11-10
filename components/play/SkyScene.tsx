import styles from './SkyScene.module.css';
import { SkyBees, type BeeRoute, type Point } from './SkyBees';

const BLADES = [60, 130, 210, 340, 470, 760, 880, 1040, 1260, 1380, 1560, 1700, 1820];
/** More grass past both sides of the stage, for the part of a wide window the stage does not cover. */
const EXTRA_BLADES = Array.from({ length: 12 }, (_, k) => [-80 - 140 * k, 2000 + 140 * k]).flat();
const FLOWERS: [number, number, string][] = [[150, 985, '#EBB7BC'], [420, 1010, '#F6E2A6'], [690, 990, '#FFFFFF'], [1010, 1015, '#EBB7BC'], [1300, 992, '#F6E2A6'], [1640, 1005, '#FFFFFF'], [1780, 985, '#EBB7BC']];
/** Where a bee sits on flower i: on top of its head (the head is 58px above the stem foot). */
export const flowerSeat = (i: number): Point => [FLOWERS[i][0], FLOWERS[i][1] - 66];
/**
 * Three bees weave over the meadow and land on the middle flowers (the ones the princess and prince do not cover).
 * Every route lasts BEE_CYCLE seconds (legs + rests + wait) and they start 2.5 s apart, so the schedule repeats exactly
 * and two bees never sit on the same flower: A on 2 (5-7.5 s) and 3 (11.1-13.6 s), B on 4 (7.1-10.1 s), C on 4 (10.5-12.5 s) and 2 (17-19.5 s).
 */
export const BEE_CYCLE = 24;
export const BEES: BeeRoute[] = [
  { id: 'beeA', from: [-60, 760], scale: 1.3, wait: 4.4, legs: [
    { to: flowerSeat(2), secs: 5, waves: 4, amp: 28, rest: 2.5 },
    { to: flowerSeat(3), secs: 3.6, waves: 3, amp: 34, rest: 2.5 },
    { to: [1990, 640], secs: 6, waves: 5, amp: 30, rest: 0 },
  ] },
  { id: 'beeB', from: [1990, 780], scale: 1.1, wait: 8.9, legs: [
    { to: flowerSeat(4), secs: 4.6, waves: 4, amp: 26, rest: 3 },
    { to: [-60, 700], secs: 7.5, waves: 6, amp: 30, rest: 0 },
  ] },
  { id: 'beeC', from: [-60, 840], scale: 1.2, wait: 5.5, legs: [
    { to: flowerSeat(4), secs: 5.5, waves: 5, amp: 24, rest: 2 },
    { to: flowerSeat(2), secs: 4.5, waves: 4, amp: 30, rest: 2.5 },
    { to: [-60, 720], secs: 4, waves: 4, amp: 28, rest: 0 },
  ] },
];

/** Lively clouds: [start x, y, scale, seconds to cross the sky, opacity]. Each one travels left to right and wraps around. */
const CLOUDS: [number, number, number, number, number][] = [
  [180, 150, 1, 120, 0.92],
  [760, 300, 0.8, 160, 0.78],
  [1320, 110, 1.2, 100, 0.88],
  [1620, 340, 0.6, 190, 0.66],
  [520, 60, 0.7, 140, 0.72],
];
/** The flying birds (animated images that flap on their own; 320x272), all drawn facing right. */
export const BIRD_SRC = '/images/bird-fly.webp';
export const PINK_BIRD_SRC = '/images/bird-pink-fly.webp';
export const BLUE_BIRD_SRC = '/images/bird-blue-fly.webp';
const BIRD_RATIO = 272 / 320;
export type Bird = { src: string; y: number; w: number; dur: number; delay: number; back?: boolean; dx?: number };
/** The big pink bird crosses back (mirrored); two small pink birds keep its pace and delay, a little behind it (dx). */
const PINK_LEAD = { src: PINK_BIRD_SRC, dur: 48, delay: -14, back: true } as const;
/**
 * Lively birds: a yellow bird and a smaller one farther away cross left to right with the clouds, and a pale blue one higher up;
 * the pink family crosses back. `dx` shifts a bird along its line (behind a leader flying left means to the right).
 */
export const BIRDS: Bird[] = [
  { src: BIRD_SRC, y: 210, w: 150, dur: 40, delay: 1.4 },
  { src: BIRD_SRC, y: 300, w: 96, dur: 56, delay: -24 },
  { src: BLUE_BIRD_SRC, y: 140, w: 116, dur: 50, delay: -38 },
  { ...PINK_LEAD, y: 250, w: 130 },
  { ...PINK_LEAD, y: 222, w: 74, dx: 135 },
  { ...PINK_LEAD, y: 286, w: 66, dx: 215 },
];

/** A bee route whose start and exit lie past the stage edge, moved out to the window's edge. */
function reach(bee: BeeRoute, edge: number): BeeRoute {
  const out = ([x, y]: Point): Point => [x < 0 ? x - edge : x > 1920 ? x + edge : x, y];
  return { ...bee, from: out(bee.from), legs: bee.legs.map((l) => ({ ...l, to: out(l.to) })) };
}

/** Both sky layers share one frame, so a bee on the front layer sits exactly on a flower of the back layer. */
const FRAME = { viewBox: '0 0 1920 1080', preserveAspectRatio: 'xMidYMid slice', style: { position: 'absolute', inset: 0, width: '100%', height: '100%' } } as const;

/**
 * The front layer of the lively sky: the bees, drawn above the princess and prince (the page puts it after them).
 * It lets clicks through to everything under it.
 */
export function SkyFront({ edge = 0 }: { edge?: number }) {
  return (
    <svg aria-hidden="true" width="100%" height="100%" {...FRAME} style={{ ...FRAME.style, pointerEvents: 'none', overflow: edge > 0 ? 'visible' : undefined }}>
      <SkyBees routes={edge > 0 ? BEES.map((b) => reach(b, edge)) : BEES} />
    </svg>
  );
}

/**
 * The sky, sun, clouds and hills behind the play area (FS1). `festive` adds balloons and stars (FS1, Task 8).
 * `lively` (grown-up sign-in page) adds drifting clouds, birds crossing the sky (drawn after the clouds, so in front of them)
 * and swaying grass and flowers; its bees are on the front layer (SkyFront).
 * `sparse` keeps only two balloons and two stars (the calm sky behind the games); `hills={false}` leaves the ground to the page.
 * Decorative only; every motion stops under prefers-reduced-motion.
 */
export function SkyScene({ festive = false, lively = false, sparse = false, hills = true, bleed = false, edge = 0 }: { festive?: boolean; lively?: boolean; sparse?: boolean; hills?: boolean; bleed?: boolean; edge?: number }) {
  // bleed: drawn behind the stage and not clipped to it; edge = stage px the window reaches past each side (birds and clouds start there)
  const sc = { ['--edge' as string]: `${edge}px` };
  return (
    <svg aria-hidden="true" width="100%" height="100%" {...FRAME} style={{ ...FRAME.style, ...(bleed ? { overflow: 'visible' } : {}), ...sc }}>
      <circle cx="1620" cy="190" r="96" fill="#F6E2A6" />
      <circle cx="1620" cy="190" r="140" fill="#F6E2A6" opacity="0.35" />
      {!lively && (
        <>
          <g className={styles.drift}>
            <ellipse cx="320" cy="180" rx="130" ry="44" fill="#FFFFFF" opacity="0.9" />
            <ellipse cx="400" cy="160" rx="90" ry="40" fill="#FFFFFF" opacity="0.9" />
          </g>
          <g className={styles.drift}>
            <ellipse cx="1100" cy="120" rx="110" ry="36" fill="#FFFFFF" opacity="0.8" />
          </g>
        </>
      )}
      {bleed && (
        <>
          {/* the hills roll on past both sides of the stage (the same curves, side by side), and the ground fills below it; without `hills` the single hill also runs under the stage (k = 0), so a page that draws none of its own still has ground */}
          {hills
            ? [-2, -1, 1, 2].map((k) => (
                <g key={k}>
                  <path transform={`translate(${k * 1920} ${-k * 20})`} d="M0 860 C 320 760 620 800 960 860 C 1300 920 1600 820 1920 840 L1920 1080 L0 1080 Z" fill="#D9E3CC" stroke="#D9E3CC" strokeWidth="2" />
                  <path transform={`translate(${k * 1920} 0)`} d="M0 950 C 400 880 800 930 1180 970 C 1500 1000 1720 940 1920 950 L1920 1080 L0 1080 Z" fill="#C7D6BA" stroke="#C7D6BA" strokeWidth="2" />
                </g>
              ))
            : [-2, -1, 0, 1, 2].map((k) => (
                <path key={k} transform={`translate(${k * 1920} 0)`} d="M0 960 C 400 900 800 940 1180 980 C 1500 1010 1720 950 1920 960 L1920 1080 L0 1080 Z" fill="#D9E3CC" stroke="#D9E3CC" strokeWidth="2" />
              ))}
          <rect x="-5000" y="1079" width="11920" height="3000" fill={hills ? '#C7D6BA' : '#D9E3CC'} />
        </>
      )}
      {hills && (
        <>
          <path d="M0 860 C 320 760 620 800 960 860 C 1300 920 1600 820 1920 840 L1920 1080 L0 1080 Z" fill="#D9E3CC" />
          <path d="M0 950 C 400 880 800 930 1180 970 C 1500 1000 1720 940 1920 950 L1920 1080 L0 1080 Z" fill="#C7D6BA" />
          <circle cx="260" cy="930" r="10" fill="#EBB7BC" />
          <circle cx="300" cy="950" r="8" fill="#F6E2A6" />
          <circle cx="1500" cy="960" r="10" fill="#EBB7BC" />
          <circle cx="1540" cy="940" r="8" fill="#FFFFFF" />
        </>
      )}
      {lively && (
        <>
          {CLOUDS.map(([x, y, sc, dur, op], i) => {
            // the travel is relative to the start x, so the cloud wraps just outside the sky; the negative delay parks it at x when the page opens
            const from = -x - 380 * sc - edge;
            const to = 1920 - x + 380 * sc + edge;
            const delay = -((x + 380 * sc) / (to - from)) * dur;
            return (
              <g key={i} transform={`translate(${x} ${y}) scale(${sc})`}>
                <g className={styles.cloudRun} style={{ ['--from' as string]: `${from / sc}px`, ['--to' as string]: `${to / sc}px`, animationDuration: `${dur}s`, animationDelay: `${delay}s` }}>
                  <g fill="#FFFFFF" opacity={op}>
                    <ellipse cx="0" cy="0" rx="140" ry="40" />
                    <ellipse cx="-62" cy="-26" rx="66" ry="38" />
                    <ellipse cx="22" cy="-42" rx="82" ry="46" />
                    <ellipse cx="92" cy="-14" rx="58" ry="32" />
                  </g>
                </g>
              </g>
            );
          })}
          {BIRDS.map(({ src, y, w, dur, delay, back, dx = 0 }, i) => (
            <g key={i} transform={`translate(${dx} ${y})`}>
              <g className={back ? styles.flyBack : styles.fly} style={{ animationDuration: `${dur}s`, animationDelay: `${delay}s` }}>
                <g className={styles.birdWave} style={{ animationDelay: `${-i * 1.7}s` }}>
                  <image href={src} x={-w / 2} y={(-w * BIRD_RATIO) / 2} width={w} height={w * BIRD_RATIO} transform={back ? 'scale(-1 1)' : undefined} />
                </g>
              </g>
            </g>
          ))}
          {(bleed ? EXTRA_BLADES : []).concat(BLADES).map((x, i) => (
            <g key={x} transform={`translate(${x} 1060)`}>
              <g className={styles.sway} style={{ animationDelay: `${-(i % 5) * 0.7}s` }}>
                <path d="M-12 0 Q-10 -34 -20 -58 M0 0 Q2 -44 0 -74 M12 0 Q10 -34 20 -54" fill="none" stroke={i % 2 ? '#7FA889' : '#6F9A7A'} strokeWidth="6" strokeLinecap="round" />
              </g>
            </g>
          ))}
          {FLOWERS.map(([x, y, c], i) => (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
              <g className={styles.swayFlower} style={{ animationDelay: `${-i * 0.6}s` }}>
                <path d="M0 0 Q4 -26 0 -52" fill="none" stroke="#86B08F" strokeWidth="5" strokeLinecap="round" />
                <g transform="translate(0 -58)">
                  {[0, 72, 144, 216, 288].map((a) => (
                    <ellipse key={a} cx="0" cy="-11" rx="8" ry="11" fill={c} transform={`rotate(${a})`} />
                  ))}
                  <circle r="7" fill="#E9C46A" />
                </g>
              </g>
            </g>
          ))}
        </>
      )}
      {festive && (
        <>
          <g className={styles.bob}>
            <path d="M170 370 C 160 400 180 420 170 440" fill="none" stroke="#B9A89A" strokeWidth="2" />
            <ellipse cx="170" cy="300" rx="56" ry="70" fill="#E59AA1" />
            {/* in the sparse sky the blue balloon moves down, clear of the sun and the top-right controls */}
            <g transform={sparse ? 'translate(90 300)' : undefined}>
            <path d="M1750 330 C 1740 360 1760 380 1750 400" fill="none" stroke="#B9A89A" strokeWidth="2" />
            <ellipse cx="1750" cy="260" rx="56" ry="70" fill="#8FB3D1" />
            </g>
            {!sparse && <path d="M1610 490 C 1600 520 1620 540 1610 560" fill="none" stroke="#B9A89A" strokeWidth="2" />}
            {!sparse && <ellipse cx="1610" cy="420" rx="56" ry="70" fill="#F6E2A6" />}
          </g>
          {(sparse ? [[760, 90], [1180, 130]] : [[420, 120], [760, 90], [1180, 130], [1420, 80], [300, 520]]).map(([x, y]) => (
            <g key={`${x}-${y}`} className={styles.twinkle} transform={`translate(${x},${y})`}>
              <path d="M0 -22 L5 -5 L22 0 L5 5 L0 22 L-5 5 L-22 0 L-5 -5 Z" fill="#F6E2A6" />
            </g>
          ))}
        </>
      )}
    </svg>
  );
}
