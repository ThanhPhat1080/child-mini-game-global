'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { moveCrop, resizeCrop, startCropFor, type Crop } from '@/lib/crop/geometry';
import { ghostBtn } from './editor-parts';
import s from './admin-ui.module.css';
import { Pic } from '@/components/Pic';

/** Arrow keys move the square by this fraction of the picture's shorter side. */
const KEY_STEP = 0.02;
const PREVIEW_PX = 160;

type Drag = { x: number; y: number; scale: number; apply: (dx: number, dy: number) => void };

/** One axis of `background-position`, so the preview shows the square (CSS only). `a` is the crop's offset, `b` its size, both as fractions. */
const bgPos = (a: number, b: number): number => (b >= 1 ? 0 : (100 * a) / (1 - b));

/**
 * Admin crop window (A24): a square over the picture that the parent moves and resizes, then saves.
 * It only chooses the square; the caller crops the file and uploads it.
 */
export function CropDialog({ file, start, onCancel, onSave }: {
  file: File; start?: Crop; onCancel: () => void; onSave: (crop: Crop) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [size, setSize] = useState<{ W: number; H: number } | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [focused, setFocused] = useState(false);
  const [broken, setBroken] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const ready = !!size && !!crop;

  // Focus the square once it exists, so the keys work and Esc is handled here, not by the library behind.
  useEffect(() => {
    if (ready) areaRef.current?.focus();
  }, [ready]);

  function onLoad(e: { currentTarget: HTMLImageElement }) {
    const W = e.currentTarget.naturalWidth;
    const H = e.currentTarget.naturalHeight;
    setSize({ W, H });
    setCrop(startCropFor(start, W, H));
  }

  function beginDrag(e: PointerEvent<HTMLElement>, apply: Drag['apply']) {
    if (!imgRef.current) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = imgRef.current.getBoundingClientRect();
    const scale = size && rect.width ? size.W / rect.width : 1;
    drag.current = { x: e.clientX, y: e.clientY, scale, apply };
  }

  function moveDrag(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d) return;
    d.apply((e.clientX - d.x) * d.scale, (e.clientY - d.y) * d.scale);
    d.x = e.clientX;
    d.y = e.clientY;
  }

  function endDrag() {
    drag.current = null;
  }

  function onAreaKey(e: KeyboardEvent<HTMLDivElement>) {
    if (!size || !crop) return;
    const { W, H } = size;
    if (e.key === 'Enter') {
      e.preventDefault();
      onSave(crop);
      return;
    }
    const dir: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    };
    const d = dir[e.key];
    if (!d) return;
    e.preventDefault();
    const step = Math.round(KEY_STEP * Math.min(W, H));
    setCrop(e.shiftKey ? resizeCrop(crop, step * (d[0] + d[1]), W, H) : moveCrop(crop, step * d[0], step * d[1], W, H));
  }

  const W = size?.W ?? 1;
  const H = size?.H ?? 1;
  const boxStyle: CSSProperties = crop
    ? { left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }
    : {};

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(74,56,48,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box', zIndex: 50 }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Crop picture"
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onCancel(); } }}
        style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 640, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', boxSizing: 'border-box', padding: '24px 28px', boxShadow: '0 20px 60px rgba(74,56,48,0.3)', display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'Nunito, sans-serif', color: '#4A3830' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>Crop picture</h2>
          <button type="button" aria-label="Close" onClick={onCancel} style={{ ...ghostBtn, width: 36, padding: 0 }}>×</button>
        </div>

        <div
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{ position: 'relative', alignSelf: 'center', display: 'inline-block', maxWidth: '100%', overflow: 'hidden', lineHeight: 0, touchAction: 'none' }}
        >
          {url && (
            <Pic
              ref={imgRef}
              src={url}
              alt=""
              draggable={false}
              onLoad={onLoad}
              onError={() => setBroken(true)}
              style={{ display: 'block', width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '52vh', userSelect: 'none', imageOrientation: 'from-image' } as CSSProperties}
            />
          )}
          {ready && (
            <div
              ref={areaRef}
              role="group"
              aria-label="Crop area"
              tabIndex={0}
              onKeyDown={onAreaKey}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onPointerDown={(e) => beginDrag(e, (dx, dy) => setCrop((c) => c && moveCrop(c, dx, dy, W, H)))}
              style={{
                ...boxStyle,
                position: 'absolute',
                boxSizing: 'border-box',
                border: '2px dashed #fff',
                boxShadow: '0 0 0 9999px rgba(74,56,48,0.35)',
                cursor: 'move',
                outline: focused ? '3px solid #E59AA1' : 'none',
                outlineOffset: 4,
              }}
            >
              <span
                aria-hidden="true"
                onPointerDown={(e) => beginDrag(e, (dx, dy) => setCrop((c) => c && resizeCrop(c, (dx + dy) / 2, W, H)))}
                style={{ position: 'absolute', right: -8, bottom: -8, width: 16, height: 16, background: '#fff', border: '2px solid #5a4038', borderRadius: 3, boxSizing: 'border-box', cursor: 'nwse-resize' }}
              />
            </div>
          )}
        </div>

        {broken && <p role="alert" style={{ margin: 0, color: '#A8484F', fontWeight: 700 }}>Could not read this picture</p>}

        {ready && crop && url && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              aria-hidden="true"
              style={{
                width: PREVIEW_PX, height: PREVIEW_PX, borderRadius: 12, border: '2px solid #EADCC8', boxSizing: 'border-box',
                backgroundImage: `url(${url})`, backgroundRepeat: 'no-repeat',
                backgroundSize: `${100 / crop.w}% ${100 / crop.h}%`,
                backgroundPosition: `${bgPos(crop.x, crop.w)}% ${bgPos(crop.y, crop.h)}%`,
              }}
            />
            <span style={{ fontSize: 13, color: '#7A6458' }}>Preview. The picture is saved as this square.</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className={`${s.btn} ${s.ghost}`} onClick={onCancel}>Cancel</button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => crop && onSave(crop)}
            style={{ height: 40, padding: '0 20px', borderRadius: 12, border: 'none', background: '#5a4038', color: '#fff', fontWeight: 700, fontSize: 14, cursor: ready ? 'pointer' : 'default', opacity: ready ? 1 : 0.5 }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
