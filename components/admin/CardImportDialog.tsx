'use client';

import { useEffect, useRef, useState } from 'react';
import { IMPORT_MAX_BYTES } from '@/lib/quizImport';
import { parseCardImport } from '@/lib/memory/import';
import type { ECard, EGroup } from '@/lib/memory/adminCards';
import s from './admin-ui.module.css';
import { ghostBtn } from './editor-parts';

const SHOW_ERRORS = 8;

/** "+ Quick import cards" modal: template download, short guide, JSON file check, then append. */
export function CardImportDialog({ groups = [], onCancel, onImport }: { groups?: readonly EGroup[]; onCancel: () => void; onImport: (cards: ECard[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [ready, setReady] = useState<ECard[]>([]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onCancel]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFileName(file.name); setErrors([]); setReady([]);
    if (file.size > IMPORT_MAX_BYTES) { setErrors(['This file is larger than 1 MB. Split it into smaller files.']); return; }
    const r = parseCardImport(await file.text(), groups);
    setErrors(r.errors);
    setReady(r.cards);
  }

  const n = ready.length;
  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(74,56,48,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box', zIndex: 50 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="cimtitle" style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 560, width: '100%', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', boxSizing: 'border-box', boxShadow: '0 20px 60px rgba(74,56,48,0.3)', display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'Nunito, sans-serif', color: '#4A3830' }}>
        <h2 id="cimtitle" style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Quick import cards</h2>

        <div style={{ background: '#F1F6FB', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#2F5D91' }}>How it works</span>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.55, color: '#4A3830', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li>Download the template and fill in your cards.</li>
            <li><b>word</b> is the English word read aloud (max 40 characters).</li>
            <li>Choose your file below. The cards are added to the end of the list and are unsaved until you press <b>Save</b>.</li>
          </ol>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#2F5D91', marginTop: 4 }}>Pictures and sound</span>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li><b>image</b> can be left blank (<code>&quot;&quot;</code>) to upload later, an <code>https://</code> link, or SVG code (starting with <code>&lt;svg</code>). The same SVG used on several cards is saved as <b>one file</b>.</li>
            <li>SVG is best because it stays sharp at any size. PNG, JPG and WebP up to 2 MB can be uploaded in the editor.</li>
            <li><b>audio</b> is optional: leave it blank, or give an <code>https://</code> link to a recorded pronunciation.</li>
            <li><b>group</b> is optional: it must be the name of a group that already exists under Groups (create it there first). Leave it blank for no group.</li>
            <li><b>active</b> defaults to <code>true</code>.</li>
            <li>Cards without a picture must be finished by hand before you can Save.</li>
          </ul>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <a href="/memory-cards-template.json" download="memory-cards-template.json" className={s.ghost} style={{ ...ghostBtn, height: 42, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 16px', boxSizing: 'border-box', textDecoration: 'none' }}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11" /><path d="M7 11l5 5 5-5" /><path d="M5 20h14" /></svg>
            Download memory-cards-template.json
          </a>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onFile} />
          <button type="button" className={s.btn} onClick={() => fileRef.current?.click()} style={{ height: 42, padding: '0 16px', borderRadius: 10, border: 'none', background: '#3F73B5', color: '#fff', fontWeight: 700, fontFamily: 'Nunito, sans-serif', fontSize: 14, cursor: 'pointer' }}>Choose JSON file…</button>
          {fileName && <span style={{ fontSize: 13, color: '#7A6458', wordBreak: 'break-all' }}>{fileName}</span>}
        </div>

        {errors.length > 0 && (
          <div role="alert" style={{ background: '#FBEDEE', borderRadius: 12, padding: '12px 14px', fontSize: 14, color: '#8A3840', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <b>Nothing was imported. Please fix these and choose the file again:</b>
            <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {errors.slice(0, SHOW_ERRORS).map((m, i) => <li key={i}>{m}</li>)}
            </ul>
            {errors.length > SHOW_ERRORS && <span>…and {errors.length - SHOW_ERRORS} more.</span>}
          </div>
        )}
        {n > 0 && (
          <div role="status" style={{ background: '#E3EEDD', borderRadius: 12, padding: '12px 14px', fontSize: 14, color: '#3F6B48', fontWeight: 700 }}>
            {n} {n === 1 ? 'card' : 'cards'} ready to import.
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" autoFocus className={s.ghost} onClick={onCancel} style={{ height: 44, padding: '0 20px', borderRadius: 12, border: '1.5px solid #E3D5C4', background: '#fff', color: '#4A3830', fontWeight: 700, fontFamily: 'Nunito, sans-serif', fontSize: 15, cursor: 'pointer' }}>Cancel</button>
          <button type="button" disabled={n === 0} onClick={() => onImport(ready)} className={s.btn} style={{ height: 44, padding: '0 20px', borderRadius: 12, border: 'none', background: '#3F73B5', color: '#fff', fontWeight: 700, fontFamily: 'Nunito, sans-serif', fontSize: 15, cursor: n === 0 ? 'default' : 'pointer', opacity: n === 0 ? 0.5 : 1 }}>
            {n > 0 ? `Import ${n} ${n === 1 ? 'card' : 'cards'}` : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
