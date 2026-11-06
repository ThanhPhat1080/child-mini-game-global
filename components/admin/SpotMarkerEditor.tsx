'use client';

import { useState } from 'react';
import { DEFAULT_R, MAX_DIFFS, MAX_R, MIN_R, SMALL_R } from '@/lib/spot/validate';
import type { Difference } from '@/lib/spot/types';
import s from './admin-ui.module.css';
import { PicIcon, dangerBtn, ghostBtn } from './editor-parts';
import { Pic } from '@/components/Pic';

const EDGE = 0.01;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Places and sizes the spots of one level (A15). Click picture A or B to add a spot; click a spot to select it.
 * `readOnly` (View mode): the same pictures and spots, larger, with no way to place or change them.
 */
export function SpotMarkerEditor({ srcA, srcB, differences, onChange, readOnly = false }: { srcA: string | null; srcB: string | null; differences: Difference[]; onChange: (next: Difference[]) => void; readOnly?: boolean }) {
  const [showB, setShowB] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);

  const viewB = showB && !!srcB;
  const src = viewB ? srcB : srcA;
  const sel = selected !== null && selected < differences.length ? selected : null;

  function place(e: React.MouseEvent) {
    if (!imgEl) return;
    const rect = imgEl.getBoundingClientRect(); // measured now: the picture may have been resized
    if (!(rect.width > 0) || !(rect.height > 0)) return;
    if (differences.length >= MAX_DIFFS) { setNotice(`You can add at most ${MAX_DIFFS} spots.`); return; }
    const x = round3(clamp((e.clientX - rect.left) / rect.width, EDGE, 1 - EDGE));
    const y = round3(clamp((e.clientY - rect.top) / rect.height, EDGE, 1 - EDGE));
    setNotice(null);
    onChange([...differences, { x, y, r: DEFAULT_R }]);
    setSelected(differences.length);
  }

  function setRadius(pct: number) {
    if (sel === null || !Number.isFinite(pct)) return;
    const r = round3(clamp(pct / 100, MIN_R, MAX_R));
    onChange(differences.map((d, i) => (i === sel ? { ...d, r } : d)));
  }

  function remove() {
    if (sel === null) return;
    setNotice(null);
    onChange(differences.filter((_, i) => i !== sel));
    setSelected(null);
  }

  const smallCount = differences.filter((d) => d.r < SMALL_R).length;
  const tab = (on: boolean) => ({ ...ghostBtn, height: 36, background: on ? '#5A4038' : '#fff', color: on ? '#fff' : '#4A3830' }) as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" data-nav className={`${s.btn} ${s.ghost}`} style={tab(!viewB)} aria-pressed={!viewB} aria-label="Show picture A" onClick={() => setShowB(false)}>Picture A</button>
        <button type="button" data-nav className={`${s.btn} ${s.ghost}`} style={tab(viewB)} aria-pressed={viewB} aria-label="Show picture B" disabled={!srcB} onClick={() => setShowB(true)}>Picture B</button>
        <span style={{ fontSize: 13, color: '#7A6458' }}>
          {readOnly ? `${differences.length} ${differences.length === 1 ? 'difference' : 'differences'} marked.` : `Click picture A or B to mark a difference (${differences.length}/${MAX_DIFFS}).`}
        </span>
      </div>

      {src ? (
        <div style={{ background: '#FBF4E9', borderRadius: 14, padding: 8, display: 'flex', justifyContent: 'center' }}>
          <div onClick={readOnly ? undefined : place} style={{ position: 'relative', width: '100%', maxWidth: readOnly ? 960 : 640, lineHeight: 0, cursor: readOnly ? 'default' : 'crosshair' }}>
            <Pic ref={setImgEl} src={src} alt={viewB ? 'Picture B' : 'Picture A'} draggable={false} style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 8 }} />
            {differences.map((d, i) => (readOnly ? (
              <span
                key={i} aria-label={`Spot ${i + 1}`}
                style={{
                  position: 'absolute', left: `${d.x * 100}%`, top: `${d.y * 100}%`, width: `${d.r * 200}%`, aspectRatio: '1 / 1', transform: 'translate(-50%, -50%)',
                  boxSizing: 'border-box', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2.5px solid #fff', background: 'rgba(229,154,161,0.35)', boxShadow: '0 0 0 1.5px #A8484F',
                  color: '#4A3830', fontWeight: 700, fontSize: 15, fontFamily: 'Nunito, sans-serif', lineHeight: 1, pointerEvents: 'none',
                }}
              >{i + 1}</span>
            ) : (
              <button
                key={i} type="button" aria-label={`Spot ${i + 1}`} aria-pressed={sel === i}
                onClick={(e) => { e.stopPropagation(); setNotice(null); setSelected(i); }}
                style={{
                  position: 'absolute', left: `${d.x * 100}%`, top: `${d.y * 100}%`, width: `${d.r * 200}%`, aspectRatio: '1 / 1', transform: 'translate(-50%, -50%)',
                  boxSizing: 'border-box', borderRadius: '50%', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: sel === i ? '3px solid #5A4038' : '2.5px solid #fff', background: sel === i ? 'rgba(229,154,161,0.55)' : 'rgba(229,154,161,0.35)',
                  boxShadow: '0 0 0 1.5px #A8484F', color: '#4A3830', fontWeight: 700, fontSize: 13, fontFamily: 'Nunito, sans-serif', lineHeight: 1,
                }}
              >{i + 1}</button>
            )))}
          </div>
        </div>
      ) : (
        <div style={{ height: 160, borderRadius: 14, background: '#FBF4E9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A8968A', gap: 8, fontSize: 14 }}>
          <PicIcon size={28} /> Add both pictures first.
        </div>
      )}

      {!readOnly && smallCount > 0 && (
        <span role="status" style={{ fontSize: 13, fontWeight: 700, color: '#7A5410' }}>
          {smallCount === 1 ? '1 spot is small' : `${smallCount} spots are small`} and may be hard for a young child to see.
        </span>
      )}

      {!readOnly && notice && <span role="alert" style={{ fontSize: 13, fontWeight: 700, color: '#A8484F' }}>{notice}</span>}

      {!readOnly && sel !== null && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Spot {sel + 1}</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
            Size
            <input type="range" aria-label="Radius" min={4} max={12} step={1} value={Math.round(differences[sel].r * 100)} onChange={(e) => setRadius(Number(e.target.value))} style={{ width: 160, accentColor: '#3F6B48' }} />
            <span style={{ fontWeight: 400, color: '#7A6458', minWidth: 32 }}>{Math.round(differences[sel].r * 100)}%</span>
          </label>
          <button type="button" className={`${s.btn} ${s.danger}`} style={{ ...dangerBtn, height: 36 }} onClick={remove}>Delete spot</button>
        </div>
      )}
    </div>
  );
}
