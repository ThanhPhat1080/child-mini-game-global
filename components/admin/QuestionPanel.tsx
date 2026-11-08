'use client';

import { useRef } from 'react';
import { hasAnswerContent, isQuestionComplete, type EQuestion, type ESet } from '@/lib/sets';
import s from './admin-ui.module.css';
import { LibraryButton } from './LibraryButton';
import { EditLock } from './EditLock';
import { SvgPaste } from './SvgPaste';
import { CheckOption, Img, PicIcon, dangerBtn, fileName, ghostBtn, inputStyle, panel } from './editor-parts';

const SLOTS = [
  { name: 'Rose', bg: '#F8DCDF', ring: '#E59AA1', badge: '#C77D85' },
  { name: 'Sky', bg: '#DCE8F1', ring: '#8FB3D1', badge: '#5F86A8' },
  { name: 'Butter', bg: '#F7ECCB', ring: '#E5C979', badge: '#8A6A2A' },
];
const arrowBtn = { width: 26, height: 20, border: 'none', background: 'transparent', color: '#7A6458', fontSize: 10, cursor: 'pointer', borderRadius: 6, padding: 0 } as const;

type Pick = { kind: 'qimg' } | { kind: 'voice' } | { kind: 'answer'; i: number };

/**
 * Question list (sidebar, left) + question editor (right). In View mode the list still selects questions,
 * but adding, moving and editing are hidden or locked.
 */
export function QuestionPanel({ d, cur, q, locked, onSelect, onAdd, onMove, onEdit, onAskDelete, onChooseLibrary, onSvg, onPlay }: {
  d: ESet; cur: number; q: EQuestion | null; locked: boolean;
  onSelect: (i: number) => void; onAdd: () => void; onMove: (i: number, dir: -1 | 1) => void;
  onEdit: (patch: Partial<EQuestion>) => void; onAskDelete: () => void;
  /** A picture or sound already in the library: the bucket path, nothing uploaded (A24). */
  onChooseLibrary: (t: Pick, path: string) => void;
  /** SVG code pasted for a picture: the page checks it and stores it as a file (A11 rules). */
  onSvg: (t: Pick, code: string) => void; onPlay: (path: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  /** Narrow screens: Previous/Next move the question carousel by one card (the CSS snaps it into place). */
  function slide(dir: -1 | 1) {
    const el = listRef.current;
    if (!el) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' });
  }
  const incomplete = d.qs.filter((x) => !isQuestionComplete(x)).length;
  const checks = q ? [
    { label: 'Question text or voice', done: !!q.text.trim() || !!q.voice, optional: false },
    { label: 'Question image (optional)', done: !!q.qimg, optional: true },
    { label: 'Picture or text for every answer', done: q.imgs.slice(0, q.count).every((im, i) => hasAnswerContent(im, q.texts[i])), optional: false },
    { label: 'Correct answer chosen', done: q.correct !== null && q.correct < q.count, optional: false },
  ] : [];

  return (
    <div className={s.qLayout}>
      <section className={s.qSide} style={{ ...panel, padding: 16, gap: 6 }} aria-label="Questions">
        <h2 style={{ margin: '4px 8px 8px', fontSize: 16, fontWeight: 700 }}>Questions <span style={{ color: '#7A6458', fontWeight: 600 }}>· {d.qs.length}</span></h2>
        <div className={s.qList} ref={listRef} aria-roledescription={d.qs.length > 1 ? 'carousel' : undefined} aria-label={d.qs.length > 1 ? 'Questions carousel' : undefined}>
        {d.qs.map((it, i) => {
          const sel = cur === i;
          const blank = !it.text.trim();
          return (
            <div key={it.id} className={s.qItem} style={sel ? { background: '#FBF4E9', boxShadow: 'inset 0 0 0 1.5px #E5C9B4' } : { background: '#fff' }}>
              <button type="button" data-nav className={`${s.q} ${s.btn}`} aria-current={sel ? 'true' : undefined} onClick={() => onSelect(i)} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, padding: '10px 6px 10px 12px', border: 'none', background: 'transparent', borderRadius: 12, cursor: 'pointer', fontFamily: 'Nunito, sans-serif', fontSize: 14, color: '#4A3830' }}>
                <span style={{ width: 28, height: 28, borderRadius: 14, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, ...(sel ? { background: '#5A4038', color: '#fff' } : { background: '#F1E7DA', color: '#4A3830' }) }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0, textAlign: 'left', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...(blank ? { color: '#8A766A', fontStyle: 'italic' } : {}) }}>{blank ? (it.voice ? 'Voice only' : 'New question') : it.text}</span>
                {!isQuestionComplete(it) && <span title="Incomplete" aria-label="Incomplete" style={{ flex: 'none', width: 10, height: 10, borderRadius: 5, background: '#E5A24A' }} />}
              </button>
              {sel && (
                <span style={{ display: 'flex', flexDirection: 'column', paddingRight: 6, ...(locked ? { visibility: 'hidden' } : {}) }}>
                  <button type="button" className={`${s.ghost} ${s.btn}`} aria-label="Move question up" disabled={i === 0} onClick={locked ? undefined : () => onMove(i, -1)} style={arrowBtn}>▲</button>
                  <button type="button" className={`${s.ghost} ${s.btn}`} aria-label="Move question down" disabled={i === d.qs.length - 1} onClick={locked ? undefined : () => onMove(i, 1)} style={arrowBtn}>▼</button>
                </span>
              )}
            </div>
          );
        })}
        </div>
        {d.qs.length === 0 && <p style={{ margin: '4px 8px 8px', fontSize: 14, color: '#7A6458' }}>No questions yet.</p>}
        {d.qs.length > 1 && (
          <div className={s.qNav}>
            <button type="button" className={`${s.ghost} ${s.btn}`} aria-label="Previous questions" onClick={() => slide(-1)} style={{ ...ghostBtn, height: 34, width: 40, padding: 0, fontSize: 16 }}>‹</button>
            <button type="button" className={`${s.ghost} ${s.btn}`} aria-label="Next questions" onClick={() => slide(1)} style={{ ...ghostBtn, height: 34, width: 40, padding: 0, fontSize: 16 }}>›</button>
          </div>
        )}
        <button type="button" className={`${s.dash} ${s.btn}`} onClick={locked ? undefined : onAdd} style={{ marginTop: 6, height: 46, borderRadius: 12, border: '1.5px dashed #D9C6B2', background: '#fff', color: '#4A3830', fontWeight: 700, fontFamily: 'Nunito, sans-serif', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...(locked ? { visibility: 'hidden' } : {}) }}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>Add question
        </button>
        {incomplete > 0 && <p style={{ margin: '8px 8px 4px', fontSize: 13, color: '#7A6458', lineHeight: 1.4 }}>{incomplete} {incomplete === 1 ? 'question is' : 'questions are'} incomplete (amber dot). The child will not see them until they are finished.</p>}
      </section>

      <EditLock locked={locked}>
      <section style={{ ...panel, minWidth: 0, padding: 28, gap: 24 }}>
        {d.qs.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '56px 16px', textAlign: 'center' }}>
            <span style={{ width: 72, height: 72, borderRadius: 36, background: '#F8DCDF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg aria-hidden="true" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#B8737B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
            </span>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>No questions yet</h2>
            <p style={{ margin: 0, color: '#6E5A4E', fontSize: 15, maxWidth: 360 }}>Each question has a voice (optional) and 2–3 picture answers. The child taps a picture, or presses 1, 2 or 3.</p>
            <button type="button" className={s.btn} onClick={onAdd} style={{ height: 46, padding: '0 22px', borderRadius: 12, border: 'none', background: '#5A4038', color: '#fff', fontWeight: 700, fontFamily: 'Nunito, sans-serif', fontSize: 15, cursor: 'pointer' }}>Add your first question</button>
          </div>
        )}

        {q && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Question {cur + 1}</h2>
              <button type="button" className={s.danger} onClick={onAskDelete} style={{ ...dangerBtn, height: 38 }}>Delete question</button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} aria-label="Question checklist">
              {checks.map((k) => (
                <span key={k.label} style={{ padding: '5px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700, ...(k.done ? { background: '#E3EEDD', color: '#3F6B48' } : k.optional ? { background: '#F3ECE3', color: '#6E5A4E' } : { background: '#FBEBCB', color: '#7A5410' }) }}>
                  <span aria-hidden="true">{k.done ? '✓' : '○'}</span> {k.label}
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label htmlFor="qt" style={{ fontSize: 14, fontWeight: 700 }}>Question text</label>
              <input id="qt" className={s.in} type="text" value={q.text} placeholder="e.g. Where is the apple?" onChange={(e) => onEdit({ text: e.target.value })} style={inputStyle} />
              <span style={{ fontSize: 13, color: '#7A6458' }}>For adults only. The child relies on the voice and pictures.</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Question image <span style={{ fontWeight: 600, color: '#7A6458' }}>(optional · shown beside the question)</span></span>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, padding: 14, borderRadius: 14, background: '#FBF4E9' }}>
                <div style={{ width: 300, height: 150, flex: 'none', boxSizing: 'border-box', borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', ...(q.qimg ? { background: '#fff', border: '2px solid #E3D5C4' } : { background: '#FFFDF9', border: '3px dashed #D9C6B2' }) }}>
                  {q.qimg ? <Img path={q.qimg} w="100%" h="100%" /> : <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#8A766A', fontSize: 13, fontWeight: 700 }}><PicIcon />No image yet</span>}
                </div>
                <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{q.qimg ? fileName(q.qimg) : 'No image yet. You can skip it.'}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <LibraryButton kind="image" label="question image" onChoose={(p) => onChooseLibrary({ kind: 'qimg' }, p)} />
                    <div style={{ flexBasis: '100%' }}><SvgPaste label="question image" onUse={(code) => onSvg({ kind: 'qimg' }, code)} /></div>
                    {q.qimg && <button type="button" className={s.ghost} onClick={() => onEdit({ qimg: null })} style={ghostBtn}>Remove</button>}
                  </div>
                  <span style={{ fontSize: 13, color: '#6E5A4E', lineHeight: 1.45 }}>SVG (best), PNG, JPG or WebP, up to 2 MB. Best at 600 × 300 px (2:1). Larger images are scaled down to fit the frame, never cropped or stretched.</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Question voice <span style={{ fontWeight: 600, color: '#7A6458' }}>(optional)</span></span>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 14, background: '#FBF4E9' }}>
                {q.voice ? (
                  <>
                    <button type="button" className={s.btn} aria-label="Play question voice" onClick={() => onPlay(q.voice!)} style={{ width: 40, height: 40, borderRadius: 20, border: 'none', background: '#EBB7BC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M8 5.5v13l10.5-6.5z" /></svg>
                    </button>
                    <span style={{ flex: '1 1 180px', fontWeight: 700, fontSize: 15, overflowWrap: 'anywhere' }}>{fileName(q.voice)}</span>
                    <LibraryButton kind="audio" label="question voice" onChoose={(p) => onChooseLibrary({ kind: 'voice' }, p)} />
                    <button type="button" className={s.ghost} onClick={() => onEdit({ voice: null })} style={ghostBtn}>Remove</button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: '1 1 200px', fontSize: 14, color: '#6E5A4E' }}>No voice yet. The child will only see the pictures.</span>
                    <LibraryButton kind="audio" label="question voice" onChoose={(p) => onChooseLibrary({ kind: 'voice' }, p)} />
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Answers · add a picture to each and pick the correct one</span>
                <span style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: '#FBF4E9' }} role="group" aria-label="Number of answers">
                  {([2, 3] as const).map((n) => (
                    <button key={n} type="button" className={s.btn} onClick={() => onEdit({ count: n, correct: q.correct !== null && q.correct >= n ? null : q.correct })} style={{ height: 34, padding: '0 14px', borderRadius: 9, border: 'none', fontWeight: 700, fontFamily: 'Nunito, sans-serif', fontSize: 13, cursor: 'pointer', ...(q.count === n ? { background: '#fff', color: '#4A3830', boxShadow: '0 1px 2px rgba(90,64,56,0.15)' } : { background: 'transparent', color: '#6E5A4E' }) }}>{n} answers</button>
                  ))}
                </span>
              </div>
              <CheckOption checked={q.readAnswers} onChange={() => onEdit({ readAnswers: !q.readAnswers })} title="Read the answers aloud" hint="After the question, the app reads each answer text one by one. Turn off to read only the question. The answer the child picks is always read aloud." />
              <CheckOption checked={q.hideAnswerText} onChange={() => onEdit({ hideAnswerText: !q.hideAnswerText })} title="Hide the answer text" hint="The answer cards show only the picture, without the text. The text is still read aloud: in the one-by-one reading when “Read the answers aloud” is on, and always for the answer the child picks." />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                {SLOTS.slice(0, q.count).map((c, i) => {
                  const img = q.imgs[i];
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, borderRadius: 16, background: '#fff', border: `2px solid ${q.correct === i ? '#7FA889' : '#F1E7DA'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ width: 34, height: 34, borderRadius: 17, background: c.badge, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Baloo 2', sans-serif", fontWeight: 600, fontSize: 18 }}>{i + 1}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#6E5A4E' }}>{c.name}</span>
                      </div>
                      <div style={{ height: 150, borderRadius: 12, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', ...(img ? { background: c.bg, border: `4px solid ${c.ring}` } : { background: '#FFFDF9', border: '3px dashed #D9C6B2' }) }}>
                        {img ? (
                          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                            <Img path={img} w={84} h={84} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#6E5A4E', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName(img)}</span>
                          </span>
                        ) : (
                          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#8A766A', fontSize: 13, fontWeight: 700 }}><PicIcon />No image yet</span>
                        )}
                      </div>
                      <LibraryButton kind="image" label={`answer ${i + 1} image`} onChoose={(p) => onChooseLibrary({ kind: 'answer', i }, p)} />
                      <SvgPaste label={`answer ${i + 1} image`} onUse={(code) => onSvg({ kind: 'answer', i }, code)} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label htmlFor={`at${i}`} style={{ fontSize: 13, fontWeight: 700 }}>Answer text <span style={{ fontWeight: 600, color: '#7A6458' }}>(read aloud when picked; needed if no image)</span></label>
                        <input id={`at${i}`} className={s.in} type="text" value={q.texts[i]} placeholder="e.g. Apple" onChange={(e) => onEdit({ texts: q.texts.map((t, k) => (k === i ? e.target.value : t)) })} style={{ ...inputStyle, height: 40, fontSize: 15 }} />
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                        <input type="radio" name="correct" checked={q.correct === i} onChange={() => onEdit({ correct: i })} style={{ width: 18, height: 18, accentColor: '#3F6B48' }} />Correct answer
                      </label>
                    </div>
                  );
                })}
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#6E5A4E' }}>Number and color are fixed by position (1 rose, 2 sky, 3 butter) so keys 1–3 always match what the child sees.</p>
            </div>
          </>
        )}
      </section>
      </EditLock>
    </div>
  );
}
