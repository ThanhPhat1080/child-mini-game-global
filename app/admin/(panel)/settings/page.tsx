'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { mediaUrl, removeMedia } from '@/lib/media';
import { applause, ohOh, speakKid, yay, type SoundHandle } from '@/lib/sfx';
import styles from '../../admin.module.css';
import { Toast, useToast } from '@/components/admin/Toast';
import { useMediaRenamed } from '@/lib/media/renames';
import { replacePath } from '@/lib/mediaPaths';
import { RevertButton, SaveButton } from '@/components/admin/SaveButtons';
import { LibraryButton } from '@/components/admin/LibraryButton';
import { PlayButton } from '@/components/admin/PlayButton';
import { Pic } from '@/components/Pic';

type Row = { child_name: string; greeting_path: string | null; music_path: string | null; music_volume: number; avatar_path: string | null; hooray_path: string | null; ohoh_path: string | null; complete_path: string | null };
type AudioKind = 'greeting' | 'music' | 'hooray' | 'ohoh' | 'complete';

const COLUMN: Record<AudioKind, keyof Row> = { greeting: 'greeting_path', music: 'music_path', hooray: 'hooray_path', ohoh: 'ohoh_path', complete: 'complete_path' };
/** A sound choice not saved yet: a bucket path from the library, or null (back to the built-in sound). */
type SoundDraft = Partial<Record<AudioKind, string | null>>;

const baseName = (p: string | null) => (p ? p.split('/').pop() ?? p : null);
/** Play-state key of one sound setting. Keyed by setting, not by file: two settings may share one file. */
const fileKey = (k: AudioKind) => `file:${k}`;

/** Every choice here is a preview until "Save"; "Revert" drops it (A25, A26). */
export default function SettingsPage() {
  const [row, setRow] = useState<Row | null>(null);
  const [childName, setChildName] = useState('');
  const [volume, setVolume] = useState(30);
  /** An avatar chosen from the library, not saved yet (A24). */
  const [avatarDraft, setAvatarDraft] = useState<string | null>(null);
  const [soundDraft, setSoundDraft] = useState<SoundDraft>({});
  const { toast, show: showToast, close: closeToast } = useToast();
  // a file renamed in the library: the row and the choices not saved yet follow it
  useMediaRenamed(useCallback((from: string, to: string) => {
    setRow((v) => replacePath(v, from, to)); setAvatarDraft((v) => replacePath(v, from, to)); setSoundDraft((v) => replacePath(v, from, to));
  }, []));
  const [saving, setSaving] = useState(false);
  const preview = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);


  /** What the row shows and plays: the draft if there is one, else the saved file. */
  const shown = (k: AudioKind): string | null => (k in soundDraft ? soundDraft[k] ?? null : (row?.[COLUMN[k]] as string | null | undefined) ?? null);

  useEffect(() => {
    createSupabaseBrowserClient()
      .from('settings')
      .select('child_name, greeting_path, music_path, music_volume, avatar_path, hooray_path, ohoh_path, complete_path')
      .eq('id', 1)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return showToast('error', error?.message ?? 'Could not load settings');
        const r = data as Row;
        setRow(r);
        setChildName(r.child_name);
        setVolume(r.music_volume);
      });
  }, [showToast]);

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
    const patch: Partial<Row> = { child_name: childName.trim(), music_volume: volume };
    const replaced: string[] = []; // files no setting uses any more, removed after a successful save
    if (avatarDraft) {
      patch.avatar_path = avatarDraft;
      if (row?.avatar_path && row.avatar_path !== avatarDraft) replaced.push(row.avatar_path);
    }
    for (const k of Object.keys(soundDraft) as AudioKind[]) {
      const path = soundDraft[k] ?? null;
      (patch as Record<string, unknown>)[COLUMN[k]] = path;
      const old = row?.[COLUMN[k]] as string | null | undefined;
      if (old && old !== path) replaced.push(old);
    }
    const { error } = await createSupabaseBrowserClient().from('settings').update(patch).eq('id', 1);
    if (error) return showToast('error', error.message);
    setRow((r) => (r ? { ...r, ...patch } : r));
    setAvatarDraft(null);
    setSoundDraft({});
   
    stopPreview();
    const failed = await removeMedia(replaced);
    if (failed) showToast('warning', 'Saved, but an old file could not be removed from storage.'); else showToast('success', 'Saved');
  }

  /** Drops unsaved edits and goes back to the last saved values. */
  function revert() {
    if (!row) return;
    setChildName(row.child_name);
    setVolume(row.music_volume);
    setAvatarDraft(null);
    setSoundDraft({});
   
    stopPreview();
    showToast('success', 'Changes reverted.');
  }

  const soundChanged = (Object.keys(soundDraft) as AudioKind[]).some((k) => (soundDraft[k] ?? null) !== ((row?.[COLUMN[k]] as string | null | undefined) ?? null));
  const dirty = !!row && (childName.trim() !== row.child_name || volume !== row.music_volume || (!!avatarDraft && avatarDraft !== row.avatar_path) || soundChanged);

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
      h = applause(3);
      speakKid(`You did it${row?.child_name ? `, ${row.child_name}` : ''}!`, { pitch: 1.9, rate: 0.9 });
    }
    if (!h) return;
    builtIn.current = h;
    setPlaying(key);
    builtInTimer.current = setTimeout(() => setPlaying((p) => (p === key ? null : p)), h.ms);
  }

  /** Play / pause the shown file of one setting. Music previews follow the volume slider live. */
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
    audio.volume = kind === 'music' ? volume / 100 : 1;
    audio.onended = () => setPlaying((p) => (p === key ? null : p));
    preview.current = audio;
    setPlaying(key);
    audio.play().catch(() => { preview.current = null; setPlaying(null); });
  }

  useEffect(() => {
    if (preview.current && playing === fileKey('music')) preview.current.volume = volume / 100;
  }, [volume, playing]);

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

  const avatarShown = avatarDraft ?? row?.avatar_path ?? null;

  return (
    <>
      <div className={styles.head}>
        <div>
          <h1>Settings</h1>
          <p className={styles.sub}>What the child sees and hears on the Welcome screen.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <RevertButton saving={saving} dirty={dirty} onClick={revert} />
          <SaveButton saving={saving} enabled={dirty} onClick={save} />
        </div>
      </div>

      <section className={`${styles.section} ${styles.profile}`}>
        <div className={styles.avatar}>
          {mediaUrl(avatarShown) ? (
            <Pic src={mediaUrl(avatarShown) ?? ''} alt="Avatar" className={styles.avatarImg} />
          ) : (
            <svg aria-hidden="true" width="54" height="38" viewBox="0 0 60 42" fill="#F6E2A6" stroke="#B08A48" strokeWidth="2" strokeLinejoin="round"><path d="M4 38 L8 10 L20 24 L30 4 L40 24 L52 10 L56 38 Z" /></svg>
          )}
        </div>
        <div className={styles.profileBody}>
          <div className={styles.fieldGroup}>
            <label htmlFor="cn">Child&apos;s name</label>
            <input id="cn" className={`${styles.input} ${styles.nameInput}`} type="text" value={childName} onChange={(e) => setChildName(e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <LibraryButton kind="image" label="avatar" onChoose={(path) => { setAvatarDraft(path); showToast('success', 'Avatar chosen. Press Save to apply it.'); }} />
            <span className={styles.note}>Applied when you press Save.</span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div>
          <h2>Greeting voice</h2>
          <p>Plays once after the child taps to enter.</p>
        </div>
        <div className={styles.row}>
          {shown('greeting') && (
            <PlayButton playing={playing === fileKey('greeting')} label={playing === fileKey('greeting') ? 'Pause greeting' : 'Play greeting'} onClick={() => toggle('greeting')} />
          )}
          <div className={styles.rowText}>
            <div className={styles.rowTitle}>{baseName(shown('greeting')) ?? 'No greeting yet'}</div>
            <div className={styles.rowMeta}>Audio file, MP3 or similar</div>
          </div>
          {soundActions('greeting', 'greeting', false)}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.head} style={{ alignItems: 'flex-end' }}>
          <div>
            <h2>Background music</h2>
            <p>Instrumental, royalty-free. The selected track loops quietly.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{soundActions('music', 'background music', false)}</div>
        </div>
        <div className={`${styles.row} ${shown('music') ? styles.rowSel : ''}`}>
          {shown('music') && (
            <PlayButton playing={playing === fileKey('music')} label={playing === fileKey('music') ? 'Pause track' : 'Play track'} onClick={() => toggle('music')} />
          )}
          <div className={styles.rowText}>
            <div className={styles.rowTitle}>{baseName(shown('music')) ?? 'No track yet'}</div>
            <div className={styles.rowMeta}>Loops on the child screens</div>
          </div>
        </div>
        <div className={styles.volume}>
          <label htmlFor="vol" className={styles.label}>Music volume</label>
          <input id="vol" type="range" min={0} max={100} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
          <span className={styles.note}>{volume}% · kept low on purpose</span>
        </div>
      </section>

      <section className={styles.section}>
        <div>
          <h2>Feedback sounds</h2>
          <p>Optional. Choose your own track for each moment; without one, the built-in sound plays.</p>
        </div>
        {([
          { kind: 'hooray', title: 'Hooray', hint: 'Plays when the child picks the correct answer.' },
          { kind: 'ohoh', title: 'Oh-oh', hint: 'Plays when the child picks a wrong answer.' },
          { kind: 'complete', title: 'You did it', hint: 'Plays when a quiz set is finished (replaces the applause and spoken praise).' },
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
    </>
  );
}
