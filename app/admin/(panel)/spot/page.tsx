'use client';

import { ContentTabs } from '@/components/admin/ContentTabs';
import { GlobalContent } from '@/components/admin/GlobalContent';
import { useContentScope, useMyRole } from '@/lib/review';
import { ReviewQueue } from '@/components/admin/ReviewQueue';
import { usePendingCounts } from '@/lib/superAdmin';
import type { ContentTable, Visibility } from '@/lib/review';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isLevelComplete, loadLevels, newLevel, saveLevels, type ELevel } from '@/lib/spot/adminLevels';
import { aspectsClose } from '@/lib/spot/validate';
import type { Crop } from '@/lib/crop/geometry';
import { naturalSize } from '@/lib/spot/imageSize';
import { clearPending, mediaUrl, svgToPending } from '@/lib/media';
import { checkSvg } from '@/lib/quizImport';
import { Toast, useToast } from '@/components/admin/Toast';
import { useMediaRenamed } from '@/lib/media/renames';
import { replacePath } from '@/lib/mediaPaths';
import { CardsHeaderActions } from '@/components/admin/CardsHeaderActions';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { SortToggle, displayOrder } from '@/components/admin/LevelSort';
import { SpotLevelPanel } from '@/components/admin/SpotLevelPanel';

const SPOT_TABLES: ContentTable[] = ['spot_levels'];

/** Spot the Differences level builder (A14-A16). Nothing is uploaded or written until Save. */
export default function SpotPage() {
  const role = useMyRole();
  const { scope, setScope } = useContentScope(role);
  const pending = usePendingCounts(role).spot;
  const [saved, setSaved] = useState<ELevel[] | null>(null);
  const [draft, setDraft] = useState<ELevel[] | null>(null);
  const [msgs, setMsgs] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<number | null>(null);
  /** Picture A's crop per level, kept while editing: picture B starts from it (A25). Cleared on Save and Revert. */
  const [aCrops, setACrops] = useState<Record<string, Crop>>({});
  /** Display order: newest (last created) first by default. A level's number does not change with it. */
  const [desc, setDesc] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast, show: showToast, close: closeToast } = useToast();
  // a file renamed in the library: edits not saved yet follow it
  useMediaRenamed(useCallback((from: string, to: string) => {
    setSaved((v) => replacePath(v, from, to)); setDraft((v) => replacePath(v, from, to));
  }, []));
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const asked = useRef(new Set<string>());

  const load = useCallback(async () => {
    try {
      const fresh = await loadLevels();
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

  // read each picture's shape once, to warn when A and B differ (A14)
  const paths = useMemo(() => [...new Set((draft ?? []).flatMap((l) => [l.a, l.b]).filter((p): p is string => !!p))], [draft]);
  useEffect(() => {
    for (const p of paths) {
      if (asked.current.has(p)) continue;
      asked.current.add(p);
      const url = mediaUrl(p);
      if (url) void naturalSize(url).then((sz) => { if (sz) setRatios((r) => ({ ...r, [p]: sz.w / sz.h })); });
    }
  }, [paths]);

  if (!draft || !saved) {
    return (
      <>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>Spot the Differences</h1>
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

  /** A picture already in the library: the level points at it, nothing uploaded (A24). */
  function chooseLibrary(id: string, side: 'a' | 'b', path: string) {
    say(id, null);
    edit(id, { [side]: path });
  }


  function applySvg(id: string, side: 'a' | 'b', code: string) {
    const r = checkSvg(code); // same rules as the Quiz import
    if ('error' in r) return say(id, `${r.error}.`);
    say(id, null);
    edit(id, { [side]: svgToPending(r.svg) });
  }

  function add() { touch(); setDraft([...draft!, newLevel()]); }

  function revert() {
    clearPending(); // nothing was uploaded, so there is nothing to delete
    setACrops({});
    setDraft(saved); setMsgs({}); touch();
  }

  async function doSave() {
    if (!draft || !saved || !canSave) return;
    setBusy(true); touch();
    const r = await saveLevels(saved, draft);
    if (r.error) { showToast('error', r.error); setBusy(false); return; }
    if (await load()) { clearPending(); setACrops({}); setMsgs({}); showToast(r.warning ? 'warning' : 'success', r.warning ?? 'Saved'); }
    setBusy(false);
  }

  const shapeOff = (l: ELevel) => {
    const a = l.a ? ratios[l.a] : null;
    const b = l.b ? ratios[l.b] : null;
    return !!a && !!b && !aspectsClose(a, b);
  };

  const doomed = confirm !== null ? draft[confirm] : null;
  let status = 'All changes saved.';
  if (busy) status = 'Saving…';
  else if (incomplete) status = `${incomplete} ${incomplete === 1 ? 'level needs' : 'levels need'} two pictures and 3 to 10 spots before you can save.`;
  else if (dirty) status = 'Unsaved changes. Press Save to keep them.';

  return (
    <>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#FBF4E9', padding: '12px 0', margin: '-12px 0', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, minHeight: 112, boxSizing: 'border-box' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>Spot the Differences</h1>
          <p style={{ margin: '6px 0 0', color: '#7A6458', fontSize: 15 }}>Two pictures and 3 to 10 spots per level. Turn a level off to keep it as a draft; you can still preview it as the child.</p>
        </div>
        {/* Always rendered so the header keeps its height; hidden (and not focusable) on the read-only Global tab. */}
        <div aria-hidden={scope !== 'mine'} style={{ flex: '0 0 auto', maxWidth: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, visibility: scope === 'mine' ? 'visible' : 'hidden' }}>
          <CardsHeaderActions dirty={dirty} busy={busy} canSave={canSave} onAdd={add} onRevert={revert} onSave={doSave} />
          <span role="status" style={{ fontSize: 13, color: '#7A6458', maxWidth: 420, textAlign: 'right' }}>{status}</span>
        </div>
      </div>

      <ContentTabs scope={scope} onChange={setScope} role={role} pending={pending} />
      {scope === 'queue' ? (
        <ReviewQueue tables={SPOT_TABLES} />
      ) : scope === 'parents' ? (
        <GlobalContent table="spot_levels" mode="parents" />
      ) : scope === 'global' ? (
        <GlobalContent table="spot_levels" />
      ) : (
        <>
          {error && <p role="alert" style={{ margin: 0, color: '#A8484F', fontWeight: 700, fontSize: 14 }}>{error}</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SortToggle desc={desc} onToggle={() => setDesc(!desc)} />
            {displayOrder(draft, desc).map(({ level: l, i }) => (
              <SpotLevelPanel
                key={l.id} l={l} n={i + 1} message={msgs[l.id] ?? null} shapeWarning={shapeOff(l)}
                startCrop={aCrops[l.id]}
                onCropped={(side, c) => { if (side === 'a') setACrops((m) => ({ ...m, [l.id]: c })); }}
                onEdit={(patch) => edit(l.id, patch)}
                onChooseLibrary={(side, path) => chooseLibrary(l.id, side, path)}
                onSvg={(side, code) => applySvg(l.id, side, code)}
                onAskDelete={() => setConfirm(i)}
                onVisibility={(v) => setVisibility(l.id, v)}
              />
            ))}
          </div>
        </>
      )}

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
