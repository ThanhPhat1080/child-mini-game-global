'use client';

import { useState } from 'react';
import type { Crop } from '@/lib/crop/geometry';
import { MediaLibraryDialog } from './MediaLibraryDialog';
import { ghostBtn } from './editor-parts';
import s from './admin-ui.module.css';

/** One line: the label never wraps, so the button keeps its height. */
const small = { ...ghostBtn, whiteSpace: 'nowrap' } as const;

/**
 * "Choose from library" next to an upload button (A24). `label` names the field for screen readers, e.g. "card 3 picture".
 * `onChoose` gets the bucket path after OK.
 */
export function LibraryButton({ kind, label, onChoose, startCrop, aspect, onCropped }: {
  kind: 'image' | 'audio'; label: string; onChoose: (path: string) => void;
  startCrop?: Crop; /** The shape of a picture uploaded from the dialog (width / height); 1 is a square (A24). */ aspect?: number;
  onCropped?: (crop: Crop) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`${s.btn} ${s.ghost}`} aria-label={`Choose from library for ${label}`} style={small} onClick={() => setOpen(true)}>
        {kind === 'image' ? '+ Choose images' : '+ Choose sounds'}
      </button>
      {open && <MediaLibraryDialog kind={kind} onChoose={onChoose} onClose={() => setOpen(false)} startCrop={startCrop} aspect={aspect} onCropped={onCropped} />}
    </>
  );
}
