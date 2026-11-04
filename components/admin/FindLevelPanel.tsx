'use client';

import { useState } from 'react';
import Link from 'next/link';
import { setObjectAudio, type ELevel } from '@/lib/find/adminLevels';
import { checkObjects } from '@/lib/find/validate';
import { mediaUrl } from '@/lib/media';
import s from './admin-ui.module.css';
import { Chevron } from './LevelSort';
import { FindMarkerEditor } from './FindMarkerEditor';
import { MediaLibraryDialog } from './MediaLibraryDialog';
import { PicIcon, dangerBtn, fileName, ghostBtn, panel } from './editor-parts';
import { Pic } from '@/components/Pic';
import { EditLock } from './EditLock';
import { ShareToggle } from './ShareToggle';
import { VisibilityBadge } from './VisibilityBadge';
import type { Visibility } from '@/lib/review';

/** Accepted level pictures (A21), the same types as the Spot and Cards pictures. */
export const FIND_IMG_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

const small = { ...ghostBtn, height: 34, padding: '0 12px', fontSize: 13 } as const;
const hint = { fontSize: 12, color: '#7A6458' } as const;

/** The level's picture. A collapsed level keeps a small preview; the buttons and the SVG box show only when it is open. */
function PicturePicker({ n, path, open, onSvg, onLibrary }: { n: number; path: string | null; open: boolean; onSvg: (code: string) => void; onLibrary: () => void }) {
  const [svg, setSvg] = useState('');
  const url = mediaUrl(path);
  return (
    <div style={{ flex: open ? '1 1 240px' : '0 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 700 }}>Picture</span>
      <div style={{ height: open ? 130 : 72, borderRadius: 14, background: '#FBF4E9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A8968A', overflow: 'hidden' }}>
        {url ? <Pic src={url} alt={`Level ${n} picture`} draggable={false} style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: open ? 130 : 72, objectFit: 'contain' }} /> : <PicIcon size={30} />}
      </div>
      {open && (<>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className={`${s.btn} ${s.ghost}`} style={small} onClick={onLibrary}>+ Choose images</button>
        {path && <span style={{ ...hint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{fileName(path)}</span>}
      </div>
      <details>
        <summary style={{ fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Or paste SVG code</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
          <textarea className={s.in} aria-label={`SVG code for level ${n}`} rows={3} value={svg} onChange={(e) => setSvg(e.target.value)} placeholder="<svg …>…</svg>"
            style={{ border: '1.5px solid #E3D5C4', borderRadius: 12, padding: 8, fontSize: 12, fontFamily: 'monospace', resize: 'vertical', background: '#FFFDF9', color: '#4A3830' }} />
          <button type="button" className={`${s.btn} ${s.ghost}`} aria-label={`Use SVG for level ${n}`} style={{ ...small, alignSelf: 'flex-start' }} disabled={!svg.trim()} onClick={() => { onSvg(svg); setSvg(''); }}>Use this drawing</button>
        </div>
      </details>
      </>)}
    </div>
  );
}

/** One level: its picture, the objects, on/off, preview and delete. Edits go up through `onEdit`. */
export function FindLevelPanel({ l, n, message, onEdit, onSvg, onAskDelete, onVisibility }: {
  l: ELevel; n: number; message: string | null;
  onEdit: (patch: Partial<ELevel>) => void;
  onSvg: (code: string) => void;
  onAskDelete: () => void;
  /** The row was shared (it is now under review). */
  onVisibility?: (v: Visibility) => void;
}) {
  // which library dialog is open: the picture (true) or the sound of one object (its index)
  const [library, setLibrary] = useState<'picture' | number | null>(null);
  const [open, setOpen] = useState(l.isNew); // a saved level starts collapsed: only its header shows
  // Under review or global: read-only (V2, V3). Only the sharing row below stays usable.
  const locked = !!l.visibility && l.visibility !== 'private';
  const missing = !l.image ? 'a picture' : checkObjects(l.objects) ? '2 to 12 objects, each with a word' : '';

  return (
    <article aria-label={`Level ${n}`} style={{ ...panel, padding: 18, gap: 14, opacity: l.active ? 1 : 0.8, border: missing ? '1.5px dashed #E5C979' : '1.5px solid transparent' }}>
      <EditLock locked={locked}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
          <button type="button" aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} level ${n}`} onClick={() => setOpen(!open)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}>
            <Chevron open={open} />Level {n}
            {!open && missing && <span style={{ fontSize: 12, fontWeight: 700, color: '#7A5410', background: '#FCF1D2', borderRadius: 8, padding: '1px 8px' }}>Incomplete</span>}
          </button>
        </h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <input type="checkbox" role="switch" aria-label={`Level ${n} on`} checked={l.active} onChange={() => onEdit({ active: !l.active })} style={{ width: 18, height: 18, margin: 0, accentColor: '#3F6B48' }} />
            {l.active ? 'On' : 'Off (draft)'}
          </label>
          {!l.isNew && (
            <Link href={`/games/find/${l.id}`} target="_blank" rel="noopener" className={`${s.btn} ${s.ghost}`} style={{ ...small, display: 'inline-flex', alignItems: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>Preview as child</Link>
          )}
          <button type="button" className={`${s.btn} ${s.danger}`} aria-label={`Delete level ${n}`} onClick={onAskDelete} style={{ ...dangerBtn, height: 34 }}>Delete</button>
        </div>
      </div>

      <PicturePicker
        n={n} path={l.image} open={open}
        onSvg={onSvg}
        onLibrary={() => setLibrary('picture')}
      />

      {open && (
        <>

      <span style={hint}>Tip: use a clear picture where every object is big enough to click.</span>

      <FindMarkerEditor
        src={mediaUrl(l.image)} objects={l.objects}
        onChange={(objects) => onEdit({ objects })}
        onLibrarySound={(i) => setLibrary(i)}
      />

      {library !== null && (
        <MediaLibraryDialog
          kind={library === 'picture' ? 'image' : 'audio'}
          onClose={() => setLibrary(null)}
         
          onChoose={(path) => {
            if (library === 'picture') onEdit({ image: path });
            else onEdit({ objects: setObjectAudio(l.objects, library, path) });
          }}
        />
      )}

      {message && <span role="alert" style={{ fontSize: 13, fontWeight: 700, color: '#A8484F' }}>{message}</span>}
      {missing && <span style={{ fontSize: 13, color: '#7A5410' }}>Needs {missing} before you can save.</span>}
        </>
      )}
      </EditLock>
      {!l.isNew && l.visibility && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start', borderTop: '1px solid #F1E7DA', paddingTop: 10 }}>
          <VisibilityBadge visibility={l.visibility} />
          <ShareToggle table="find_levels" id={l.id} visibility={l.visibility} onChanged={onVisibility} />
        </div>
      )}
    </article>
  );
}
