'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createChild, updateChild, validateChild, type Child, type NewChild } from '@/lib/children';
import { getChildSettings, updateChildSettings } from '@/lib/settings';
import { GENDER_THEME, type AgeBand, type Gender } from '@/lib/childTheme';
import { mediaUrl, removeMedia } from '@/lib/media';
import { useMediaRenamed } from '@/lib/media/renames';
import { replacePath } from '@/lib/mediaPaths';
import { LibraryButton } from '@/components/admin/LibraryButton';
import { PlayButton } from '@/components/admin/PlayButton';
import { ChildSounds } from '@/components/admin/ChildSounds';
import { Pic } from '@/components/Pic';
import s from './admin-ui.module.css';
import { ModalClose } from '@/components/ModalClose';

type Notice = (kind: 'success' | 'error' | 'warning', text: string) => void;
type Errors = Partial<Record<keyof NewChild, string>>;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const baseName = (p: string | null) => (p ? p.split('/').pop() ?? p : null);

/**
 * Add or edit one child (KU3-KU8). Not optimistic: Save waits for the request. The colors follow the Boy/Girl choice at once.
 * `onNotice` lets the page show a toast after the modal has closed (for example "sound not saved").
 * `parentId` is the Super Admin mode (N16): the child belongs to that parent, and only the non-media fields are shown and saved.
 * `compact` makes the dialog narrower; the Super Admin Children page uses it, since it has no pictures or sounds.
 */
export function ChildModal({ mode, child, parentId, compact, onClose, onSaved, onNotice }: {
  mode: 'create' | 'edit'; child?: Child; parentId?: string; compact?: boolean; onClose: () => void; onSaved: (c: Child) => void; onNotice?: Notice;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const [gender, setGender] = useState<Gender>(child?.gender ?? 'male');
  const [displayName, setDisplayName] = useState(child?.display_name ?? '');
  const [loginName, setLoginName] = useState('');
  const [pin, setPin] = useState(child?.pin ?? '');
  const [age, setAge] = useState<AgeBand>(child?.age_band ?? '2-5');
  const [savedAvatar, setSavedAvatar] = useState<string | null>(child?.avatar_path ?? null);
  const [avatarDraft, setAvatarDraft] = useState<string | null>(null);
  // the two "you did it" pictures (A and B)
  const [savedCelA, setSavedCelA] = useState<string | null>(child?.celebrate_a_path ?? null);
  const [celADraft, setCelADraft] = useState<string | null>(null);
  const [savedCelB, setSavedCelB] = useState<string | null>(child?.celebrate_b_path ?? null);
  const [celBDraft, setCelBDraft] = useState<string | null>(null);
  const [savedGreeting, setSavedGreeting] = useState<string | null>(null);
  const [greetingDraft, setGreetingDraft] = useState<string | null>(null);
  const [settingsReady, setSettingsReady] = useState(mode === 'create' || !!parentId);
  const [soundsFailed, setSoundsFailed] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const [playing, setPlaying] = useState(false);
  /** The child this modal just added: the modal stays open and becomes an edit of it, so the sounds can be added (N16). */
  const [created, setCreated] = useState<Child | null>(null);
  const moreBtn = useRef<HTMLButtonElement>(null);
  const target = child ?? created ?? undefined;
  const editMode = mode === 'edit' || created !== null;
  const audio = useRef<HTMLAudioElement | null>(null);
  const theme = GENDER_THEME[gender];

  useMediaRenamed(useCallback((from: string, to: string) => {
    setSavedAvatar((v) => replacePath(v, from, to)); setAvatarDraft((v) => replacePath(v, from, to));
    setSavedGreeting((v) => replacePath(v, from, to)); setGreetingDraft((v) => replacePath(v, from, to));
    setSavedCelA((v) => replacePath(v, from, to)); setCelADraft((v) => replacePath(v, from, to));
    setSavedCelB((v) => replacePath(v, from, to)); setCelBDraft((v) => replacePath(v, from, to));
  }, []));

  // edit mode: the saved welcome sound, so Save knows which file it replaces
  useEffect(() => {
    if (mode !== 'edit' || !child || parentId) return;
    let live = true;
    getChildSettings(child.id).then(
      (r) => { if (!live) return; setSavedGreeting(r?.greeting_path ?? null); setSettingsReady(true); },
      () => { if (live) { setSoundsFailed(true); setSettingsReady(true); setFormError('Could not load the welcome sound. You can still save the other changes.'); } },
    );
    return () => { live = false; };
  }, [mode, child]);

  // Just after adding: the "More sounds" button takes focus, so the parent can go straight to the sounds.
  useEffect(() => {
    if (created) moreBtn.current?.focus();
  }, [created]);

  // focus moves into the dialog and returns to the opener on close
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => { opener?.focus?.(); audio.current?.pause(); };
  }, []);

  const requestClose = () => { if (!busy) onClose(); };

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const root = dialog.current;
    if (!root) return;
    // A nested dialog (the media library) inside this one owns Esc; Tab stays inside it.
    const target = e.target as HTMLElement;
    const nested = target.closest?.('[role="dialog"]');
    const inNested = !!nested && nested !== root && root.contains(nested);
    if (e.key === 'Escape') { if (inNested) return; e.stopPropagation(); requestClose(); return; }
    if (e.key !== 'Tab') return;
    const scope = inNested ? (nested as HTMLElement) : root;
    const items = Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0]; const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === scope)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  }

  const avatarShown = avatarDraft ?? savedAvatar;
  const celAShown = celADraft ?? savedCelA;
  const celBShown = celBDraft ?? savedCelB;
  const greetingShown = greetingDraft ?? savedGreeting;

  function togglePlay() {
    const url = mediaUrl(greetingShown);
    if (!url) return;
    if (playing && audio.current) { audio.current.pause(); audio.current = null; setPlaying(false); return; }
    audio.current?.pause();
    const a = new Audio(url);
    a.onended = () => setPlaying(false);
    audio.current = a;
    setPlaying(true);
    a.play().catch(() => { audio.current = null; setPlaying(false); });
  }

  async function save() {
    setFormError(null);
    const input: NewChild = { child_name: loginName, display_name: displayName, avatar_path: avatarShown, celebrate_a_path: celAShown, celebrate_b_path: celBShown, gender, age_band: age, pin };
    const found = validateChild(input, editMode ? 'edit' : 'create');
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      if (!editMode) await doCreate(input); else await doEdit(input);
    } finally {
      setBusy(false);
    }
  }

  async function doCreate(input: NewChild) {
    const res = parentId ? await createChild(input, undefined, parentId) : await createChild(input);
    if (!res.ok) {
      if (res.error === 'name_taken') setErrors({ child_name: 'That name is already used. Choose another.' });
      else if (res.error === 'child_limit') setFormError(parentId ? 'This parent already has 5 children.' : 'You already have 5 children.');
      else setFormError('Could not save the child. Try again.');
      return;
    }
    let warn = false;
    if (greetingDraft) {
      try { await updateChildSettings(res.child.id, { greeting_path: greetingDraft }); } catch { warn = true; }
    }
    onSaved(res.child);
    if (warn) onNotice?.('warning', 'Child added, but the welcome sound was not saved. Edit the child to add it again.');
    // The modal stays open on the new child, so the parent can add the sounds (More sounds).
    setSavedAvatar(avatarShown);
    setAvatarDraft(null);
    setSavedCelA(celAShown);
    setCelADraft(null);
    setSavedCelB(celBShown);
    setCelBDraft(null);
    setSavedGreeting(greetingDraft ?? savedGreeting);
    setGreetingDraft(null);
    setCreated(res.child);
  }

  async function doEdit(input: NewChild) {
    if (!target) return;
    const child = target;
    const { child_name: _login, ...patch } = input;
    if (parentId) {
      // Super Admin mode: the pictures and sounds are never sent, so nothing there can change or be removed.
      const { avatar_path: _avatar, celebrate_a_path: _a, celebrate_b_path: _b, ...fields } = patch;
      const saved = await updateChild(child.id, fields);
      if (!saved.ok) { setFormError('Could not save the child. Try again.'); return; }
      onSaved({ ...child, ...fields });
      onClose();
      return;
    }
    const res = await updateChild(child.id, patch);
    if (!res.ok) { setFormError('Could not save the child. Try again.'); return; }
    const replaced: string[] = [];
    if (avatarDraft && savedAvatar && savedAvatar !== avatarDraft) replaced.push(savedAvatar);
    if (celADraft && savedCelA && savedCelA !== celADraft) replaced.push(savedCelA);
    if (celBDraft && savedCelB && savedCelB !== celBDraft) replaced.push(savedCelB);
    let soundFailed = false;
    if (greetingDraft && greetingDraft !== savedGreeting) {
      try {
        await updateChildSettings(child.id, { greeting_path: greetingDraft });
        if (savedGreeting) replaced.push(savedGreeting);
      } catch { soundFailed = true; }
    }
    const failed = replaced.length > 0 ? await removeMedia(replaced) : false;
    onSaved({ ...child, ...patch });
    if (soundFailed) onNotice?.('warning', 'Saved, but the welcome sound was not saved.');
    else if (failed) onNotice?.('warning', 'Saved, but an old file could not be removed from storage.');
    onClose();
  }

  const canSave = !busy && settingsReady;

  return (
    <div className={s.modalBackdrop} data-testid="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose(); }}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`${s.modal} ${compact ? s.modalCompact : ''}`}
        // Prince or princess fills the whole form; a soft wash of the form color keeps the fields readable.
        style={{
          backgroundColor: theme.modalBg,
          backgroundImage: `linear-gradient(${theme.modalBg}CC, ${theme.modalBg}B3), url(${theme.hero})`,
          backgroundSize: 'contain',
          backgroundPosition: 'left top',
          backgroundRepeat: 'no-repeat',
          color: theme.text,
          border: `4px solid ${theme.accent}`,
        }}
        onKeyDown={onKeyDown}
      >
        <ModalClose onClick={requestClose} disabled={busy} />
        <h2 id={titleId} style={{ color: theme.text }}>{editMode ? 'Edit child' : 'Add child'}</h2>

        <div className={s.modalCols} style={parentId ? { gridTemplateColumns: '1fr' } : undefined}>
          <div className={s.modalCol}>
        <div className={s.genderAgeRow}>
          <div className={s.modalField} role="group" aria-label="Gender">
            <span className={s.modalLabel}>Gender</span>
            <div className={s.segmented}>
              {(['male', 'female'] as const).map((g) => (
                <button key={g} type="button" className={s.segBtn} aria-pressed={gender === g} onClick={() => setGender(g)}>
                  <span aria-hidden="true">{GENDER_THEME[g].icon} </span>{GENDER_THEME[g].label}
                </button>
              ))}
            </div>
          </div>
          <div className={s.modalField} role="group" aria-label="Age band">
            <span className={s.modalLabel}>Age</span>
            <div className={s.segmented}>
              {(['2-5', '5-10'] as const).map((b) => (
                <button key={b} type="button" className={s.segBtn} aria-pressed={age === b} onClick={() => setAge(b)}>{b}</button>
              ))}
            </div>
          </div>
        </div>

        <div className={s.modalField}>
          <label htmlFor={`${titleId}-dn`}>Display name</label>
          <input id={`${titleId}-dn`} className={s.modalInput} value={displayName} maxLength={40} aria-invalid={!!errors.display_name} onChange={(e) => setDisplayName(e.target.value)} />
          {errors.display_name && <span className={s.fieldError}>{errors.display_name}</span>}
        </div>

        <div className={s.modalField}>
          {!editMode ? (
            <>
              <label htmlFor={`${titleId}-ln`}>Login name</label>
              <input id={`${titleId}-ln`} className={s.modalInput} value={loginName} maxLength={40} autoCapitalize="none" aria-invalid={!!errors.child_name} onChange={(e) => setLoginName(e.target.value)} />
              {errors.child_name && <span className={s.fieldError}>{errors.child_name}</span>}
            </>
          ) : (
            <>
              <span className={s.modalLabel}>Login name</span>
              <span style={{ fontWeight: 700 }}>
                <span role="img" aria-label="Login name locked">🔒</span> {target?.child_name}
              </span>
            </>
          )}
        </div>

        <div className={s.modalField}>
          <label htmlFor={`${titleId}-pin`}>PIN</label>
          <input id={`${titleId}-pin`} className={s.modalInput} value={pin} maxLength={4} autoComplete="off" aria-invalid={!!errors.pin} onChange={(e) => setPin(e.target.value)} />
          {errors.pin && <span className={s.fieldError}>{errors.pin}</span>}
        </div>
          </div>
          {!parentId && <div className={s.modalCol}>
        <div className={s.modalField}>
          <span className={s.modalLabel}>Avatar</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span className={`${s.childAvatar} ${s.childAvatarLg}`} style={{ borderColor: theme.accent }}>
              {mediaUrl(avatarShown) ? <Pic src={mediaUrl(avatarShown) ?? ''} alt="Avatar" className={s.childAvatarImg} /> : <span aria-hidden="true" style={{ fontSize: 28 }}>{theme.icon}</span>}
            </span>
            <LibraryButton kind="image" label="avatar" onChoose={setAvatarDraft} />
            {avatarDraft && <span style={{ fontSize: 13 }}>Applied when you press Save.</span>}
          </div>
        </div>

        <div className={s.modalField}>
          <span className={s.modalLabel}>Celebration pictures</span>
          <span style={{ fontSize: 13, overflowWrap: 'anywhere' }}>Two pictures of {displayName.trim() || 'your child'}. They sway on the screen after a game is finished.</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {([
              ['A', celAShown, setCelADraft, celADraft],
              ['B', celBShown, setCelBDraft, celBDraft],
            ] as const).map(([k, shown, setDraft, draft]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`${s.childAvatar} ${s.childAvatarLg}`} style={{ borderColor: theme.accent, borderRadius: 18 }}>
                  {mediaUrl(shown) ? <Pic src={mediaUrl(shown) ?? ''} alt={`Celebration picture ${k}`} className={s.childAvatarImg} /> : <span aria-hidden="true" style={{ fontSize: 22 }}>{k}</span>}
                </span>
                <LibraryButton kind="image" label={`celebration picture ${k}`} onChoose={setDraft} />
                {draft && <span style={{ fontSize: 13 }}>Applied when you press Save.</span>}
              </div>
            ))}
          </div>
        </div>

        <div className={s.modalField}>
          <span className={s.modalLabel}>Welcome sound</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {greetingShown && <PlayButton playing={playing} label={playing ? 'Pause welcome sound' : 'Play welcome sound'} onClick={togglePlay} />}
            <span style={{ fontWeight: 600, fontSize: 15 }}>{baseName(greetingShown) ?? 'No welcome sound yet'}</span>
            {soundsFailed ? <span style={{ fontSize: 13 }}>Not available right now.</span> : <LibraryButton kind="audio" label="welcome sound" onChoose={(p) => { audio.current?.pause(); setPlaying(false); setGreetingDraft(p); }} />}
          </div>
        </div>

          </div>}
        </div>

        {editMode && target && !parentId && (
          <div>
            {created && !more && <span style={{ fontSize: 13 }}>Child added. Add the sounds now, or press Save to finish.</span>}
            <button
              ref={moreBtn}
              type="button"
              className={`${s.moreToggle} ${created && !more ? s.morePulse : ''}`}
              aria-expanded={more}
              onClick={() => setMore((v) => !v)}
            >
              {more ? '▾' : '▸'} More sounds
            </button>
            {more && <div className={s.modalSounds}><ChildSounds childId={target.id} /></div>}
          </div>
        )}

        {formError && <div role="alert" className={s.fieldError}>{formError}</div>}

        <div className={s.modalActions}>
          <button type="button" className={`${s.btn} ${s.ghost}`} disabled={busy} onClick={requestClose} style={{ height: 44, padding: '0 20px', borderRadius: 12, border: '1.5px solid #E3D5C4', background: '#fff', color: '#4A3830', fontWeight: 700, fontFamily: 'Nunito, sans-serif', fontSize: 15, cursor: 'pointer' }}>Cancel</button>
          <button type="button" className={s.modalPrimary} style={{ background: theme.text }} disabled={!canSave} aria-busy={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
