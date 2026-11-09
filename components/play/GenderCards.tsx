'use client';

import type { KeyboardEvent, MutableRefObject } from 'react';
import { Pic } from '@/components/Pic';
import { GENDER_THEME, type Gender } from '@/lib/childTheme';
import { VISITOR_HEAD } from '@/lib/visitor';
import styles from '@/app/play/guest/guest.module.css';

export type GenderRefs = { male: HTMLButtonElement | null; female: HTMLButtonElement | null };

/** The Boy and Girl cards (GU2): round head pictures in the gender accent. Left and Right move between them. */
export function GenderCards({ onPick, leaving, picked, pickedStyle, refs }: {
  onPick(g: Gender): void;
  leaving: Gender | null;
  picked: Gender | null;
  pickedStyle: { transform: string } | null;
  refs: MutableRefObject<GenderRefs>;
}) {
  const order: Gender[] = ['male', 'female'];

  function onKey(e: KeyboardEvent<HTMLButtonElement>, from: Gender) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    refs.current[from === 'male' ? 'female' : 'male']?.focus();
  }

  return (
    <div className={styles.genderRow}>
      {order.map((g) => {
        const theme = GENDER_THEME[g];
        const cls = [styles.gcard, g === 'female' ? styles.girl : '', leaving === g ? styles.leave : '', picked === g ? styles.picked : ''].join(' ');
        return (
          <button
            key={g}
            ref={(el) => { refs.current[g] = el; }}
            type="button"
            aria-label={theme.label}
            className={cls}
            style={picked === g && pickedStyle ? (pickedStyle as React.CSSProperties) : undefined}
            onClick={() => onPick(g)}
            onKeyDown={(e) => onKey(e, g)}
          >
            <span className={styles.ring}>
              <Pic src={VISITOR_HEAD[g]} alt="" width={320} height={320} />
            </span>
            <span className={styles.lbl} aria-hidden="true">{theme.icon} {theme.label}</span>
          </button>
        );
      })}
    </div>
  );
}
