'use client';

import { ContentTabs } from '@/components/admin/ContentTabs';
import { GlobalContent } from '@/components/admin/GlobalContent';
import { useContentScope } from '@/lib/review';
import type { Visibility } from '@/lib/review';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { isLevelComplete, loadFindLevels, newFindLevel, saveFindLevels, type ELevel } from '@/lib/find/adminLevels';
import { clearPending, svgToPending } from '@/lib/media';
import { checkSvg } from '@/lib/quizImport';
import { Toast, useToast } from '@/components/admin/Toast';
import { useMediaRenamed } from '@/lib/media/renames';
import { replacePath } from '@/lib/mediaPaths';
import { CardsHeaderActions } from '@/components/admin/CardsHeaderActions';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { SortToggle, displayOrder } from '@/components/admin/LevelSort';
import { FindLevelPanel } from '@/components/admin/FindLevelPanel';

/** Find It level builder (A20-A22). Nothing is uploaded or written until Save. */
export default function FindPage() {
  const { scope, setScope } = useContentScope();
  const [saved, setSaved] = useState<ELevel[] | null>(null);
  const [draft, setDraft] = useState<ELevel[] | null>(null);
  const [msgs, setMsgs] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<number | null>(null);
  /** Display order: newest (last created) first by default. A level's number does not change with it. */
  const [desc, setDesc] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast, show: showToast, close: closeToast } = useToast();
  // a file renamed in the library: edits not saved yet follow it
  useMediaRenamed(useCallback((from: string, to: string) => {
    setSaved((v) => replacePath(v, from, to)); setDraft((v) => replacePath(v, from, to));
  }, []));

  const load = useCallback(async () => {
    try {
      const fresh = await loadFindLevels();
      setSaved(fresh); setDraft(fresh);
      return true;
    } catch (e) { setError((e as Error).message); return false; }
  }, []);
  useEffect(() => { void load(); }, [load]);
  // picked files live in memory until Save; free their previews when leaving
  useEffect(() => () => clearPending(), []);

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
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>Find It</h1>
        {error ? <p role="alert" style={{ margin: 0, color: '#A8484F', fontWeight: 700 }}>{error}</p> : <p style={{ color: '#7A6458' }}>Loading…</p>}
      </>
    );
  }

  const incomplete = draft.filter((l) => !isLevelComplete(l)).length;
  const canSave = dirty && incomplete === 0 && !busy;

  const touch = () => { closeToast(); setError(null); };
  const setVisibility = (id: string, v: Visibility) => {
    const f = <T extends { id: string }>(xs: T[] | null) => (xs ? xs.map((x) => (x.id === id ? { ...x, visibility: v } : x)) : xs);
    setSaved(f); setDraft(f);
  };
  const edit = (id: string, patch: Partial<ELevel>) => { touch(); setDraft(draft.map((l) => (l.id === id ? { ...l, ...patch } : l))); };
  const say = (id: string, text: string | null) => setMsgs((m) => { const n = { ...m }; if (text) n[id] = text; else delete n[id]; return n; });


  function applySvg(id: string, code: string) {
    const r = checkSvg(code); // same rules as the Quiz import
    if ('error' in r) return say(id, `${r.error}.`);
    say(id, null);
    edit(id, { image: svgToPending(r.svg) });
  }


  function add() { touch(); setDraft([...draft!, newFindLevel()]); }

  function revert() {
    clearPending(); // nothing was uploaded, so there is nothing to delete
    setDraft(saved); setMsgs({}); touch();
  }

  async function doSave() {
    if (!draft || !saved || !canSave) return;
    setBusy(true); touch();
    const r = await saveFindLevels(saved, draft);
    if (r.error) { showToast('error', r.error); setBusy(false); return; }
    if (await load()) { clearPending(); setMsgs({}); showToast(r.warning ? 'warning' : 'success', r.warning ?? 'Saved'); }
    setBusy(false);
  }

  const doomed = confirm !== null ? draft[confirm] : null;
  let status = 'All changes saved.';
  if (busy) status = 'Saving…';
  else if (incomplete) status = `${incomplete} ${incomplete === 1 ? 'level needs' : 'levels need'} a picture, 2 to 12 objects and a word for each`;
  else if (dirty) status = 'Unsaved changes. Press Save to keep them.';

  if (scope === 'global') {
    return (
      <>
        <ContentTabs scope={scope} onChange={setScope} />
        <GlobalContent table="find_levels" />
      </>
    );
  }

  return (
    <>
      <ContentTabs scope={scope} onChange={setScope} />
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#FBF4E9', padding: '12px 0', margin: '-12px 0', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, boxShadow: '0 8px 8px -8px rgba(90,64,56,0.18)' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>Find It</h1>
          <p style={{ margin: '6px 0 0', color: '#7A6458', fontSize: 15 }}>One picture and 2 to 12 objects per level. Turn a level off to keep it as a draft; you can still preview it as the child.</p>
        </div>
        <div style={{ flex: '0 0 auto', maxWidth: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <CardsHeaderActions dirty={dirty} busy={busy} canSave={canSave} onAdd={add} onRevert={revert} onSave={doSave} />
          <span role="status" style={{ fontSize: 13, color: '#7A6458', maxWidth: 420, textAlign: 'right' }}>{status}</span>
        </div>
      </div>

      {error && <p role="alert" style={{ margin: 0, color: '#A8484F', fontWeight: 700, fontSize: 14 }}>{error}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SortToggle desc={desc} onToggle={() => setDesc(!desc)} />
        {displayOrder(draft, desc).map(({ level: l, i }) => (
          <FindLevelPanel
            key={l.id} l={l} n={i + 1} message={msgs[l.id] ?? null}
            onEdit={(patch) => edit(l.id, patch)}
            onSvg={(code) => applySvg(l.id, code)}
            onAskDelete={() => setConfirm(i)}
            onVisibility={(v) => setVisibility(l.id, v)}
          />
        ))}
      </div>

      {doomed && (
        <ConfirmDialog
          title={`Delete level ${confirm! + 1}?`}
          body="The level will be removed when you save, and its picture files are freed then. Revert brings it back until you save."
          button="Delete level"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { touch(); setDraft(draft.filter((_, k) => k !== confirm)); say(doomed.id, null); setConfirm(null); }}
        />
      )}
      <Toast toast={toast} onClose={closeToast} />
    </>
  );
}
