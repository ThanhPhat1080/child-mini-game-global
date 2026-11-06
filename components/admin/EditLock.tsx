import type { ReactNode } from 'react';
import s from './admin-ui.module.css';

/**
 * Disables every input and button inside when `locked` (pending or global rows, or rows of someone else).
 * In that View mode the buttons are also hidden (visibility), except those marked data-nav.
 */
export function EditLock({ locked, children }: { locked: boolean; children: ReactNode }) {
  return (
    <fieldset disabled={locked} className={s.viewLock} style={{ display: 'contents', border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      {children}
    </fieldset>
  );
}
