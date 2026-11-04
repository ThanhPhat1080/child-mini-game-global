'use client';

import { useEffect, useRef, useState } from 'react';
import { IMPORT_MAX_BYTES, parseQuizImport } from '@/lib/quizImport';
import type { EQuestion } from '@/lib/sets';
import s from './admin-ui.module.css';
import { ghostBtn } from './editor-parts';

const SHOW_ERRORS = 8;

/** "+ Quick import questions" modal: template download, short guide, JSON file check, then append. */
export function ImportDialog({ onCancel, onImport }: { onCancel: () => void; onImport: (qs: EQuestion[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [ready, setReady] = useState<EQuestion[]>([]);

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
    const r = parseQuizImport(await file.text());
    setErrors(r.errors);
    setReady(r.questions);
  }

  const n = ready.length;
  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(74,56,48,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box', zIndex: 50 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="imtitle" style={{ background: '#fff', borderRadius: 20, padding: 28, maxWidth: 560, width: '100%', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', boxSizing: 'border-box', boxShadow: '0 20px 60px rgba(74,56,48,0.3)', display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'Nunito, sans-serif', color: '#4A3830' }}>
        <h2 id="imtitle" style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Quick import questions</h2>

        <div style={{ background: '#F1F6FB', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#2F5D91' }}>How it works</span>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.55, color: '#4A3830', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li>Download the template and fill in your questions and answers.</li>
            <li>Mark exactly one answer per question with <code>&quot;correct&quot;: true</code>.</li>
            <li>Choose your file below. The questions are added to the end of this set. Then press <b>Save</b>.</li>
          </ol>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#2F5D91', marginTop: 4 }}>Pictures</span>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li>Leave <code>&quot;image&quot;: &quot;&quot;</code> blank and upload the picture later in the editor, or paste a link from the internet that starts with <code>https://</code>.</li>
            <li>Or paste <b>SVG code</b> (starting with <code>&lt;svg</code>) into <code>&quot;image&quot;</code>. Use single quotes inside the SVG, keep it on one line, and keep it under 30,000 characters. The same SVG used in several answers is saved as <b>one file</b>.</li>
            <li><b>Question image:</b> up to 2 MB, best at 600 × 300 px.</li>
            <li><b>Answer image:</b> 84 × 84 px.</li>
            <li>SVG is best because it stays sharp at any size. PNG, JPG and WebP also work.</li>
          </ul>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <a href="/quiz-template.json" download="quiz-template.json" className={s.ghost} style={{ ...ghostBtn, height: 42, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 16px', boxSizing: 'border-box', textDecoration: 'none' }}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11" /><path d="M7 11l5 5 5-5" /><path d="M5 20h14" /></svg>
            Download quiz-template.json
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
            {n} {n === 1 ? 'question' : 'questions'} ready to import.
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" autoFocus className={s.ghost} onClick={onCancel} style={{ height: 44, padding: '0 20px', borderRadius: 12, border: '1.5px solid #E3D5C4', background: '#fff', color: '#4A3830', fontWeight: 700, fontFamily: 'Nunito, sans-serif', fontSize: 15, cursor: 'pointer' }}>Cancel</button>
          <button type="button" disabled={n === 0} onClick={() => onImport(ready)} className={s.btn} style={{ height: 44, padding: '0 20px', borderRadius: 12, border: 'none', background: '#3F73B5', color: '#fff', fontWeight: 700, fontFamily: 'Nunito, sans-serif', fontSize: 15, cursor: n === 0 ? 'default' : 'pointer', opacity: n === 0 ? 0.5 : 1 }}>
            {n > 0 ? `Import ${n} ${n === 1 ? 'question' : 'questions'}` : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
