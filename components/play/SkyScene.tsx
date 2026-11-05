import styles from './SkyScene.module.css';

/** The sky, sun, clouds and hills behind the play area (FS1). `festive` adds balloons and stars (FS1, Task 8). Decorative only. */
export function SkyScene({ festive = false }: { festive?: boolean }) {
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
