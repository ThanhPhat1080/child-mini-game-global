'use client';

import { useRef, useState } from 'react';
import type { FindObject } from '@/lib/find/types';
import { MIN_HIT_R } from '@/lib/find/validate';
import { Pic } from '@/components/Pic';

export type FindRipple = { x: number; y: number; key: number };

const MAX_W = 1184; // the picture column: 1920 minus the word list (left 40 + 480 wide + gap) and room for the music button at the right
const MAX_H = 900;
/** Pictures are cropped to a square in the admin (ADR-032); the board sizes from the real picture once it loads. */
const DEFAULT_ASPECT = 1;

type Props = {
  url: string | null;
  objects: FindObject[];
  found: readonly number[];
  onTap: (point: { x: number; y: number }, aspect: number) => void;
  ripple?: FindRipple | null;
  reduced?: boolean;
};

/** One big picture (F2). Taps are fractions of the picture area's rect, read at tap time; rings mark found objects (F4). */
export function FindBoard({ url, objects, found, onTap, ripple = null, reduced = false }: Props) {
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);
  const [broken, setBroken] = useState(false);
  /** The padding box inside the frame: the picture, rings and ripple are drawn here, so taps are measured here. */
  const area = useRef<HTMLSpanElement | null>(null);
  const heightBound = MAX_H * aspect <= MAX_W; // tall pictures fill the full height, wide ones the full width
  const w = heightBound ? Math.floor(MAX_H * aspect) : MAX_W;
  const h = heightBound ? MAX_H : Math.floor(MAX_W / aspect);
  const src = url && !broken ? url : null;

  return (
    <div
      data-find-pic
      style={{ position: 'relative', width: w, height: h, margin: '0 auto', borderRadius: 40, background: '#fff', border: '8px solid #F2C9A8', boxShadow: '0 8px 0 #EADCC8', boxSizing: 'border-box' }}
    >
      <span
        ref={area}
        data-find-area
        onClick={(e) => {
          const el = area.current;
          if (!el) return;
          const r = el.getBoundingClientRect(); // read at tap time, never cached
          if (!(r.width > 0) || !(r.height > 0)) return;
          const x = (e.clientX - r.left) / r.width;
          const y = (e.clientY - r.top) / r.height;
          if (x < 0 || x > 1 || y < 0 || y > 1) return;
          onTap({ x, y }, aspect);
        }}
        style={{ position: 'absolute', inset: 0, borderRadius: 32, overflow: 'hidden', display: 'block', cursor: 'pointer', touchAction: 'manipulation', userSelect: 'none' }}
      >
        {src ? (
          <Pic
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) => {
              const { naturalWidth: nw, naturalHeight: nh } = e.currentTarget;
              if (nw > 0 && nh > 0) setAspect(nw / nh);
            }}
            onError={() => setBroken(true)}
            style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block', pointerEvents: 'none' }}
          />
        ) : (
          <svg data-placeholder aria-hidden="true" width="100%" height="100%" viewBox="0 0 10 10" preserveAspectRatio="none" style={{ display: 'block' }}>
            <rect width="10" height="10" fill="#EFE6DA" />
          </svg>
        )}
        {found.map((i) => {
          const o = objects[i];
          if (!o) return null;
          return (
            <span
              key={i}
              data-find-found
              className={reduced ? 'hm-find-ring' : 'hm-find-ring hm-find-grow'}
              style={{ left: `${o.x * 100}%`, top: `${o.y * 100}%`, width: `${Math.max(o.r, MIN_HIT_R) * 200}%`, aspectRatio: '1' }}
            />
          );
        })}
        {ripple && (
          <span key={ripple.key} data-find-ripple className="hm-find-ripple" style={{ left: `${ripple.x * 100}%`, top: `${ripple.y * 100}%` }} />
        )}
      </span>
    </div>
  );
}
