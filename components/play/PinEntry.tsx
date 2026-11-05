'use client';

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { GENDER_THEME } from '@/lib/childTheme';
import { mediaUrl } from '@/lib/media';
import type { Child } from '@/lib/children';
import { Pic } from '@/components/Pic';
import styles from './play.module.css';

const LEN = 4;
const OK = /^[A-Za-z0-9]$/;
const EMPTY = ['', '', '', ''];

/**
 * Four-box PIN step (K10, KU10). The PIN is compared exactly (case sensitive) once the fourth character is in.
 * A wrong PIN shakes the boxes and clears them; there is never any text (the child cannot read).
 */
export default function PinEntry({ child, onCorrect, onCancel }: { child: Child; onCorrect(): void; onCancel(): void }) {
  const [chars, setChars] = useState<string[]>(EMPTY);
  const [wrong, setWrong] = useState(0);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const theme = GENDER_THEME[child.gender];
  const src = mediaUrl(child.avatar_path);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  // the row remounts on every wrong PIN (to replay the shake), so focus goes back after the remount
  useEffect(() => {
    if (wrong) refs.current[0]?.focus();
  }, [wrong]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onCancelRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function settle(next: string[]) {
    if (next.some((c) => c === '')) {
      setChars(next);
      return;
    }
    if (next.join('') === child.pin) {
      setChars(next);
      onCorrect();
      return;
    }
    setChars(EMPTY);
    setWrong((n) => n + 1);
  }

  function onChange(i: number, raw: string) {
    const c = raw.slice(-1);
    if (c !== '' && !OK.test(c)) return;
    const next = [...chars];
    next[i] = c;
    if (c !== '' && i < LEN - 1) refs.current[i + 1]?.focus();
    settle(next);
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && chars[i] === '' && i > 0) {
      e.preventDefault();
      const next = [...chars];
      next[i - 1] = '';
      setChars(next);
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < LEN - 1) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
    }
  }

  function onPaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = [...e.clipboardData.getData('text')].filter((c) => OK.test(c)).slice(0, LEN - i);
    if (pasted.length === 0) return;
    const next = [...chars];
    pasted.forEach((c, k) => { next[i + k] = c; });
    refs.current[Math.min(i + pasted.length, LEN - 1)]?.focus();
    settle(next);
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.panel} role="group" aria-label={child.display_name} style={{ borderColor: theme.accent, background: theme.bg }}>
        <span className={styles.avatar} aria-hidden="true" style={{ color: theme.text, width: 130, height: 130, fontSize: 72 }}>
          {src ? <Pic src={src} alt="" /> : [...child.display_name.trim()][0]?.toUpperCase()}
        </span>
        <div key={wrong} className={`${styles.row} ${wrong ? styles.wrong : ''}`} data-wrong={wrong ? 'true' : undefined}>
          {chars.map((c, i) => (
            <input
              key={i}
              ref={(el) => { refs.current[i] = el; }}
              className={styles.box}
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={1}
              aria-label={`PIN character ${i + 1}`}
              value={c}
              onChange={(e) => onChange(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              onPaste={(e) => onPaste(i, e)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
