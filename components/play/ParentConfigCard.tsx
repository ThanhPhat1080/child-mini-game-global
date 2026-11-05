'use client';

import styles from './play.module.css';

/** Last card of the picker (KU11): a shortcut to the admin area behind the grown-up check, not a lock. */
export default function ParentConfigCard({ onOpen }: { onOpen(): void }) {
  return (
    <button type="button" data-pick-card className={`hm-tap ${styles.card} ${styles.config}`} aria-label="Parent configuration" onClick={onOpen}>
      <svg aria-hidden="true" width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="#7A5C50" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z" />
      </svg>
      <span className={styles.tip} aria-hidden="true">Parent configuration</span>
    </button>
  );
}
