'use client';

import { useState } from 'react';
import s from './admin-ui.module.css';
import { ghostBtn } from './editor-parts';

const small = { ...ghostBtn, height: 34, padding: '0 12px', fontSize: 13 } as const;

/** "Or paste SVG code" under a picture field. `onUse` gets the raw code; the page checks it and stores it as a file. */
export function SvgPaste({ label, onUse }: { label: string; onUse: (code: string) => void }) {
  const [svg, setSvg] = useState('');
  return (
    <details>
      <summary style={{ fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Or paste SVG code</summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
        <textarea className={s.in} aria-label={`SVG code for ${label}`} rows={3} value={svg} onChange={(e) => setSvg(e.target.value)} placeholder="<svg …>…</svg>"
          style={{ width: '100%', boxSizing: 'border-box', padding: 8, fontSize: 12, fontFamily: 'monospace', resize: 'vertical', borderRadius: 10, border: '1.5px solid #E3D5C4', color: '#4A3830' }} />
        <button type="button" className={`${s.btn} ${s.ghost}`} aria-label={`Use SVG for ${label}`} style={{ ...small, alignSelf: 'flex-start' }} disabled={!svg.trim()}
          onClick={() => { onUse(svg); setSvg(''); }}>Use this drawing</button>
      </div>
    </details>
  );
}
