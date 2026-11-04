'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clearPending, commitPendingMedia, materializeSvg, mediaUrl, removeMedia, svgToPending } from '@/lib/media';
import { pathsToDelete, setMediaPaths } from '@/lib/mediaPaths';
import { SetCard } from '@/components/SetCard';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { ImportDialog } from '@/components/admin/ImportDialog';
import { PRESETS, type PresetKey, blankSet, deleteSet, isQuestionComplete, loadSet, luminance, newQuestion, presetKeyFor, saveSet, tintFor, type EQuestion, type ESet } from '@/lib/sets';
import s from './admin-ui.module.css';
import { QuestionPanel } from './QuestionPanel';
import { LibraryButton } from './LibraryButton';
import { Toast, useToast, type ToastKind } from './Toast';
import { useMediaRenamed } from '@/lib/media/renames';
import { replacePath } from '@/lib/mediaPaths';
import { RevertButton, SaveButton } from './SaveButtons';
import { EditLock } from './EditLock';
import { ShareToggle } from './ShareToggle';
import { VisibilityBadge } from './VisibilityBadge';
import { getMyUserId, isLocked } from '@/lib/review';
import { SvgPaste } from './SvgPaste';
import { checkSvg } from '@/lib/quizImport';
import { CheckOption, panel, inputStyle, ghostBtn, dangerBtn, fileName, Img, PicIcon, Eye, Shell } from './editor-parts';

type Target = { kind: 'cover' } | { kind: 'qimg' } | { kind: 'voice' } | { kind: 'answer'; i: number };

/** Set editor (A4) + question editor (A5/A6/A8). Matches the AdminEditor board. */
export function SetEditor({ setId }: { setId: string }) {
  const router = useRouter();
  const isNewRoute = setId === 'new';
  const [d, setD] = useState<ESet | null>(null);
  const [saved, setSaved] = useState<ESet | null>(null);
  const [cur, setCur] = useState(0);
  const [nameError, setNameError] = useState(false);
  const [hexText, setHexText] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ type: 'set' } | { type: 'q'; i: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [missing, setMissing] = useState(false);
  const [me, setMe] = useState<string | null | undefined>(undefined);
  useEffect(() => { void getMyUserId().then(setMe, () => setMe(null)); }, []);
  const { toast, show: showToast, close: closeToast } = useToast();
  // a file renamed in the library: edits not saved yet follow it
  useMediaRenamed(useCallback((from: string, to: string) => {
    setD((v) => replacePath(v, from, to)); setSaved((v) => replacePath(v, from, to));
  }, []));
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const say = useCallback((text: string, kind: ToastKind | boolean = 'success') => {
    showToast(kind === true ? 'error' : kind === false ? 'success' : kind, text);
  }, [showToast]);

  const init = useCallback(async () => {
    if (isNewRoute) { const b = blankSet(); setD(b); setSaved(b); setCur(-1); return; }
    try {
      const loaded = await loadSet(setId);
      if (!loaded) { setMissing(true); return; }
      setD(loaded); setSaved(loaded); setCur(loaded.qs.length ? 0 : -1);
    } catch (e) { say((e as Error).message, true); }
  }, [isNewRoute, setId, say]);
  useEffect(() => { void init(); }, [init]);
  // picked files live in memory until Save (T15); free their previews when leaving
  useEffect(() => () => clearPending(), []);

  const dirty = useMemo(() => (d && saved ? JSON.stringify(d) !== JSON.stringify(saved) : false), [d, saved]);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  if (missing) {
    return <Shell><section style={panel}><h2 style={{ margin: 0 }}>Quiz set not found</h2><Link href="/admin/sets" className={s.link} style={{ fontWeight: 700 }}>Back to quiz sets</Link></section></Shell>;
  }
  if (!d || !saved) return <Shell><p style={{ color: '#7A6458' }}>Loading…</p></Shell>;

  const edit = (patch: Partial<ESet>) => setD({ ...d, ...patch });
  const editQ = (i: number, patch: Partial<EQuestion>) => setD({ ...d, qs: d.qs.map((q, k) => (k === i ? { ...q, ...patch } : q)) });
  const q = cur >= 0 && cur < d.qs.length ? d.qs[cur] : null;
  const completeCount = d.qs.filter(isQuestionComplete).length;
  const unsaved = dirty || d.isNew;
  const canPreview = !unsaved && completeCount > 0;
  const previewHint = unsaved
    ? 'Save your changes to enable the preview. It works on drafts too, so you do not need to publish.'
    : completeCount === 0 ? 'Add at least one complete question to preview.' : 'Preview works on drafts too, so you do not need to publish first.';
  const presetKey = presetKeyFor(d.color);
  const colorLabel = presetKey === 'custom' ? `Custom ${d.color.toUpperCase()}` : PRESETS[presetKey].label;
  const lowContrast = presetKey === 'custom' && 1.05 / (luminance(d.color) + 0.05) < 3;

  let chip = { text: 'Saved · Draft', bg: '#F3ECE3', fg: '#6E5A4E' };
  if (unsaved) chip = { text: d.isNew ? 'Not saved yet' : 'Unsaved changes', bg: '#FBEBCB', fg: '#7A5410' };
  else if (d.published) chip = { text: 'Saved · Published', bg: '#E3EEDD', fg: '#3F6B48' };

  async function doSave() {
    if (!d || !saved) return;
    if (!d.name.trim()) { setNameError(true); return; }
    setBusy(true);
    // picked files are only previews until now: upload them as part of Save
    let toSave = d;
    let uploaded: string[] = [];
    try {
      ({ d: toSave, uploaded } = await commitPendingMedia(d));
    } catch (e) {
      setBusy(false);
      say((e as Error).message, true);
      return;
    }
    const err = await saveSet(toSave, saved.published && !d.isNew);
    setBusy(false);
    if (err) say(err, true);
    let cleanupFailed = false;
    try {
      const fresh = await loadSet(d.id);
      if (fresh) {
        setD(fresh); setSaved(fresh); setHexText(null);
        clearPending();
       
        // the database now decides what is still used; free everything else (T15)
        const stale = pathsToDelete(setMediaPaths(saved), setMediaPaths(fresh), uploaded);
        cleanupFailed = !!(await removeMedia(stale));
      }
    } catch { /* keep local state */ }
    if (err) return;
    if (cleanupFailed) say('Saved, but some old files could not be removed from storage.', 'warning'); else say('Saved');
    if (d.isNew) router.replace(`/admin/sets/${d.id}`);
  }

  function revert() {
    if (!saved) return;
    clearPending(); // nothing was uploaded, so there is nothing to delete
    setD(saved); setHexText(null); setNameError(false);
    setCur(saved.qs.length ? Math.min(Math.max(cur, 0), saved.qs.length - 1) : -1);
  }




  /** Puts a picture or sound (a pending file, or a library path that is already uploaded) into the chosen field (A24). */
  function applyTarget(t: Target, path: string) {
    if (!d) return;
    if (t.kind === 'cover') edit({ cover: path });
    else if (t.kind === 'qimg') editQ(cur, { qimg: path });
    else if (t.kind === 'voice') editQ(cur, { voice: path });
    else { const imgs = d.qs[cur].imgs.slice(); imgs[t.i] = path; editQ(cur, { imgs }); }
  }

  /** Pasted SVG code: checked with the same rules as the Quiz import, then stored like an uploaded picture (A11). */
  function applySvg(t: Target, code: string) {
    const r = checkSvg(code);
    if ('error' in r) return say(`${r.error}.`, true);
    applyTarget(t, svgToPending(r.svg));
  }

  function playVoice(path: string) {
    audioRef.current?.pause();
    const url = mediaUrl(path);
    if (!url) return;
    audioRef.current = new Audio(url);
    audioRef.current.play().catch(() => undefined);
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (!d || j < 0 || j >= d.qs.length) return;
    const qs = d.qs.slice();
    [qs[i], qs[j]] = [qs[j], qs[i]];
    setD({ ...d, qs });
    setCur(j);
  }

  async function confirmDelete() {
    if (!confirm || !d) return;
    if (confirm.type === 'q') {
      const qs = d.qs.filter((_, k) => k !== confirm.i);
      setD({ ...d, qs });
      setCur(qs.length === 0 ? -1 : Math.min(cur > confirm.i ? cur - 1 : cur, qs.length - 1));
      setConfirm(null);
    } else {
      setBusy(true);
      const r = await deleteSet(d.id);
      setBusy(false);
      setConfirm(null);
      if (r.error) say(r.error, true);
      else {
        clearPending();
        setSaved(d); setDeleted(true);
        if (r.warning) say(r.warning, 'warning');
      }
    }
  }

  let confirmTitle = '', confirmBody = '', confirmButton = '';
  if (confirm?.type === 'q') {
    const cq = d.qs[confirm.i];
    confirmTitle = `Delete question ${confirm.i + 1}?`;
    confirmBody = `“${cq?.text.trim() || 'Untitled question'}” and its answer pictures will be removed from this set when you save. This can’t be undone after saving.`;
    confirmButton = 'Delete question';
  } else if (confirm) {
    confirmTitle = `Delete “${d.name.trim() || 'this set'}”?`;
    confirmBody = `The set and its ${d.qs.length} ${d.qs.length === 1 ? 'question' : 'questions'} will be removed${d.published ? ' and disappear from the front page' : ''}. This can’t be undone.`;
    confirmButton = 'Delete set';
  }

  // Only the owner edits, and only while the set is private (V1-V3). Until the user id is known, only the state counts.
  const locked = !d.isNew && isLocked(d.visibility, d.ownerId ?? null, me === undefined ? d.ownerId ?? null : me);
  const cardTitleColor = d.name.trim() ? d.color : '#B0A094';

  return (
    <Shell>
      <EditLock locked={locked}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#FBF4E9', padding: '12px 0', margin: '-12px 0', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, boxShadow: '0 8px 8px -8px rgba(90,64,56,0.18)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Link href="/admin/sets" className={s.link} style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>Quiz sets
          </Link>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>{d.isNew ? 'New quiz set' : `Edit set · ${d.name.trim() || 'Untitled'}`}</h1>
        </div>
        {!deleted && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'flex-end' }}>
              <span style={{ padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, background: chip.bg, color: chip.fg }}>{chip.text}</span>
              {canPreview ? (
                <Link href={`/games/quiz/${d.id}`} target="_blank" rel="noopener noreferrer" className={s.ghost} style={{ height: 44, padding: '0 18px', borderRadius: 12, border: '1.5px solid #E3D5C4', background: '#fff', color: '#4A3830', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, boxSizing: 'border-box' }}>
                  <Eye />Preview as child
                </Link>
              ) : (
                <button type="button" disabled title={previewHint} className={s.btn} style={{ height: 44, padding: '0 18px', borderRadius: 12, border: '1.5px solid #EADCC8', background: '#F6EFE6', color: '#A8968A', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, boxSizing: 'border-box', fontFamily: 'Nunito, sans-serif' }}><Eye />Preview as child</button>
              )}
              <RevertButton saving={busy} dirty={dirty} onClick={revert} />
              <SaveButton saving={busy} enabled={dirty || d.isNew} onClick={doSave} />
            </div>
            <span style={{ fontSize: 13, color: '#7A6458', maxWidth: 420, textAlign: 'right' }}>{previewHint}</span>
          </div>
        )}
      </div>

      </EditLock>

      {!d.isNew && d.visibility && !deleted && (
        <section style={{ ...panel, padding: '16px 24px', flexDirection: 'row', flexWrap: 'wrap', gap: 24, alignItems: 'center' }} aria-label="Sharing">
          <VisibilityBadge visibility={d.visibility} />
          {d.ownerId === me || me === undefined ? (
            <ShareToggle table="quiz_sets" id={d.id} visibility={d.visibility}
              onChanged={(v) => { setD((x) => (x ? { ...x, visibility: v } : x)); setSaved((x) => (x ? { ...x, visibility: v } : x)); }} />
          ) : (
            <span style={{ fontSize: 14, color: '#7A6458' }}>Shared by another family. You can look but not change it.</span>
          )}
        </section>
      )}

      <EditLock locked={locked}>
      {deleted && (
        <section style={{ ...panel, padding: '56px 28px', alignItems: 'center', gap: 14, textAlign: 'center' }}>
          <span style={{ width: 64, height: 64, borderRadius: 32, background: '#E3EEDD', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3F6B48" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
          </span>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Quiz set deleted</h2>
          <p style={{ margin: 0, color: '#6E5A4E', fontSize: 15 }}>It no longer appears on the front page.</p>
          <Link href="/admin/sets" style={{ marginTop: 8, height: 44, padding: '0 22px', borderRadius: 12, background: '#5A4038', color: '#fff', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center' }}>Back to quiz sets</Link>
        </section>
      )}

      {!deleted && (
        <>
          <section style={{ ...panel, padding: '26px 28px', flexDirection: 'row', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label htmlFor="sn" style={{ fontSize: 14, fontWeight: 700 }}>Set name</label>
                <input id="sn" className={s.in} type="text" value={d.name} placeholder="e.g. Animals" onChange={(e) => { edit({ name: e.target.value }); setNameError(false); }} style={{ ...inputStyle, borderColor: nameError ? '#A8484F' : '#E3D5C4' }} />
                {nameError && <span role="alert" style={{ fontSize: 13, fontWeight: 700, color: '#A8484F' }}>Give the set a name so you can find it later.</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label htmlFor="st" style={{ fontSize: 14, fontWeight: 700 }}>Sub-title <span style={{ fontWeight: 600, color: '#7A6458' }}>(optional)</span></label>
                <input id="st" className={s.in} type="text" value={d.subtitle} placeholder="e.g. Find the fruit" onChange={(e) => edit({ subtitle: e.target.value })} style={inputStyle} />
                <span style={{ fontSize: 13, color: '#7A6458' }}>Small line under the name on the front page. You decide the wording and language; leave it empty to show nothing.</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Heading color <span style={{ fontWeight: 600, color: '#7A6458' }}>· {colorLabel}</span></span>
                <div role="group" aria-label="Heading color" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, padding: 4 }}>
                  {(Object.keys(PRESETS) as PresetKey[]).map((k) => {
                    const on = presetKey === k;
                    return (
                      <button key={k} type="button" className={s.btn} aria-label={`Heading color ${PRESETS[k].label}`} aria-pressed={on} onClick={() => { edit({ color: PRESETS[k].text }); setHexText(null); }} style={{ width: 40, height: 40, borderRadius: 20, border: '3px solid #fff', background: PRESETS[k].text, boxShadow: `0 0 0 ${on ? '3px #4A3830' : '1.5px #E3D5C4'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                        {on && <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: 4 }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 46, height: 46, borderRadius: 23, background: 'conic-gradient(#E59AA1, #EED79A, #9CC3A4, #8FB3D1, #B9A3CC, #E59AA1)', boxShadow: presetKey === 'custom' ? '0 0 0 3px #fff, 0 0 0 5px #4A3830' : '0 0 0 1.5px #E3D5C4' }}>
                    <input type="color" className={s.cp} aria-label="Pick a custom heading color" value={d.color.toLowerCase()} onChange={(e) => { edit({ color: e.target.value }); setHexText(null); }} />
                  </span>
                  <label htmlFor="hx" style={{ fontSize: 14, fontWeight: 700 }}>Custom</label>
                  <input id="hx" className={s.in} type="text" maxLength={7} placeholder="#B8737B" aria-label="Custom color hex code" value={hexText ?? d.color.toUpperCase()} onChange={(e) => { const v = e.target.value; setHexText(v); if (/^#[0-9a-fA-F]{6}$/.test(v)) edit({ color: v.toLowerCase() }); }} style={{ width: 110, height: 40, border: '1.5px solid #E3D5C4', borderRadius: 10, padding: '0 12px', fontSize: 15, fontFamily: 'Nunito, sans-serif', background: '#FFFDF9', color: '#4A3830', textTransform: 'uppercase' }} />
                  {lowContrast && <span role="status" style={{ fontSize: 13, fontWeight: 700, color: '#7A5410' }}>This color is light and may be hard to read on white.</span>}
                </div>
                <span style={{ fontSize: 13, color: '#7A6458' }}>Colors the name on the front page and tints the cover circle behind your picture. Pick one of the presets or choose any color.</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Cover picture</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 72, height: 72, borderRadius: 36, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...(d.cover ? { background: tintFor(d.color) } : { background: '#FFFDF9', border: '2px dashed #D9C6B2', boxSizing: 'border-box', color: '#A8968A' }) }}>
                    {d.cover ? <Img path={d.cover} w={44} h={44} /> : <PicIcon size={26} />}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{d.cover ? fileName(d.cover) : 'No picture yet'}</span>
                    <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <LibraryButton kind="image" label="set cover picture" onChoose={(path) => applyTarget({ kind: 'cover' }, path)} />
                      <div style={{ flexBasis: '100%' }}><SvgPaste label="set cover picture" onUse={(code) => applySvg({ kind: 'cover' }, code)} /></div>
                      {d.cover && <button type="button" className={s.ghost} onClick={() => edit({ cover: null })} style={ghostBtn}>Remove</button>}
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: 13, color: '#7A6458' }}>Square picture, at least 600×600 px. Shown inside a round frame on the front page.</span>
              </div>

              <CheckOption checked={d.published} onChange={() => edit({ published: !d.published })} title="Published" hint="Draft sets are hidden from the child, but you can still use “Preview as child” after saving." />

              <div style={{ paddingTop: 18, borderTop: '1px solid #F1E7DA', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <button type="button" className={s.btn} onClick={() => setImportOpen(true)} style={{ height: 42, padding: '0 16px', borderRadius: 10, border: 'none', background: '#3F73B5', color: '#fff', fontWeight: 700, fontFamily: 'Nunito, sans-serif', fontSize: 14, cursor: 'pointer' }}>+ Quick import questions</button>
                {!d.isNew && <button type="button" className={s.danger} onClick={() => setConfirm({ type: 'set' })} style={{ ...dangerBtn, height: 42, padding: '0 16px' }}>Delete this quiz set</button>}
              </div>
            </div>

            <div style={{ flex: '0 0 300px', maxWidth: '100%', boxSizing: 'border-box', padding: '22px 20px 28px', borderRadius: 16, background: '#FBF4E9', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, margin: '0 auto' }}>
              <span style={{ alignSelf: 'flex-start', fontSize: 14, fontWeight: 700 }}>Front page preview</span>
              <div style={{ width: 240, height: 350 }}>
                <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 480, height: 700 }}>
                  <SetCard hintEmptyCover set={{ id: d.id, title: d.name.trim() || 'Set name', subtitle: d.subtitle.trim() || null, heading_color: cardTitleColor, cover_path: d.cover, count: completeCount }} />
                </div>
              </div>
              <span style={{ fontSize: 12, color: '#7A6458', textAlign: 'center' }}>Updates as you type. Draft sets are hidden from the child.</span>
            </div>
          </section>

          <QuestionPanel
            d={d} cur={cur} q={q}
            onSelect={setCur}
            onAdd={() => { setD({ ...d, qs: [...d.qs, newQuestion()] }); setCur(d.qs.length); }}
            onMove={move}
            onEdit={(patch) => editQ(cur, patch)}
            onAskDelete={() => setConfirm({ type: 'q', i: cur })}
            onChooseLibrary={(kind, path) => applyTarget(kind, path)}
           
            onSvg={(kind, code) => applySvg(kind, code)}
            onPlay={playVoice}
          />
        </>
      )}

      {importOpen && (
        <ImportDialog
          onCancel={() => setImportOpen(false)}
          onImport={(imported) => {
            const qs = materializeSvg(imported); // SVG code becomes one pending file per distinct drawing
            setD({ ...d, qs: [...d.qs, ...qs] });
            setCur(d.qs.length);
            setImportOpen(false);
            say(`Imported ${qs.length} ${qs.length === 1 ? 'question' : 'questions'}. Review them, then press Save.`);
          }}
        />
      )}
      {confirm && <ConfirmDialog title={confirmTitle} body={confirmBody} button={confirmButton} busy={busy} onCancel={() => setConfirm(null)} onConfirm={confirmDelete} />}
      </EditLock>
      <Toast toast={toast} onClose={closeToast} />
    </Shell>
  );
}
