import styles from './SkyScene.module.css';

const BLADES = [60, 130, 210, 340, 470, 760, 880, 1040, 1260, 1380, 1560, 1700, 1820];
const FLOWERS: [number, number, string][] = [[150, 985, '#EBB7BC'], [420, 1010, '#F6E2A6'], [690, 990, '#FFFFFF'], [1010, 1015, '#EBB7BC'], [1300, 992, '#F6E2A6'], [1640, 1005, '#FFFFFF'], [1780, 985, '#EBB7BC']];

/**
 * The sky, sun, clouds and hills behind the play area (FS1). `festive` adds balloons and stars (FS1, Task 8).
 * `lively` (grown-up sign-in page) adds drifting clouds, birds crossing the sky and swaying grass and flowers.
 * Decorative only; every motion stops under prefers-reduced-motion.
 */
export function SkyScene({ festive = false, lively = false }: { festive?: boolean; lively?: boolean }) {
  return (
    <svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <circle cx="1620" cy="190" r="96" fill="#F6E2A6" />
      <circle cx="1620" cy="190" r="140" fill="#F6E2A6" opacity="0.35" />
      <g className={styles.drift}>
        <ellipse cx="320" cy="180" rx="130" ry="44" fill="#FFFFFF" opacity="0.9" />
        <ellipse cx="400" cy="160" rx="90" ry="40" fill="#FFFFFF" opacity="0.9" />
      </g>
      <g className={styles.drift}>
        <ellipse cx="1100" cy="120" rx="110" ry="36" fill="#FFFFFF" opacity="0.8" />
      </g>
      <path d="M0 860 C 320 760 620 800 960 860 C 1300 920 1600 820 1920 840 L1920 1080 L0 1080 Z" fill="#D9E3CC" />
      <path d="M0 950 C 400 880 800 930 1180 970 C 1500 1000 1720 940 1920 950 L1920 1080 L0 1080 Z" fill="#C7D6BA" />
      <circle cx="260" cy="930" r="10" fill="#EBB7BC" />
      <circle cx="300" cy="950" r="8" fill="#F6E2A6" />
      <circle cx="1500" cy="960" r="10" fill="#EBB7BC" />
      <circle cx="1540" cy="940" r="8" fill="#FFFFFF" />
      {lively && (
        <>
          <g className={styles.driftSlow}>
            <ellipse cx="760" cy="300" rx="120" ry="38" fill="#FFFFFF" opacity="0.75" />
            <ellipse cx="830" cy="282" rx="80" ry="34" fill="#FFFFFF" opacity="0.75" />
          </g>
          <g className={styles.driftFast}>
            <ellipse cx="1500" cy="330" rx="100" ry="32" fill="#FFFFFF" opacity="0.7" />
            <ellipse cx="1560" cy="314" rx="64" ry="28" fill="#FFFFFF" opacity="0.7" />
          </g>
          {[
            { y: 220, d: '0s', cls: styles.birdA },
            { y: 150, d: '-9s', cls: styles.birdB },
            { y: 280, d: '-17s', cls: styles.birdC },
          ].map((b, i) => (
            <g key={i} transform={`translate(0 ${b.y})`}>
              <g className={b.cls} style={{ animationDelay: b.d }}>
                <g className={styles.flap}>
                  <path transform="scale(1.8)" d="M-18 0 Q-9 -14 0 0 Q9 -14 18 0" fill="none" stroke="#7A5C50" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              </g>
            </g>
          ))}
          {BLADES.map((x, i) => (
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
            <path d="M1750 330 C 1740 360 1760 380 1750 400" fill="none" stroke="#B9A89A" strokeWidth="2" />
            <ellipse cx="1750" cy="260" rx="56" ry="70" fill="#8FB3D1" />
            <path d="M1610 490 C 1600 520 1620 540 1610 560" fill="none" stroke="#B9A89A" strokeWidth="2" />
            <ellipse cx="1610" cy="420" rx="56" ry="70" fill="#F6E2A6" />
          </g>
          {[[420, 120], [760, 90], [1180, 130], [1420, 80], [300, 520]].map(([x, y]) => (
            <g key={`${x}-${y}`} className={styles.twinkle} transform={`translate(${x},${y})`}>
              <path d="M0 -22 L5 -5 L22 0 L5 5 L0 22 L-5 5 L-22 0 L-5 -5 Z" fill="#F6E2A6" />
            </g>
          ))}
        </>
      )}
    </svg>
  );
}
