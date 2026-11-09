'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getChildSettings, updateChildSettings, type ChildSettingsRow } from '@/lib/settings';
import { mediaUrl, removeMedia } from '@/lib/media';
import { applause, ohOh, speakKid, yay, type SoundHandle } from '@/lib/sfx';
import styles from '@/app/admin/admin.module.css';
import { Toast, useToast } from '@/components/admin/Toast';
import { useMediaRenamed } from '@/lib/media/renames';
import { replacePath } from '@/lib/mediaPaths';
import { RevertButton, SaveButton } from '@/components/admin/SaveButtons';
import { LibraryButton } from '@/components/admin/LibraryButton';
import { PlayButton } from '@/components/admin/PlayButton';

type Row = ChildSettingsRow;
type AudioKind = 'hooray' | 'ohoh' | 'complete';

const COLUMN: Record<AudioKind, keyof Row> = { hooray: 'hooray_path', ohoh: 'ohoh_path', complete: 'complete_path' };
/** A sound choice not saved yet: a bucket path from the library, or null (back to the built-in sound). */
type SoundDraft = Partial<Record<AudioKind, string | null>>;

const baseName = (p: string | null) => (p ? p.split('/').pop() ?? p : null);
/** Play-state key of one sound setting. Keyed by setting, not by file: two settings may share one file. */
const fileKey = (k: AudioKind) => `file:${k}`;

/** One child's music, volume and feedback sounds (N2). Every choice is a preview until "Save"; "Revert" drops it (A25, A26). */
export function ChildSounds({ childId }: { childId: string }) {
  const [row, setRow] = useState<Row | null>(null);
  const [volume, setVolume] = useState(30);
  const [soundDraft, setSoundDraft] = useState<SoundDraft>({});
  const { toast, show: showToast, close: closeToast } = useToast();
  // a file renamed in the library: the row and the choices not saved yet follow it
  useMediaRenamed(useCallback((from: string, to: string) => {
    setRow((v) => replacePath(v, from, to)); setSoundDraft((v) => replacePath(v, from, to));
  }, []));
  const [saving, setSaving] = useState(false);
  const preview = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  /** What the row shows and plays: the draft if there is one, else the saved file. */
  const shown = (k: AudioKind): string | null => (k in soundDraft ? soundDraft[k] ?? null : (row?.[COLUMN[k]] as string | null | undefined) ?? null);

  useEffect(() => {
    getChildSettings(childId).then(
      (r) => {
        if (!r) return showToast('error', 'Could not load settings');
        setRow(r);
        setVolume(r.music_volume);
      },
      (e: Error) => showToast('error', e.message || 'Could not load settings'),
    );
  }, [childId, showToast]);

  function stopPreview() {
    preview.current?.pause();
    preview.current = null;
    stopBuiltIn();
    setPlaying(null);
  }

  async function save() {
    setSaving(true);
    try { await doSave(); } finally { setSaving(false); }
  }

  async function doSave() {
    const patch: Partial<Row> = { music_volume: volume };
    const replaced: string[] = []; // files no setting uses any more, removed after a successful save
    for (const k of Object.keys(soundDraft) as AudioKind[]) {
      const path = soundDraft[k] ?? null;
      (patch as Record<string, unknown>)[COLUMN[k]] = path;
      const old = row?.[COLUMN[k]] as string | null | undefined;
      if (old && old !== path) replaced.push(old);
    }
    try {
      await updateChildSettings(childId, patch);
    } catch (e) {
      return showToast('error', (e as Error).message);
    }
    setRow(row ? { ...row, ...patch } : row);
    setSoundDraft({});
    stopPreview();
    const failed = await removeMedia(replaced);
    if (failed) showToast('warning', 'Saved, but an old file could not be removed from storage.'); else showToast('success', 'Saved');
  }

  /** Drops unsaved edits and goes back to the last saved values. */
  function revert() {
    if (!row) return;
    setVolume(row.music_volume);
    setSoundDraft({});
    stopPreview();
    showToast('success', 'Changes reverted.');
  }

  const soundChanged = (Object.keys(soundDraft) as AudioKind[]).some((k) => (soundDraft[k] ?? null) !== ((row?.[COLUMN[k]] as string | null | undefined) ?? null));
  const dirty = !!row && (volume !== row.music_volume || soundChanged);

  /** A sound chosen from the library: a preview until Save. */
  function chooseSound(kind: AudioKind, path: string) {
    if (playing === fileKey(kind)) stopPreview();
    setSoundDraft((d) => ({ ...d, [kind]: path }));
    showToast('success', 'Sound chosen. Press Save to apply it.');
  }

  function removeSound(kind: AudioKind) {
    if (playing === fileKey(kind)) stopPreview();
    setSoundDraft((d) => ({ ...d, [kind]: null }));
    showToast('success', 'Built-in sound chosen. Press Save to apply it.');
  }

  /** Preview of the built-in sound when no custom track is set. Play / pause like the other rows. */
  const builtIn = useRef<SoundHandle | null>(null);
  const builtInTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function stopBuiltIn() {
    builtIn.current?.stop();
    builtIn.current = null;
    if (builtInTimer.current) clearTimeout(builtInTimer.current);
  }
  function previewBuiltIn(kind: 'hooray' | 'ohoh' | 'complete') {
    const key = `builtin:${kind}`;
    const wasPlaying = playing === key;
    preview.current?.pause();
    preview.current = null;
    stopBuiltIn();
    if (wasPlaying) { setPlaying(null); return; }
    let h: SoundHandle | void;
    if (kind === 'hooray') h = yay();
    else if (kind === 'ohoh') h = ohOh();
    else {
      h = applause(3, () => speakKid('You did it!', { pitch: 1.9, rate: 0.9 }));
    }
    if (!h) return;
    builtIn.current = h;
    setPlaying(key);
    builtInTimer.current = setTimeout(() => setPlaying((p) => (p === key ? null : p)), h.ms);
  }

  /** Play / pause the shown file of one setting. */
  function toggle(kind: AudioKind) {
    const key = fileKey(kind);
    const path = shown(kind);
    const url = mediaUrl(path);
    if (!url || !path) return;
    if (playing === key && preview.current) {
      preview.current.pause();
      preview.current = null;
      setPlaying(null);
      return;
    }
    preview.current?.pause();
    stopBuiltIn();
    const audio = new Audio(url);
    audio.onended = () => setPlaying((p) => (p === key ? null : p));
    preview.current = audio;
    setPlaying(key);
    audio.play().catch(() => { preview.current = null; setPlaying(null); });
  }

  useEffect(() => () => { preview.current?.pause(); builtIn.current?.stop(); }, []);

  /** One sound setting's controls: Choose sounds and, for the feedback sounds, Use built-in. */
  function soundActions(kind: AudioKind, label: string, builtInOption: boolean) {
    return (
      <>
        <LibraryButton kind="audio" label={label} onChoose={(path) => chooseSound(kind, path)} />
        {builtInOption && shown(kind) && <button type="button" className={styles.ghost} onClick={() => removeSound(kind)}>Use built-in</button>}
      </>
    );
  }

  return (
    <div>
      <div className={styles.head}>
        <div>
          <h2>Music and feedback sounds</h2>
          <p className={styles.sub}>Music and feedback sounds on the child screens.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <RevertButton saving={saving} dirty={dirty} onClick={revert} />
          <SaveButton saving={saving} enabled={dirty} onClick={save} />
        </div>
      </div>

      <section className={styles.section}>
        <div className={styles.volume}>
          <label htmlFor={`vol-${childId}`} className={styles.label}>Music volume</label>
          <input id={`vol-${childId}`} type="range" min={0} max={100} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
          <span className={styles.note}>{volume}% · kept low on purpose</span>
        </div>
        <p className={styles.note}>The background music is built in and loops on the child screens.</p>
      </section>

      <section className={styles.section}>
        <div>
          <h2>Feedback sounds</h2>
          <p>Optional. Choose your own track for each moment; without one, the built-in sound plays.</p>
        </div>
        {([
          { kind: 'hooray', title: 'Hooray', hint: 'Plays when the child picks the correct answer.' },
          { kind: 'ohoh', title: 'Oh-oh', hint: 'Plays when the child picks a wrong answer.' },
          { kind: 'complete', title: 'You did it', hint: 'Plays when a quiz set is finished (replaces the default "You did it" sound).' },
        ] as const).map((it) => {
          const path = shown(it.kind);
          const on = playing === (path ? fileKey(it.kind) : `builtin:${it.kind}`);
          return (
            <div key={it.kind} className={styles.row}>
              <PlayButton playing={on} label={`${on ? 'Pause' : 'Play'} ${it.title} sound`} onClick={() => (path ? toggle(it.kind) : previewBuiltIn(it.kind))} />
              <div className={styles.rowText}>
                <div className={styles.rowTitle}>{it.title}: <span style={{ fontWeight: 600 }}>{baseName(path) ?? 'built-in sound'}</span></div>
                <div className={styles.rowMeta}>{it.hint}</div>
              </div>
              {soundActions(it.kind, `${it.title} sound`, true)}
            </div>
          );
        })}
      </section>

      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}
