'use client';

import { mediaUrl } from '@/lib/media';
import { GENDER_THEME } from '@/lib/childTheme';
import type { Child } from '@/lib/children';
import { Pic } from '@/components/Pic';
import styles from './play.module.css';

/** One child on the picker (KU9): gender color, avatar (or the name's initial) and the display name. */
export default function ChildPickCard({ child, onPick, size = 'large' }: { child: Child; onPick(): void; size?: 'large' | 'small' }) {
  const theme = GENDER_THEME[child.gender];
  const src = mediaUrl(child.avatar_path);
  const name = child.display_name.trim();
  return (
    <button
      type="button"
      data-pick-card
      data-child-id={child.id}
      data-size={size}
      data-gender={child.gender}
      className={`hm-tap ${styles.card} ${size === 'large' ? styles.cardLarge : styles.cardSmall}`}
      aria-label={name}
      onClick={onPick}
      style={{ background: theme.bg, borderColor: theme.accent, color: theme.text }}
    >
      <span className={styles.avatar} style={{ color: theme.text }} aria-hidden="true">
        {src ? <Pic src={src} alt="" /> : [...name][0]?.toUpperCase()}
      </span>
      <span className={styles.name}>{name}</span>
    </button>
  );
}
