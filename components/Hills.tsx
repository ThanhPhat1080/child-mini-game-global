/** Soft ground hills behind child screens. */
export function Hills({ variant = 'single' }: { variant?: 'single' | 'double' }) {
  return (
    <svg aria-hidden="true" width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
      {variant === 'single' ? (
        <path d="M0 960 C 400 900 800 940 1180 980 C 1500 1010 1720 950 1920 960 L1920 1080 L0 1080 Z" fill="#D9E3CC" />
      ) : (
        <>
          <path d="M0 900 C 320 800 620 840 960 900 C 1300 960 1600 860 1920 880 L1920 1080 L0 1080 Z" fill="#D9E3CC" />
          <path d="M0 980 C 400 920 800 960 1180 1000 C 1500 1030 1720 980 1920 990 L1920 1080 L0 1080 Z" fill="#C7D6BA" />
        </>
      )}
    </svg>
  );
}
