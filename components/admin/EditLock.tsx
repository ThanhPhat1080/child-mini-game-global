import type { ReactNode } from 'react';

/** Disables every input and button inside when `locked` (pending or global rows, or rows of someone else). */
export function EditLock({ locked, children }: { locked: boolean; children: ReactNode }) {
  return (
    <fieldset disabled={locked} style={{ display: 'contents', border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      {children}
    </fieldset>
  );
}
