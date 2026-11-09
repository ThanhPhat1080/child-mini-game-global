'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { MAX_SOUND_BYTES, cardAudioType } from './CardPanel';
import { ghostBtn } from './editor-parts';
import { mediaUrl, uploadToLibrary, isMediaInUse, deleteMedia, MAX_IMAGE_BYTES } from '@/lib/media';
import { listLibrary } from '@/lib/media/library';
import { getMyUserId } from '@/lib/review';
import { renameMedia } from '@/lib/media/rename';
import { editableStem, libraryOrder, renamedPath } from '@/lib/mediaPaths';
import { Toast, useToast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import s from './admin-ui.module.css';
import { selectArrowStyle } from './selectArrow';
import { cropToAspect } from '@/lib/crop/render';
import type { Crop } from '@/lib/crop/geometry';
import { useSoundPreview } from './useSoundPreview';
import { PlayButton } from './PlayButton';
import { CropDialog } from './CropDialog';
import { ModalClose } from '@/components/ModalClose';
import { AdminLoading } from './AdminLoading';

/** Picture types the library accepts (the same as the Cards and Spot pictures). */
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
/** Bitmap pictures are cropped to a square before upload (A24). SVG is stored as it is. */
const CROP_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
/** A phone photo is often over 2 MB before the crop; the 2 MB limit applies to the cropped result (A24). */
const MAX_CROP_INPUT_BYTES = 20 * 1024 * 1024;

/** Newest upload first, judged by each file's name before it was renamed (a rename must not move it). */
const createdOrder = (paths: string[], origins: Map<string, string>): string[] => {
  const back = new Map(paths.map((p) => [origins.get(p) ?? p, p]));
  return libraryOrder([...back.keys()]).map((o) => back.get(o) as string);
};

const fileName = (path: string): string => path.split('/').pop() ?? path;

/** Admin buttons: the dark primary of "Save changes", the blue of "Quick import", and the ghost used across the editors. */
const primaryBtn = { height: 44, padding: '0 20px', borderRadius: 12, border: 'none', background: '#5A4038', color: '#fff', fontWeight: 700, fontFamily: 'Nunito, sans-serif', fontSize: 15, cursor: 'pointer' } as const;
const uploadBtn = { height: 42, padding: '0 16px', borderRadius: 10, border: 'none', background: '#3F73B5', color: '#fff', fontWeight: 700, fontFamily: 'Nunito, sans-serif', fontSize: 14, cursor: 'pointer' } as const;
const cancelBtn = { ...ghostBtn, height: 44, padding: '0 20px', fontSize: 15 } as const;
/** The dialog's height: the list scrolls inside it; the header and footer stay put. */
const DIALOG_HEIGHT = 'min(600px, calc(100vh - 32px))';

/**
 * A file name that turns into a text box on double click (the name is selected, the upload id and extension stay).
 * Enter or leaving the box saves; Escape cancels. Nothing happens when the name did not change.
 */
function RenameableName({ path, editing, onStart, onSave, onCancel, style }: {
  path: string; editing: boolean; onStart: () => void; onSave: (name: string) => void; onCancel: () => void; style: React.CSSProperties;
}) {
  const done = useRef(false);
  useEffect(() => { if (editing) done.current = false; }, [editing]); // each edit can finish once
  const name = fileName(path);
  if (!editing) {
    return <span title={`${name}. Double click to rename`} onDoubleClick={onStart} style={style}>{name}</span>;
  }
  const stem = editableStem(path);
  const suffix = name.slice(stem.length);
  const finish = (save: boolean, value: string) => {
    if (done.current) return;
    done.current = true;
    if (save && value.trim() && value.trim() !== stem) onSave(value.trim()); else onCancel();
  };
  return (
    <span style={{ ...style, display: 'flex', alignItems: 'center', gap: 2, overflow: 'visible' }}>
      <input
        autoFocus aria-label={`Rename ${name}`} defaultValue={stem} maxLength={40}
        onFocus={(e) => e.currentTarget.select()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') { e.preventDefault(); finish(true, e.currentTarget.value); }
          if (e.key === 'Escape') { e.preventDefault(); finish(false, ''); }
        }}
        onBlur={(e) => finish(true, e.currentTarget.value)}
        style={{ flex: '1 1 auto', minWidth: 0, font: 'inherit', color: '#4A3830', border: '1.5px solid #5A4038', borderRadius: 6, padding: '2px 4px', background: '#fff' }}
      />
      <span aria-hidden="true" style={{ flex: 'none', color: '#8A7768', fontWeight: 400 }}>{suffix}</span>
    </span>
  );
}

const audioNameStyle = { display: 'block', flex: 1, minWidth: 0, textAlign: 'left', fontWeight: 700, fontSize: 15, color: '#4A3830', fontFamily: 'Nunito, sans-serif', overflowWrap: 'anywhere' } as const;

/** Small trash button for one file; `label` names it for screen readers. */
const DeleteButton = ({ label, busy, onClick, style, hidden }: { label: string; busy: boolean; onClick: () => void; style?: React.CSSProperties; hidden?: boolean }) => hidden ? null : (
  <button type="button" aria-label={label} title="Delete" disabled={busy} onClick={onClick}
    style={{ width: 30, height: 30, borderRadius: 15, border: 'none', background: 'rgba(255,255,255,0.9)', color: '#A8484F', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1, padding: 0, flex: 'none', ...style }}>
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" /><path d="M10 11v5M14 11v5" /></svg>
  </button>
);

/** Small pencil button beside the trash: starts renaming the file. */
const RenameButton = ({ label, busy, onClick, hidden }: { label: string; busy: boolean; onClick: () => void; hidden?: boolean }) => hidden ? null : (
  <button type="button" aria-label={label} title="Rename" disabled={busy} onClick={onClick}
    style={{ width: 30, height: 30, borderRadius: 15, border: 'none', background: 'transparent', color: '#6E5A4E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1, padding: 0, flex: 'none' }}>
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
  </button>
);

/** "Validating..." / "Deleting..." beside the delete button of a file that is being removed. */
const RemovingText = ({ phase, style }: { phase: 'validating' | 'deleting'; style?: React.CSSProperties }) => (
  <span role="status" style={{ fontSize: 12, fontWeight: 700, color: '#6E5A4E', fontFamily: 'Nunito, sans-serif', ...style }}>{phase === 'validating' ? 'Validating...' : 'Deleting...'}</span>
);

/** A picture at full size over the library (the magnifier on a picture). Click outside, the close button or Escape closes it. */
const PictureViewer = ({ url, name, onClose }: { url: string; name: string; onClose: () => void }) => (
  <div role="dialog" aria-modal="true" aria-label={name} onClick={onClose}
    style={{ position: 'fixed', inset: 0, background: 'rgba(74,56,48,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, boxSizing: 'border-box', zIndex: 55 }}>
    <button type="button" autoFocus aria-label="Close picture" onClick={onClose}
      style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: 20, border: 'none', background: '#fff', color: '#4A3830', cursor: 'pointer', fontSize: 22, fontWeight: 700 }}>×</button>
    {/* bucket pictures have any size; unoptimized keeps the file as uploaded */}
    <Image src={url} alt={name} width={1600} height={1200} unoptimized onClick={(e) => e.stopPropagation()}
      style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }} />
  </div>
);

/** Header icons: a picture frame for images, a sol note (eighth note) for sounds. */
const TitleIcon = ({ kind }: { kind: 'image' | 'audio' }) => (kind === 'image' ? (
  <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5A4038" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
) : (
  <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5A4038" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
));

/**
 * "Choose from library" modal (A23, A24). Clicking an item only highlights it; OK applies it (a preview until the page saves).
 * Cancel, Escape or a click outside leave everything as it was. "Upload new" uploads the file at once and lists it.
 */
export function MediaLibraryDialog(props: { kind: 'image' | 'audio'; onChoose: (path: string) => void; onClose: () => void; startCrop?: Crop; aspect?: number; onCropped?: (crop: Crop) => void }) {
  return <MediaLibrary mode="dialog" {...props} />;
}

/**
 * The library itself. `mode="dialog"` is the picker above (choose + OK). `mode="page"` is the admin Media page:
 * the same list, rename, sort, delete, upload and full-size view, without choosing.
 */
export function MediaLibrary({ mode = 'dialog', kind, scope = 'own', onChoose, onClose, startCrop, aspect = 1, onCropped }: {
  mode?: 'dialog' | 'page';
  /** `all`: every owner's files (a Super Admin's Media page). Files of other owners are view only. */
  scope?: 'own' | 'all';
  kind: 'image' | 'audio'; onChoose?: (path: string) => void; onClose?: () => void;
  /** The crop to start from when a picture is cropped (Spot's picture B starts from picture A's crop). */
  startCrop?: Crop;
  /** The shape of the cropped picture, width / height. 1 is a square (A24); the celebration frame is another (A32). */
  aspect?: number;
  /** Called after a cropped picture is uploaded, with the crop that was used. */
  onCropped?: (crop: Crop) => void;
}) {
  const dialog = mode === 'dialog';
  const [paths, setPaths] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  /** A picked bitmap waiting in the crop window; nothing is uploaded until Save. */
  const [cropping, setCropping] = useState<File | null>(null);
  /** The file whose name is being typed. */
  const [renaming, setRenaming] = useState<string | null>(null);
  /** Files whose rename has not been confirmed yet (by the path the list shows). Renames of different files run independently. */
  const [pendingRenames, setPendingRenames] = useState<ReadonlySet<string>>(new Set());
  /** How the list is ordered: by upload time, newest first (default), or by name. */
  const [sortBy, setSortBy] = useState<'created' | 'name'>('created');
  /** The file asked to be deleted (waiting for the in-use check or the confirmation) and whether the delete is running. */
  const [deleting, setDeleting] = useState<string | null>(null);
  /** Files whose delete is under way, each on its own: first the in-use check, then the delete itself. Such a file is inert until it settles. */
  const [removing, setRemoving] = useState<ReadonlyMap<string, 'validating' | 'deleting'>>(new Map());
  /** The picture shown full size (click). */
  const [viewing, setViewing] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const { toast, show: showToast, close: closeToast } = useToast();
  /** Where each renamed file was in the list: its path before any rename. Created order uses it, so a renamed file keeps its place. */
  const origins = useRef(new Map<string, string>());
  const preview = useSoundPreview();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const listBox = useRef<HTMLDivElement | null>(null);

  const [me, setMe] = useState<string | null>(null);
  useEffect(() => {
    if (scope === 'all') void getMyUserId().then(setMe, () => setMe(null));
  }, [scope]);
  // Only the user's own files can be renamed or deleted (the bucket allows writes to the own folder only).
  const canEdit = (p: string) => scope !== 'all' || p.split('/')[0] === me;

  useEffect(() => {
    let live = true;
    (scope === 'all' ? listLibrary(kind, 'all') : listLibrary(kind)).then(
      (p) => { if (live) setPaths(p); },
      () => { if (live) setFailed(true); },
    );
    return () => { live = false; };
  }, [kind, scope]);

  // The page behind does not scroll while the library is open.
  useEffect(() => {
    if (!dialog) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = before; };
  }, [dialog]);

  useEffect(() => {
    // A key the crop window already handled (Esc cancels the crop) must not close the library too.
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (viewing) setViewing(null); else if (deleting) setDeleting(null); else if (dialog) onClose?.(); // Esc closes the top-most window first
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, deleting, viewing, dialog]);

  // OK applies the highlighted file. The preview stops first; the dialog closes after.
  function ok() {
    if (!selected || pendingRenames.has(selected) || removing.has(selected)) return;
    preview.stop();
    onChoose?.(selected);
    onClose?.();
  }

  /** A new upload goes to the top of the list, is highlighted, and the list scrolls up to it. */
  function addUploaded(path: string) {
    setPaths((list) => [path, ...(list ?? []).filter((x) => x !== path)]);
    if (dialog) setSelected(path);
    listBox.current?.scrollTo?.({ top: 0 });
  }

  /**
   * Renames the file at once (no Save button). Optimistic: the list and highlight show the new name immediately,
   * and are put back with an error toast if the rename fails. Each file renames on its own; OK waits only while the chosen file is settling.
   */
  async function rename(path: string, newName: string) {
    const guess = renamedPath(path, newName);
    const swap = (from: string, to: string) => {
      origins.current.set(to, origins.current.get(from) ?? from);
      origins.current.delete(from);
      setPaths((list) => (list ?? []).map((x) => (x === from ? to : x)));
      setSelected((cur) => (cur === from ? to : cur));
    };
    const mark = (on: boolean, p: string) => setPendingRenames((cur) => { const n = new Set(cur); if (on) n.add(p); else n.delete(p); return n; });
    setRenaming(null);
    mark(true, guess);
    if (preview.isPlaying(path)) preview.stop();
    swap(path, guess);
    try {
      const to = await renameMedia(path, newName);
      if (to !== guess) swap(guess, to);
      mark(false, guess);
      showToast('success', `Renamed to ${fileName(to)}`);
    } catch (e) {
      swap(guess, path);
      mark(false, guess);
      showToast('error', e instanceof Error ? e.message : 'Could not rename the file.');
    }
  }

  const setRemoval = (path: string, phase: 'validating' | 'deleting' | null) =>
    setRemoving((cur) => { const n = new Map(cur); if (phase) n.set(path, phase); else n.delete(path); return n; });

  /**
   * Delete: a file a record uses is kept (warning toast); otherwise the admin confirms first. Not optimistic: the file is gone for good.
   * While the check runs the file is inert ("Validating..."); other files are not affected.
   */
  async function askDelete(path: string) {
    setRemoval(path, 'validating');
    showToast('warning', 'Validating before delete.');
    try {
      if (await isMediaInUse(path)) showToast('warning', `${fileName(path)} is used somewhere else, so it was not deleted.`);
      else setDeleting(path);
    } catch {
      showToast('error', 'Could not check where this file is used, so it was not deleted.');
    } finally {
      setRemoval(path, null);
    }
  }

  /** The question closes at once, so the admin can delete another file while this one is being removed. */
  async function confirmDelete(path: string) {
    setDeleting(null);
    setRemoval(path, 'deleting');
    try {
      if (preview.isPlaying(path)) preview.stop();
      if (await deleteMedia(path)) {
        setPaths((list) => (list ?? []).filter((x) => x !== path));
        setSelected((cur) => (cur === path ? null : cur));
        showToast('success', `Deleted ${fileName(path)}`);
      } else {
        showToast('warning', `${fileName(path)} is used somewhere else, so it was not deleted.`);
      }
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Could not delete the file.');
    } finally {
      setRemoval(path, null);
    }
  }

  /** Save in the crop window: crops the picked file to the chosen frame, uploads it and lists it. */
  async function saveCrop(crop: Crop) {
    const picked = cropping;
    if (!picked) return;
    setCropping(null);
    setUploadError(null);
    setUploading(true);
    try {
      const cropped = await cropToAspect(picked, crop, aspect);
      if (cropped.size > MAX_IMAGE_BYTES) throw new Error('Image must be 2 MB or smaller.');
      const path = await uploadToLibrary(cropped);
      addUploaded(path);
      onCropped?.(crop);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  /** Checks the file like the page uploads do, uploads it, and lists it without choosing it. */
  async function upload(picked: File) {
    setUploadError(null);
    let file = picked;
    if (kind === 'image') {
      if (!IMAGE_TYPES.includes(file.type)) return setUploadError('Use a PNG, JPG, WebP or SVG picture.');
      if (CROP_TYPES.includes(file.type)) {
        if (file.size > MAX_CROP_INPUT_BYTES) return setUploadError('Picture must be 20 MB or smaller.');
        return setCropping(file);
      }
      if (file.size > MAX_IMAGE_BYTES) return setUploadError('Image must be 2 MB or smaller.');
    } else {
      const type = cardAudioType(file.type);
      if (!type) return setUploadError('Use an MP3, M4A or WAV sound.');
      if (file.size > MAX_SOUND_BYTES) return setUploadError('Sound must be 2 MB or smaller.');
      // the bucket only knows the standard names (e.g. Chrome calls .m4a "audio/x-m4a")
      if (type !== file.type) file = new File([file], file.name, { type });
    }
    setUploading(true);
    try {
      const path = await uploadToLibrary(file);
      addUploaded(path);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  const shownPaths = useMemo(
    () => (paths === null ? null : sortBy === 'created' ? createdOrder(paths, origins.current) : [...paths].sort((a, b) => editableStem(a).localeCompare(editableStem(b), undefined, { sensitivity: 'base' }) || a.localeCompare(b))),
    [paths, sortBy],
  );
  const busy = uploading || paths === null;
  const canOk = !!selected && !pendingRenames.has(selected) && !removing.has(selected);
  let body: React.ReactNode;
  if (failed) body = <p role="alert" style={{ margin: 0, color: '#A8484F' }}>Could not load the library.</p>;
  else if (paths === null) body = <AdminLoading />;
  else if (paths.length === 0) body = <p style={{ margin: 0, color: '#6E5A4E' }}>Nothing in the library yet.</p>;
  else if (kind === 'image') body = (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
      {(shownPaths ?? []).map((p) => {
        const name = fileName(p);
        const url = mediaUrl(p);
        const on = selected === p;
        const phase = removing.get(p);
        return (
          <li key={p} aria-busy={!!phase} onMouseEnter={() => setHovered(p)} onMouseLeave={() => setHovered((h) => (h === p ? null : h))} style={{ opacity: phase ? 0.5 : 1, position: 'relative', height: 148, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 12, background: '#fff', border: on ? '3px solid #5A4038' : '1.5px solid #E3D5C4', boxSizing: 'border-box' }}>
            <button type="button" aria-label={`${dialog ? 'Choose' : 'View'} ${name}`} aria-pressed={dialog ? on : undefined} data-selected={on ? 'true' : 'false'} disabled={!!phase}
              onClick={phase ? undefined : () => { if (dialog) setSelected(p); else setViewing(p); }}
              style={{ flex: '1 1 auto', minHeight: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, boxSizing: 'border-box', background: 'none', border: 'none', cursor: phase ? 'default' : 'pointer' }}>
              {url && (
                <span style={{ position: 'relative', flex: 1, alignSelf: 'stretch', minHeight: 0 }}>
                  <Image src={url} alt="" fill sizes="120px" unoptimized style={{ objectFit: 'contain' }} />
                </span>
              )}
            </button>
            {!phase && (
              <button type="button" aria-label={`Enlarge ${name}`} title="Enlarge" onClick={() => setViewing(p)}
                onFocus={() => setHovered(p)} onBlur={() => setHovered((h) => (h === p ? null : h))}
                style={{ position: 'absolute', top: 4, left: 4, width: 25, height: 25, borderRadius: 13, border: 'none', background: 'rgba(255,255,255,0.9)', color: '#4A3830', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'zoom-in', boxShadow: '0 1px 4px rgba(74,56,48,0.25)', opacity: hovered === p ? 1 : 0, transition: 'opacity 0.15s' }}>
                <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M20 20l-4.8-4.8M10.5 8v5M8 10.5h5" /></svg>
              </button>
            )}
            {phase && <RemovingText phase={phase} style={{ position: 'absolute', top: 8, right: 40, background: 'rgba(255,255,255,0.9)', borderRadius: 8, padding: '1px 6px' }} />}
            <DeleteButton hidden={!canEdit(p)} label={`Delete ${name}`} busy={!!phase} onClick={() => void askDelete(p)} style={{ position: 'absolute', top: 4, right: 4, boxShadow: '0 1px 4px rgba(74,56,48,0.25)' }} />
            <RenameableName path={p} editing={renaming === p} onStart={() => canEdit(p) && !pendingRenames.has(p) && !phase && setRenaming(p)} onSave={(n) => void rename(p, n)} onCancel={() => setRenaming(null)}
              style={{ flex: 'none', width: '100%', padding: '4px 6px', boxSizing: 'border-box', fontSize: 12, fontWeight: 700, color: '#4A3830', fontFamily: 'Nunito, sans-serif', background: on ? '#F6EADC' : '#FBF4E9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text' }} />
          </li>
        );
      })}
    </ul>
  );
  else body = (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {(shownPaths ?? []).map((p) => {
        const name = fileName(p);
        const on = selected === p;
        const playing = preview.isPlaying(p);
        const phase = removing.get(p);
        return (
          <li key={p} data-selected={on ? 'true' : 'false'} aria-busy={!!phase}
            onClick={(e) => { if (dialog && !phase && renaming !== p && !(e.target as HTMLElement).closest('button, input')) setSelected(p); }}
            style={{ cursor: dialog && !phase && renaming !== p ? 'pointer' : 'default', opacity: phase ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 14, background: on ? '#F6EADC' : '#FBF4E9', border: on ? '2px solid #5A4038' : '1.5px solid transparent', boxSizing: 'border-box' }}>
            <PlayButton playing={playing} label={`${playing ? 'Pause' : 'Play'} ${name}`} disabled={!!phase} onClick={() => preview.toggle(p, mediaUrl(p))} />
            {renaming === p ? (
              <RenameableName path={p} editing onStart={() => undefined} onSave={(n) => void rename(p, n)} onCancel={() => setRenaming(null)} style={audioNameStyle} />
            ) : (
              dialog ? (
                <button type="button" aria-label={`Choose ${name}`} aria-pressed={on} disabled={!!phase} onClick={() => setSelected(p)}
                  style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: phase ? 'default' : 'pointer' }}>
                  <RenameableName path={p} editing={false} onStart={() => canEdit(p) && !pendingRenames.has(p) && !phase && setRenaming(p)} onSave={() => undefined} onCancel={() => undefined} style={audioNameStyle} />
                </button>
              ) : (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <RenameableName path={p} editing={false} onStart={() => canEdit(p) && !pendingRenames.has(p) && !phase && setRenaming(p)} onSave={() => undefined} onCancel={() => undefined} style={audioNameStyle} />
                </div>
              )
            )}
            {phase && <RemovingText phase={phase} />}
            <RenameButton hidden={!canEdit(p) || renaming === p} label={`Rename ${name}`} busy={!!phase || pendingRenames.has(p)} onClick={() => setRenaming(p)} />
            <DeleteButton hidden={!canEdit(p)} label={`Delete ${name}`} busy={!!phase} onClick={() => void askDelete(p)} style={{ background: 'transparent' }} />
          </li>
        );
      })}
    </ul>
  );

  const title = kind === 'image' ? 'Image Library' : 'Sound Library';

  const header = (
    <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: dialog ? '24px 64px 16px 28px' : '20px 24px 12px' }}>
      {dialog && <h2 style={{ margin: 0, fontSize: 21, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}><TitleIcon kind={kind} />{title}</h2>}
      <input ref={fileInput} type="file" hidden accept={kind === 'image' ? 'image/*' : 'audio/*'} aria-label={`Upload new ${kind === 'image' ? 'picture' : 'sound'}`}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: '#6E5A4E' }}>
        Sort by
        <select aria-label="Sort by" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'created' | 'name')}
          style={{ height: 38, borderRadius: 10, border: '1.5px solid #E3D5C4', background: '#fff', color: '#4A3830', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 14, padding: '0 8px', ...selectArrowStyle }}>
          <option value="created">Created (newest)</option>
          <option value="name">Name (A to Z)</option>
        </select>
      </label>
      <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} style={{ ...uploadBtn, opacity: busy ? 0.6 : 1, cursor: busy ? 'default' : 'pointer' }}>
        {uploading ? 'Uploading...' : 'Upload new'}
      </button>
    </div>
  );
  const status = (uploadError || uploading) && (
    <div style={{ flex: 'none', padding: dialog ? '0 28px 12px' : '0 24px 12px' }}>
      {uploadError && <p role="alert" style={{ margin: 0, color: '#A8484F', fontWeight: 700 }}>{uploadError}</p>}
      {uploading && <p role="status" style={{ margin: 0, color: '#6E5A4E', fontWeight: 700 }}>Uploading your file. It will appear in the list when it is done.</p>}
    </div>
  );
  const overlays = (
    <>
      {deleting && <ConfirmDialog title="Delete this file?" body={`${fileName(deleting)} will be removed for good. No page uses it.`} button="Delete" onCancel={() => setDeleting(null)} onConfirm={() => void confirmDelete(deleting)} />}
      {viewing && <PictureViewer url={mediaUrl(viewing) ?? ''} name={fileName(viewing)} onClose={() => setViewing(null)} />}
      <Toast toast={toast} onClose={closeToast} />
      {cropping && <CropDialog file={cropping} start={startCrop} aspect={aspect} onCancel={() => setCropping(null)} onSave={saveCrop} />}
    </>
  );

  if (!dialog) {
    return (
      <>
        <section aria-label={title} style={{ background: '#fff', borderRadius: 20, boxShadow: '0 1px 0 #EADCC8, 0 10px 30px rgba(90,64,56,0.06)', fontFamily: 'Nunito, sans-serif', color: '#4A3830' }}>
          {header}
          {status}
          <div ref={listBox} data-library-list style={{ padding: '4px 24px 24px' }}>{body}</div>
        </section>
        {overlays}
      </>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(74,56,48,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box', zIndex: 50 }}>
      <div role="dialog" aria-modal="true" aria-label={title} style={{ position: 'relative', background: '#fff', borderRadius: 20, width: '100%', maxWidth: 640, height: DIALOG_HEIGHT, overflow: 'hidden', boxSizing: 'border-box', boxShadow: '0 20px 60px rgba(74,56,48,0.3)', display: 'flex', flexDirection: 'column', fontFamily: 'Nunito, sans-serif', color: '#4A3830' }}>
        {onClose && <ModalClose onClick={onClose} />}
        {/* header: title and Upload new stay fixed */}
        {header}
        {status}
        {/* only the list scrolls; scrolling it does not scroll the page behind */}
        <div ref={listBox} data-library-list style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: '4px 28px 16px' }}>
          {body}
        </div>
        {/* footer: Cancel and OK stay fixed */}
        <div style={{ flex: 'none', display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', padding: '16px 28px 24px', borderTop: '1px solid #F1E7DA' }}>
          <button type="button" autoFocus onClick={onClose} style={cancelBtn}>Cancel</button>
          <button type="button" aria-label="OK" onClick={ok} disabled={!canOk} style={{ ...primaryBtn, opacity: canOk ? 1 : 0.5, cursor: canOk ? 'pointer' : 'default' }}>OK</button>
        </div>
      </div>
      {overlays}
    </div>
  );
}
