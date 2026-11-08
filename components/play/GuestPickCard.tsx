'use client';

import styles from './play.module.css';

/**
 * Guest card on the picker: shown when the parent has no children yet. Play as a guest sees only global content.
 * Neutral colors (no gender), a plain figure as the picture.
 */
export default function GuestPickCard({ onPick, size = 'large' }: { onPick(): void; size?: 'large' | 'small' }) {
  return (
    <button
      type="button"
      data-pick-card
      data-child-id="guest"
      data-size={size}
      className={`hm-tap ${styles.card} ${size === 'large' ? styles.cardLarge : styles.cardSmall}`}
      aria-label="Guest"
      onClick={onPick}
      style={{ background: '#F4EEE6', borderColor: '#B9A898', color: '#5A4038' }}
    >
      <span className={styles.avatar} style={{ color: '#7A5C50' }} aria-hidden="true">
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
        </svg>
      </span>
      <span className={styles.name}>Guest</span>
    </button>
  );
}
