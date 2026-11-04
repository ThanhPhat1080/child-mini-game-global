'use client';

import { ContentTabs } from '@/components/admin/ContentTabs';
import { GlobalContent } from '@/components/admin/GlobalContent';
import { useContentScope } from '@/lib/review';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deleteGroups, duplicateWords, isCardComplete, loadCards, loadGroups, newCard, newGroup, pruneDeletedGroups, saveCards, saveGroups, validateGroupName,
  type ECard, type EGroup,
} from '@/lib/memory/adminCards';
import { sortHealth, weakGroups } from '@/lib/sort/groups';
import { LEVELS, pairsOf } from '@/lib/memory/deck';
import { sayWord } from '@/lib/memory/cards';
import { clearPending, svgToPending } from '@/lib/media';
import { useMediaRenamed } from '@/lib/media/renames';
import { replacePath } from '@/lib/mediaPaths';
import { checkSvg } from '@/lib/quizImport';
import { CardImportDialog } from '@/components/admin/CardImportDialog';
import { Toast, useToast } from '@/components/admin/Toast';
import { CardsHeaderActions } from '@/components/admin/CardsHeaderActions';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { GroupsPanel } from '@/components/admin/GroupsPanel';
import { CardPanel, poolHealth } from '@/components/admin/CardPanel';
import s from '@/components/admin/admin-ui.module.css';
import type { Visibility } from '@/lib/review';

/** The database refuses a second group with the same name (unique index on lower(btrim(name))). */
const groupSaveError = (e: string) => (/duplicate|23505/i.test(e) ? 'A group with that name already exists.' : e);

/** Memory Match card pool (A11) with pool health (A13) and Sort It groups (A17, A18). Nothing is uploaded or written until Save (T15). */
export default function CardsPage() {
  const { scope, setScope } = useContentScope();
  const [saved, setSaved] = useState<ECard[] | null>(null);
  const [draft, setDraft] = useState<ECard[] | null>(null);
  const [savedGroups, setSavedGroups] = useState<EGroup[] | null>(null);
  const [draftGroups, setDraftGroups] = useState<EGroup[] | null>(null);
  const [msgs, setMsgs] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast, show: showToast, close: closeToast } = useToast();
  // a file renamed in the library: edits not saved yet follow it
  useMediaRenamed(useCallback((from: string, to: string) => {
    setSaved((v) => replacePath(v, from, to)); setDraft((v) => replacePath(v, from, to));
  }, []));
  const [importOpen, setImportOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);

  /** Loads cards and groups as the saved copies; `keepDraftGroups` leaves the group edits in place. */
  const load = useCallback(async (keepDraftGroups = false) => {
    try {
      const [fresh, groups] = await Promise.all([loadCards(), loadGroups()]);
      setSaved(fresh); setDraft(fresh);
      setSavedGroups(groups);
      if (!keepDraftGroups) setDraftGroups(groups);
      return true;
    } catch (e) { setError((e as Error).message); return false; }
  }, []);
  useEffect(() => { void load(); }, [load]);
  // picked files live in memory until Save (T15); free their previews when leaving
  useEffect(() => () => clearPending(), []);

  const dirty = useMemo(
    () => (draft && saved && draftGroups && savedGroups ? JSON.stringify([draft, draftGroups]) !== JSON.stringify([saved, savedGroups]) : false),
    [draft, saved, draftGroups, savedGroups],
  );
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  if (!draft || !saved || !draftGroups || !savedGroups) {
    return (
      <>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>Memory cards</h1>
        {error ? <p role="alert" style={{ margin: 0, color: '#A8484F', fontWeight: 700 }}>{error}</p> : <p style={{ color: '#7A6458' }}>Loading…</p>}
      </>
    );
  }

  const incomplete = draft.filter((c) => !isCardComplete(c)).length;
  const canSave = dirty && incomplete === 0 && !busy;
  const dups = duplicateWords(draft);
  const active = draft.filter((c) => c.active).length;
  // ECard.groupId is camelCase, the Sort It helpers read group_id
  const groupCards = draft.map((c) => ({ word: c.word, group_id: c.groupId, active: c.active }));
  const weak = weakGroups(groupCards);
  const usage = new Map<string, number>();
  for (const c of draft) if (c.groupId) usage.set(c.groupId, (usage.get(c.groupId) ?? 0) + 1);

  const touch = () => { closeToast(); setError(null); };
  const setVisibility = (id: string, v: Visibility) => {
    const f = <T extends { id: string }>(xs: T[] | null) => (xs ? xs.map((x) => (x.id === id ? { ...x, visibility: v } : x)) : xs);
    setSaved(f); setDraft(f);
  };
  const edit = (id: string, patch: Partial<ECard>) => { touch(); setDraft(draft.map((c) => (c.id === id ? { ...c, ...patch } : c))); };
  const say = (id: string, text: string | null) => setMsgs((m) => { const n = { ...m }; if (text) n[id] = text; else delete n[id]; return n; });

  /** A library file is already in the bucket: the card just points at it (A24). */
  function chooseLibrary(id: string, kind: 'image' | 'audio', path: string) {
    say(id, null);
    edit(id, { [kind]: path });
  }


  function applySvg(id: string, code: string) {
    // same rules as the Quiz import: no scripts, handlers, embeds or outside links; valid XML; normalized text
    const r = checkSvg(code);
    if ('error' in r) return say(id, `${r.error}.`);
    say(id, null);
    edit(id, { image: svgToPending(r.svg) }); // identical drawings share one pending file
  }

  function addGroup(name: string): string | null {
    const err = validateGroupName(name, draftGroups!);
    if (err) return err;
    touch();
    setDraftGroups([...draftGroups!, newGroup(name.trim())]);
    return null;
  }

  function renameGroup(id: string, name: string): string | null {
    const err = validateGroupName(name, draftGroups!, id);
    if (err) return err;
    const n = name.trim();
    if (draftGroups!.find((g) => g.id === id)?.name === n) return null;
    touch();
    setDraftGroups(draftGroups!.map((g) => (g.id === id ? { ...g, name: n } : g)));
    return null;
  }

  function removeGroup(id: string) {
    const rest = draftGroups!.filter((g) => g.id !== id);
    touch();
    setDraftGroups(rest);
    setDraft(pruneDeletedGroups(draft!, rest)); // its cards have no group from now on
  }

  function add() {
    const c = newCard();
    touch();
    setDraft([c, ...draft!]);
    setFocusId(c.id);
  }

  function importCards(imported: ECard[]) {
    // SVG code becomes one pending file per distinct drawing; blank pictures stay incomplete until picked
    const added = imported.map((c) => ({ ...c, image: c.image?.startsWith('<') ? svgToPending(c.image) : c.image }));
    touch();
    setDraft([...added, ...draft!]);
    setImportOpen(false);
  }

  function revert() {
    clearPending(); // nothing was uploaded, so there is nothing to delete
    setDraft(saved); setDraftGroups(savedGroups); setMsgs({}); touch();
  }

  /** Groups first (cards may point to new ones), then cards, then the removed groups. Any failure stops there. */
  async function doSave() {
    if (!draft || !saved || !draftGroups || !savedGroups || !canSave) return;
    setBusy(true); touch();
    const g = await saveGroups(savedGroups, draftGroups);
    if (g.error) { showToast('error', groupSaveError(g.error)); setBusy(false); return; }
    const r = await saveCards(saved, pruneDeletedGroups(draft, draftGroups));
    if (r.error) { showToast('error', r.error); setBusy(false); return; }
    const keep = new Set(draftGroups.map((x) => x.id));
    const gone = savedGroups.map((x) => x.id).filter((id) => !keep.has(id));
    if (gone.length) {
      const d = await deleteGroups(gone);
      if (d.error) {
        // the cards are saved (their files uploaded): take them as saved, keep the group edits so Save can retry the delete
        if (await load(true)) { clearPending(); setMsgs({}); }
        showToast('error', d.error); setBusy(false); return;
      }
    }
    if (await load()) { clearPending(); setMsgs({}); showToast(r.warning ? 'warning' : 'success', r.warning ?? 'Saved'); }
    setBusy(false);
  }

  const doomed = confirm !== null ? draft[confirm] : null;
  let status = 'All changes saved.';
  if (busy) status = 'Saving…';
  else if (incomplete) status = `${incomplete} ${incomplete === 1 ? 'card needs' : 'cards need'} a picture and a word before you can save.`;
  else if (dirty) status = 'Unsaved changes. Press Save to keep them.';

  if (scope === 'global') {
    return (
      <>
        <ContentTabs scope={scope} onChange={setScope} />
        <GlobalContent table="memory_cards" />
      </>
    );
  }

  return (
    <>
      <ContentTabs scope={scope} onChange={setScope} />
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#FBF4E9', padding: '12px 0', margin: '-12px 0', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, boxShadow: '0 8px 8px -8px rgba(90,64,56,0.18)' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>Memory cards</h1>
          <p style={{ margin: '6px 0 0', color: '#7A6458', fontSize: 15 }}>Pictures and words for the Memory Match game. Turn a card off to keep it out of the game.</p>
        </div>
        <div style={{ flex: '0 0 auto', maxWidth: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <CardsHeaderActions dirty={dirty} busy={busy} canSave={canSave} onImport={() => setImportOpen(true)} onRevert={revert} onSave={doSave} />
          <span role="status" style={{ fontSize: 13, color: '#7A6458', maxWidth: 420, textAlign: 'right' }}>{status}</span>
        </div>
      </div>

      {error && <p role="alert" style={{ margin: 0, color: '#A8484F', fontWeight: 700, fontSize: 14 }}>{error}</p>}

      <section style={{ background: '#fff', borderRadius: 18, padding: '18px 22px', boxShadow: '0 1px 0 #EADCC8', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Levels</h2>
        <p data-testid="pool-health" style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{poolHealth(active)}</p>
        <p data-testid="sort-health" style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{sortHealth(groupCards)}</p>
        <p style={{ margin: 0, fontSize: 13, color: '#7A6458' }}>
          Each level needs {LEVELS.map((l) => pairsOf(l)).join(' / ')} active cards ({LEVELS.join(' / ')} cards on the table).{dirty ? ' Counts include unsaved changes.' : ''}
        </p>
      </section>

      <GroupsPanel groups={draftGroups} usage={usage} onAdd={addGroup} onRename={renameGroup} onDelete={removeGroup} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16 }}>
        {draft.map((c, i) => (
          <CardPanel
            key={c.id} c={c} n={i + 1} autoFocus={c.id === focusId} groups={draftGroups} weakGroup={!!c.groupId && weak.has(c.groupId)}
            duplicate={dups.has(c.word.trim().toLowerCase())} message={msgs[c.id] ?? null}
            onEdit={(patch) => edit(c.id, patch)}
            onChooseLibrary={(kind, path) => chooseLibrary(c.id, kind, path)}
            onSvg={(code) => applySvg(c.id, code)}
            onPlay={() => sayWord({ word: c.word.trim(), audio_path: c.audio })}
            onAskDelete={() => setConfirm(i)}
            onVisibility={(v) => setVisibility(c.id, v)}
          />
        ))}
        <button type="button" onClick={add} className={`${s.btn} ${s.dash}`} style={{ minHeight: 200, borderRadius: 18, border: '2px dashed #D9C6B2', background: 'transparent', color: '#5A4038', fontSize: 16, fontWeight: 700, fontFamily: 'Nunito, sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Add card
        </button>
      </div>

      {importOpen && <CardImportDialog groups={draftGroups} onCancel={() => setImportOpen(false)} onImport={importCards} />}

      {doomed && (
        <ConfirmDialog
          title={`Delete “${doomed.word.trim() || `card ${confirm! + 1}`}”?`}
          body="The card will be removed when you save, and its picture and sound files are freed then. Revert brings it back until you save."
          button="Delete card"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { touch(); setDraft(draft.filter((_, k) => k !== confirm)); say(doomed.id, null); setConfirm(null); }}
        />
      )}
      <Toast toast={toast} onClose={closeToast} />
    </>
  );
}
