'use client';

import type { AgeBand } from '@/lib/childTheme';
import styles from '@/app/play/guest/guest.module.css';

const BANDS: AgeBand[] = ['2-5', '5-10'];

/** The age switch of the visitor details (GU4): 2-5 or 5-10, bigger than the admin's, default 2-5. Stored only. */
export function AgeSwitch({ value, onChange }: { value: AgeBand; onChange(v: AgeBand): void }) {
  return (
    <div className={styles.seg} role="group" aria-label="Age">
      {BANDS.map((band) => (
        <button
          key={band}
          type="button"
          aria-pressed={value === band}
          className={`${styles.segBtn} ${value === band ? styles.segOn : ''}`}
          onClick={() => onChange(band)}
        >
          {band}
        </button>
      ))}
    </div>
  );
}
