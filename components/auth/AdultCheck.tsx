'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import admin from '@/app/admin/admin.module.css';
import styles from './auth.module.css';
import type { ReactNode } from 'react';
import { ModalClose } from '@/components/ModalClose';

type Props = { open: boolean; onPass(): void; onCancel(): void; random?: () => number; title?: string; icon?: ReactNode; hint?: string; centered?: boolean; submitLabel?: string };

/** Two integers in 6..9, so the sum is 12..18: out of reach for a 4-5 year old. */
function pick(random: () => number): [number, number] {
  const n = () => 6 + Math.min(3, Math.floor(random() * 4));
  return [n(), n()];
}

/** Grown-up check (U10): "a + b = ?". Mounted only while open, so state resets on every open. */
export default function AdultCheck({ open, onPass, onCancel, random = Math.random, title = 'Grown-ups only', icon, hint, centered = false, submitLabel = 'OK' }: Props) {
  if (!open) return null;
  return <CheckDialog onPass={onPass} onCancel={onCancel} random={random} title={title} icon={icon} hint={hint} centered={centered} submitLabel={submitLabel} />;
}

function CheckDialog({ onPass, onCancel, random, title, icon, hint, centered, submitLabel }: Omit<Props, 'open'> & { random: () => number; title: string; centered: boolean; submitLabel: string }) {
  const [nums, setNums] = useState<[number, number]>(() => pick(random));
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openerRef = useRef<Element | null>(typeof document === 'undefined' ? null : document.activeElement);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    const opener = openerRef.current;
    inputRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    function onDocKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCancelRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      event.stopPropagation();
      const items = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (items.length === 0) {
        event.preventDefault();
        root.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!root.contains(active) || active === root) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener('keydown', onDocKeyDown, true);
    return () => window.removeEventListener('keydown', onDocKeyDown, true);
  }, []);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (value.trim() === String(nums[0] + nums[1])) {
      onPass();
      return;
    }
    setWrong(true);
    setValue('');
    setNums(pick(random));
    inputRef.current?.focus();
  }

  return (
    <div className={styles.backdrop}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="adult-title"
        tabIndex={-1}
        style={centered ? { alignItems: 'center', textAlign: 'center' } : undefined}
      >
        <ModalClose onClick={onCancel} />
        {icon}
        <h2 id="adult-title" style={{ margin: 0, fontSize: centered ? 32 : 20 }}>{title}</h2>
        {hint && <p className={styles.hint}>{hint}</p>}
        <form onSubmit={onSubmit} className={styles.adultForm} noValidate style={centered ? { width: '100%' } : undefined}>
          <p className={styles.adultQ} data-testid="adult-question">{nums[0]} + {nums[1]} = ?</p>
          <input
            ref={inputRef}
            className={`${admin.input} ${wrong ? styles.shake : ''}`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            aria-label="Answer"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 3))}
          />
          {wrong && <p role="status" className={admin.error}>Not quite. Try this one.</p>}
          <div className={styles.navEnd} style={{ justifyContent: centered ? 'center' : 'flex-end' }}>
            <button type="button" className={`${admin.ghost} ${admin.modalBtn}`} onClick={onCancel}>Cancel</button>
            <button type="submit" className={`${admin.primary} ${admin.modalBtn}`}>{submitLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
