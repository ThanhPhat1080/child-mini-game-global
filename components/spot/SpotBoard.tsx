'use client';

import { useRef, useState } from 'react';
import type { SpotLevel } from '@/lib/spot/types';
import { Pic } from '@/components/Pic';

export type SpotRipple = { side: 'a' | 'b'; x: number; y: number; key: number };

const MAX_W = 880;
const MAX_H = 860;
const GAP = 48;
/** Pictures are cropped to a square in the admin (ADR-032); the board sizes from the real picture once it loads. */
const DEFAULT_ASPECT = 1;

type Props = {
  level: SpotLevel;
  urlA: string | null;
  urlB: string | null;
  found: readonly number[];
  onTap: (point: { x: number; y: number }, aspect: number) => void;
  ripple?: SpotRipple | null;
  reduced?: boolean;
  /** Called just before `onTap` with the picture that was tapped (the page needs it to place a ripple). */
  onSide?: (side: 'a' | 'b') => void;
};

/** Two equal pictures side by side. A tap on either is reported as fractions of that picture's rect read at tap time. */
export function SpotBoard({ level, urlA, urlB, found, onTap, ripple = null, reduced = false, onSide }: Props) {
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);
  const [broken, setBroken] = useState({ a: false, b: false });
  /** The padding box inside the frame: the pictures and rings are drawn here, so taps are measured here. */
  const areas = useRef<{ a: HTMLSpanElement | null; b: HTMLSpanElement | null }>({ a: null, b: null });
  const heightBound = MAX_H * aspect <= MAX_W; // tall pictures fill the full height, wide ones the full width
  const w = heightBound ? Math.floor(MAX_H * aspect) : MAX_W;
  const h = heightBound ? MAX_H : Math.floor(MAX_W / aspect);

  const pic = (side: 'a' | 'b', url: string | null) => {
    const src = url && !broken[side] ? url : null;
    return (
      <div
        data-spot-pic={side}
        className="hm-spot-pic"
        onClick={(e) => {
          const el = areas.current[side];
          if (!el) return;
          const r = el.getBoundingClientRect(); // read at tap time, never cached
          if (!(r.width > 0) || !(r.height > 0)) return;
          const x = (e.clientX - r.left) / r.width;
          const y = (e.clientY - r.top) / r.height;
          if (x < 0 || x > 1 || y < 0 || y > 1) return; // a tap on the frame is not a tap on the picture
          onSide?.(side);
          onTap({ x, y }, aspect);
        }}
        style={{ width: w, height: h, borderRadius: 40, background: '#fff', border: '8px solid #A9C6DE', boxShadow: '0 8px 0 #EADCC8', boxSizing: 'border-box' }}
      >
        <span ref={(el) => { areas.current[side] = el; }} data-spot-area style={{ position: 'absolute', inset: 0, borderRadius: 32, overflow: 'hidden', display: 'block' }}>
          {src ? (
            <Pic
              src={src}
              alt=""
              draggable={false}
              onLoad={side === 'a' ? (e) => {
                const { naturalWidth: nw, naturalHeight: nh } = e.currentTarget;
                if (nw > 0 && nh > 0) setAspect(nw / nh);
              } : undefined}
              onError={() => setBroken((b) => ({ ...b, [side]: true }))}
              style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block', pointerEvents: 'none' }}
            />
          ) : (
            <svg data-placeholder aria-hidden="true" width="100%" height="100%" viewBox="0 0 10 10" preserveAspectRatio="none" style={{ display: 'block' }}>
              <rect width="10" height="10" fill="#EFE6DA" />
            </svg>
          )}
        </span>
        {found.map((i) => {
          const d = level.differences[i];
          if (!d) return null;
          return (
            <span
              key={i}
              data-spot-found
              className={reduced ? 'hm-spot-ring' : 'hm-spot-ring hm-spot-grow'}
              style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%`, width: `${Math.max(d.r, 0.04) * 200}%`, aspectRatio: '1' }}
            />
          );
        })}
        {ripple && ripple.side === side && (
          <span key={ripple.key} data-spot-ripple className="hm-spot-ripple" style={{ left: `${ripple.x * 100}%`, top: `${ripple.y * 100}%` }} />
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', gap: GAP, alignItems: 'flex-start', justifyContent: 'center' }}>
      {pic('a', urlA)}
      {pic('b', urlB)}
    </div>
  );
}
