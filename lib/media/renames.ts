'use client';

import { useEffect } from 'react';

type Listener = (from: string, to: string) => void;
const listeners = new Set<Listener>();

/** Tells every open admin page that a bucket file now lives at another path. */
export const announceRename = (from: string, to: string): void => { for (const l of [...listeners]) l(from, to); };

/**
 * Runs `onRename(from, to)` when a file is renamed in the library. A page uses it to swap the old path for the
 * new one in its unsaved edits, so a picture or sound it already points at keeps working. `onRename` must be stable (useCallback).
 */
export function useMediaRenamed(onRename: Listener): void {
  useEffect(() => {
    listeners.add(onRename);
    return () => { listeners.delete(onRename); };
  }, [onRename]);
}
