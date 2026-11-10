'use client';

import { useEffect, useState, type ReactNode } from 'react';

const W = 1920;
const H = 1080;

/** Decoration behind the stage: gets `edge`, the stage px the window reaches past each side. */
export type StageBackdrop = (edge: number) => ReactNode;

/** The scale that fits the 1920x1080 stage into the window, and how far (in stage px) the window reaches past each side of it. */
export function useStageFit(): { scale: number; edge: number } {
  const [fit, setFit] = useState({ scale: 1, edge: 0 });

  useEffect(() => {
    const measure = () => {
      const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
      setFit({ scale, edge: Math.max(0, (window.innerWidth / scale - W) / 2) });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  return fit;
}

/** The scale that fits the 1920x1080 stage into the window. */
export function useStageScale(): number {
  return useStageFit().scale;
}

/**
 * Fixed 1920x1080 canvas scaled to fit any window, like the prototype boards.
 * `backdrop` is decoration drawn behind the stage on the same scale but not clipped to it, so the sky and ground reach the
 * window's edges (a wide window shows side bars otherwise) and birds, clouds and bees enter from the window's edge.
 * It gets `edge`: the stage px the window reaches past each side. It never takes clicks, and the page layout does not move.
 */
export function Stage({ children, backdrop }: { children: ReactNode; backdrop?: StageBackdrop }) {
  const { scale, edge } = useStageFit();
  const place = { position: 'absolute', left: '50%', top: '50%', width: W, height: H, transform: `translate(-50%, -50%) scale(${scale})` } as const;

  return (
    <div className="hm-child" style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#FBF4E9' }}>
      {backdrop && (
        <div aria-hidden="true" data-backdrop style={{ ...place, pointerEvents: 'none' }}>
          {backdrop(edge)}
        </div>
      )}
      <div
        style={{
          ...place,
          overflow: 'hidden',
          fontFamily: "'Baloo 2', 'Nunito', sans-serif",
          color: '#5A4038',
        }}
      >
        {children}
      </div>
    </div>
  );
}
