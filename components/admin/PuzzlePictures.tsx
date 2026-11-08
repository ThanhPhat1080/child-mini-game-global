'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { duplicateWords, isPictureComplete, loadPictures, newPicture, readyCount, savePictures, type EPicture } from '@/lib/pairs/adminPictures';
import { sayWord } from '@/lib/memory/cards';
import { mediaUrl } from '@/lib/media';
import { useMediaRenamed } from '@/lib/media/renames';
import { replacePath } from '@/lib/mediaPaths';
import { Pic } from '@/components/Pic';
import { LibraryButton } from './LibraryButton';
import { MediaLibraryDialog } from './MediaLibraryDialog';
import { PlayButton } from './PlayButton';
import { RevertButton, SaveButton } from './SaveButtons';
import { Toast, useToast } from './Toast';
import { PicIcon, dangerBtn, fileName, ghostBtn, inputStyle, panel } from './editor-parts';
import s from './admin-ui.module.css';
import { AdminLoading } from '@/components/admin/AdminLoading';

const WORD_MAX = 40;
/** The game needs this many pictures with different words (A33). */
const READY_AT = 4;
const font = 'Nunito, sans-serif';
const hint = { fontSize: 12, color: '#7A6458' } as const;
const small = { ...ghostBtn, height: 34, padding: '0 12px', fontSize: 13 } as const;

/** Chip colours: green when the game can run, rose when it cannot (A33). */
const chipStyle = (ready: boolean) => ({
  display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 14px', borderRadius: 999, fontSize: 14, fontWeight: 700, fontFamily: font,
  color: ready ? '#2F6B3C' : '#A8484F', background: ready ? '#E8F3E4' : '#FBEDEE', border: `1.5px solid ${ready ? '#2F6B3C' : '#A8484F'}`,
}) as const;

/** The On switch: a pill with a knob, role switch with aria-checked. */
function OnSwitch({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} className={s.btn}
      style={{ position: 'relative', width: 46, height: 26, borderRadius: 13, border: 'none', padding: 0, cursor: 'pointer', background: on ? '#3F6B48' : '#CDBBA8', transition: 'background 0.2s ease' }}>
      <span aria-hidden="true" style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: 10, background: '#fff', transition: 'left 0.2s ease' }} />
    </button>
  );
}

/** One row of the picture table: picture, word, sound, On and Remove. Edits go up through the callbacks. */
function PictureRow({ p, n, duplicate, autoFocus, onEdit, onRemove }: {
  p: EPicture; n: number; duplicate: boolean; autoFocus: boolean;
  onEdit: (patch: Partial<EPicture>) => void; onRemove: () => void;
}) {
  const len = p.word.trim().length;
  const img = mediaUrl(p.image);
  return (
    <tr style={{ borderTop: '1px solid #F1E7DA', opacity: p.active ? 1 : 0.7 }}>
      <td style={{ padding: '12px 10px 12px 0', width: 96 }}>
        <div style={{ width: 80, height: 80, borderRadius: 14, background: '#FBF4E9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', color: '#A8968A' }}>
          {img ? <Pic src={img} alt="" draggable={false} style={{ width: 68, height: 68, objectFit: 'contain' }} /> : <PicIcon size={28} />}
        </div>
      </td>
      <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>
        <input type="text" className={s.in} aria-label={`Word for picture ${n}`} autoFocus={autoFocus} maxLength={WORD_MAX} value={p.word} placeholder="e.g. fish"
          onChange={(e) => onEdit({ word: e.target.value })} style={{ ...inputStyle, height: 40, width: '100%', minWidth: 160, boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
          {!len && <span style={{ fontSize: 13, color: '#7A5410' }}>Needs a word before you can save.</span>}
          {duplicate && <span role="status" style={{ fontSize: 13, fontWeight: 700, color: '#7A5410' }}>Another picture has the same word.</span>}
        </div>
      </td>
      <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{p.audio ? fileName(p.audio) : 'Kid voice reads the word'}</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <PlayButton playing={false} size={36} label={`Play picture ${n}`} disabled={!len && !p.audio} onClick={() => sayWord({ word: p.word.trim(), audio_path: p.audio })} />
            <LibraryButton kind="audio" label={`picture ${n} sound`} onChoose={(path) => onEdit({ audio: path })} />
            {p.audio && <button type="button" className={`${s.btn} ${s.ghost}`} style={small} onClick={() => onEdit({ audio: null })}>Remove sound</button>}
          </div>
        </div>
      </td>
      <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>
        <OnSwitch on={p.active} label={`Use picture ${n}`} onClick={() => onEdit({ active: !p.active })} />
      </td>
      <td style={{ padding: '12px 0 12px 10px', verticalAlign: 'top', textAlign: 'right' }}>
        <button type="button" className={`${s.btn} ${s.danger}`} aria-label={`Remove picture ${n}`} onClick={onRemove} style={{ ...dangerBtn, height: 36 }}>Remove</button>
      </td>
    </tr>
  );
}

/**
 * Super Admin: the pictures the Puzzle Pairs game may cut into halves (A32, A33). Every change is a draft until Save,
 * like the Cards page. Pictures come from the Image Library; each has an English word and an optional sound.
 */
export function PuzzlePictures() {
  const [saved, setSaved] = useState<EPicture[] | null>(null);
  const [draft, setDraft] = useState<EPicture[] | null>(null);
  const [libOpen, setLibOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast, show, close } = useToast();

  const load = useCallback(async () => {
    try {
      const fresh = await loadPictures();
      setSaved(fresh); setDraft(fresh);
      return true;
    } catch (e) { setError((e as Error).message); return false; }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // a library file renamed while this page is open: the rows that point at it follow the new name
  useMediaRenamed(useCallback((from: string, to: string) => {
    setSaved((v) => replacePath(v, from, to)); setDraft((v) => replacePath(v, from, to));
  }, []));

  const dirty = useMemo(() => (draft && saved ? JSON.stringify(draft) !== JSON.stringify(saved) : false), [draft, saved]);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  if (!draft || !saved) {
    return (
      <>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>Puzzle Pairs pictures</h1>
        {error ? <p role="alert" style={{ margin: 0, color: '#A8484F', fontWeight: 700 }}>{error}</p> : <AdminLoading />}
      </>
    );
  }

  const incomplete = draft.filter((p) => !isPictureComplete(p)).length;
  const canSave = dirty && incomplete === 0 && !busy;
  const dups = duplicateWords(draft);
  const on = draft.filter((p) => p.active).length;
  const ready = readyCount(draft) >= READY_AT;

  const touch = () => { close(); setError(null); };
  const edit = (id: string, patch: Partial<EPicture>) => { touch(); setDraft((d) => d && d.map((p) => (p.id === id ? { ...p, ...patch } : p))); };
  const remove = (id: string) => { touch(); setDraft((d) => d && d.filter((p) => p.id !== id)); };

  /** One library pick adds one row at the end, with an empty word; Save waits until the word is typed. */
  function addPicture(path: string) {
    const p = newPicture(path);
    touch();
    setDraft((d) => (d ? [...d, p] : d));
    setFocusId(p.id);
  }

  function revert() { setDraft(saved); touch(); }

  /**
   * After a failed save: reads the database back as the saved copy, and marks every draft row that is now in the database
   * as not new (so a retry does not insert it again). The draft keeps its edits. If the read fails, nothing changes.
   */
  async function syncAfterFailure() {
    try {
      const fresh = await loadPictures();
      const inDb = new Set(fresh.map((p) => p.id));
      setSaved(fresh);
      setDraft((d) => d && d.map((p) => (inDb.has(p.id) ? { ...p, isNew: false } : p)));
    } catch { /* the read failed too: keep the state as it was */ }
  }

  async function doSave() {
    if (!draft || !saved || !canSave) return;
    setBusy(true); touch();
    const r = await savePictures(saved, draft);
    if (r.error) {
      // A part-way failure may already have written some rows: the database becomes the saved copy, so a retry and Discard start from it.
      await syncAfterFailure();
      show('error', r.error);
      setBusy(false);
      return;
    }
    // The database has the draft now: it becomes the saved copy (no row is new any more), then the list is read back.
    const settled = draft.map((p) => ({ ...p, isNew: false }));
    setSaved(settled); setDraft(settled);
    await load();
    setBusy(false);
    show('success', 'Saved.');
  }

  let status = 'All changes saved.';
  if (busy) status = 'Saving…';
  else if (incomplete) status = `${incomplete} ${incomplete === 1 ? 'picture needs' : 'pictures need'} a word before you can save.`;
  else if (dirty) status = 'Unsaved changes. Press Save to keep them.';

  return (
    <>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#FBF4E9', padding: '12px 0', margin: '-12px 0', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, minHeight: 112, boxSizing: 'border-box' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>Puzzle Pairs pictures</h1>
          <p style={{ margin: '6px 0 0', color: '#7A6458', fontSize: 15 }}>Pictures the Puzzle Pairs game may cut into halves. The game needs at least 4 on with different words.</p>
        </div>
        <div style={{ flex: '0 0 auto', maxWidth: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
            <button type="button" onClick={() => setLibOpen(true)} disabled={busy} className={s.btn}
              style={{ height: 44, padding: '0 20px', borderRadius: 12, border: 'none', background: '#3F73B5', color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: font, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
              Add from Image Library
            </button>
            <RevertButton saving={busy} dirty={dirty} onClick={revert} />
            <SaveButton saving={busy} enabled={canSave} onClick={doSave} />
          </div>
          <span style={{ fontSize: 13, color: '#7A6458', maxWidth: 420, textAlign: 'right' }}>{status}</span>
        </div>
      </div>

      <section style={{ ...panel, gap: 12, padding: '18px 22px' }}>
        <div>
          <span role="status" style={chipStyle(ready)}>{ready ? `${on} on · ready` : `${on} on · needs at least ${READY_AT}`}</span>
        </div>
        {error && <p role="alert" style={{ margin: 0, color: '#A8484F', fontWeight: 700, fontSize: 14 }}>{error}</p>}
        {draft.length === 0 ? (
          <p style={{ margin: 0, color: '#7A6458' }}>No pictures yet. Add pictures from the Image Library.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: 13, color: '#7A6458' }}>
                <th scope="col" style={{ padding: '6px 10px 6px 0', fontWeight: 700 }}>Picture</th>
                <th scope="col" style={{ padding: '6px 10px', fontWeight: 700 }}>English word</th>
                <th scope="col" style={{ padding: '6px 10px', fontWeight: 700 }}>Sound</th>
                <th scope="col" style={{ padding: '6px 10px', fontWeight: 700 }}>On</th>
                <th scope="col" style={{ padding: '6px 0 6px 10px' }}><span className={s.srOnly}>Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {draft.map((p, i) => (
                <PictureRow
                  key={p.id} p={p} n={i + 1} autoFocus={p.id === focusId} duplicate={dups.has(p.word.trim().toLowerCase())}
                  onEdit={(patch) => edit(p.id, patch)} onRemove={() => remove(p.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>

      {libOpen && <MediaLibraryDialog kind="image" onChoose={addPicture} onClose={() => setLibOpen(false)} />}
      <Toast toast={toast} onClose={close} />
    </>
  );
}
