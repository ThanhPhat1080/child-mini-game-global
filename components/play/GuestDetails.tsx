'use client';

import type { FormEvent } from 'react';
import type { AgeBand, Gender } from '@/lib/childTheme';
import { AgeSwitch } from '@/components/play/AgeSwitch';
import styles from '@/app/play/guest/guest.module.css';

/** The grown-up details step (GU4): name, age, OK. The X returns to Boy or Girl and keeps the name. */
export function GuestDetails({ gender, name, ageBand, valid, onName, onAge, onClose, onSubmit }: {
  gender: Gender;
  name: string;
  ageBand: AgeBand;
  valid: boolean;
  onName(v: string): void;
  onAge(v: AgeBand): void;
  onClose(): void;
  onSubmit(): void;
}) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (valid) onSubmit();
  }
  return (
    <form className={`${styles.form} ${gender === 'female' ? styles.formGirl : ''}`} onSubmit={submit} noValidate>
      <h2 className={gender === 'female' ? styles.hiGirl : styles.hiBoy}>{gender === 'female' ? 'Hi, Princess' : 'Hi, Prince'}</h2>
      <button type="button" className={styles.closeX} aria-label="Close" onClick={onClose}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <label htmlFor="guest-name" className={styles.label}>Child&apos;s name</label>
      <input
        id="guest-name"
        className={styles.input}
        type="text"
        maxLength={40}
        autoComplete="off"
        autoFocus
        value={name}
        onChange={(e) => onName(e.target.value)}
      />
      <p className={styles.hint}>1-20 characters</p>
      <span className={styles.label}>Age</span>
      <AgeSwitch value={ageBand} onChange={onAge} />
      <button type="submit" className={styles.ok} disabled={!valid}>Play now!</button>
    </form>
  );
}
