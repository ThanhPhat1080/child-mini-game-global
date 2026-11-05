'use client';

import { useEffect, useRef, useState } from 'react';
import { POLICY_SLIDES } from '@/lib/policy/slides';
import admin from '@/app/admin/admin.module.css';
import styles from './auth.module.css';
import { ModalClose } from '@/components/ModalClose';

type Props = { open: boolean; onClose(): void; onAccept(): void };

const LAST = POLICY_SLIDES.length - 1;

/** Content-policy modal (spec 5.2). Mounted only while open, so state resets on every open. */
export default function PolicyCarousel({ open, onClose, onAccept }: Props) {
  if (!open) return null;
  return <CarouselDialog onClose={onClose} onAccept={onAccept} />;
}

function CarouselDialog({ onClose, onAccept }: Omit<Props, 'open'>) {
  const [index, setIndex] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  function go(to: number) {
    if (to < 0 || to > LAST || to > furthest + 1) return;
    setIndex(to);
    setFurthest((f) => Math.max(f, to));
  }

  // Remember the opener (read during the first render, before focus moves) and restore it on unmount.
  const openerRef = useRef<Element | null>(typeof document === 'undefined' ? null : document.activeElement);

  useEffect(() => {
    const opener = openerRef.current;
    dialogRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  // Escape and Tab handling live on the document so they work even when focus is outside the dialog.
  useEffect(() => {
    function onDocKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const items = Array.from(
        root.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      );
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
    document.addEventListener('keydown', onDocKeyDown);
    return () => document.removeEventListener('keydown', onDocKeyDown);
  }, [onClose]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(index + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(index - 1);
    }
  }

  const slide = POLICY_SLIDES[index];
  const lastShown = furthest >= LAST;

  return (
    <div className={styles.backdrop}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="policy-title"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className={styles.top}>
          <h2 id="policy-title">Content rules · Quy định nội dung</h2>
          <ModalClose onClick={onClose} />
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.art} src={slide.image} alt="" />
        <div>
          <p className={styles.vi}>{slide.vi}</p>
          <p className={styles.en}>{slide.en}</p>
        </div>

        <div className={styles.dots}>
          {POLICY_SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.dot} ${i === index ? styles.dotOn : ''}`}
              aria-label={`Slide ${i + 1}`}
              aria-current={i === index ? 'true' : undefined}
              disabled={i > furthest}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <p className={styles.count}>
          <span data-testid="slide-index">{index + 1}</span> / {POLICY_SLIDES.length}
        </p>

        <div className={styles.nav}>
          <button type="button" className={`${admin.ghost} ${admin.modalBtn}`} disabled={index === 0} onClick={() => go(index - 1)}>Back</button>
          <div className={styles.navEnd}>
            <button type="button" className={`${admin.ghost} ${admin.modalBtn}`} disabled={index === LAST} onClick={() => go(index + 1)}>Next</button>
            <button type="button" className={`${admin.primary} ${admin.modalBtn}`} disabled={!lastShown} onClick={onAccept}>Register</button>
          </div>
        </div>
      </div>
    </div>
  );
}
