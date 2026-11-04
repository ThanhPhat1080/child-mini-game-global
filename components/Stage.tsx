'use client';

import { useEffect, useState, type ReactNode } from 'react';

const W = 1920;
const H = 1080;

/** Fixed 1920x1080 canvas scaled to fit any window, like the prototype boards. */
export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#FBF4E9' }}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: W,
          height: H,
          overflow: 'hidden',
          transform: `translate(-50%, -50%) scale(${scale})`,
          fontFamily: "'Baloo 2', 'Nunito', sans-serif",
          color: '#5A4038',
        }}
      >
        {children}
      </div>
    </div>
  );
}
