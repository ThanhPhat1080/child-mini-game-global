'use client';

import { useEffect, useRef } from 'react';
import { Confetti } from '@/components/Confetti';
import { Pic } from '@/components/Pic';
import { stepFocus } from '@/lib/keynav';

/** How long the Hooray screen stays before the board is shown again (the win line stays lit). */
export const HOORAY_MS = 3000;
/** How long the Oh-oh toast stays before the "Let's try again?" popup opens. */
export const OHOH_MS = 1400;

/** A child wins: the full-screen Hooray of the quiz, with a star, confetti and no buttons. */
export function CaroHooray() {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(251,244,233,0.78)', overflow: 'hidden', pointerEvents: 'none' }}>
      <span className="hm-flash" aria-hidden="true" style={{ position: 'absolute', left: 560, top: 140, width: 800, height: 800, borderRadius: 400, background: 'radial-gradient(circle, rgba(246,226,166,0.9) 0%, rgba(246,226,166,0) 68%)' }} />
      <Confetti count={56} />
      <div role="status" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30 }}>
        <svg className="hm-pop" aria-hidden="true" width="240" height="240" viewBox="0 0 24 24" fill="#EED79A" stroke="#C9A05A" strokeWidth="1" strokeLinejoin="round">
          <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" />
        </svg>
        <span className="hm-pop" style={{ fontSize: 140, fontWeight: 700, color: '#B8737B', lineHeight: 1 }}>Hooray!</span>
      </div>
    </div>
  );
}

/** The opponent wins: a small white pill with a soft face and "Oh-oh… try again!", as in Sort It. */
export function CaroOhOh() {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div role="status" className="hm-rise" style={{ display: 'flex', alignItems: 'center', gap: 28, padding: '36px 64px 36px 40px', borderRadius: 80, background: '#fff', boxShadow: '0 12px 0 #EADCC8' }}>
        <svg aria-hidden="true" width="110" height="110" viewBox="0 0 24 24" fill="none" stroke="#B8737B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" fill="#F8DCDF" />
          <path d="M8.5 15.5c1-1 2.2-1.4 3.5-1.4s2.5.4 3.5 1.4" />
          <path d="M8.5 9.2h.01M15.5 9.2h.01" strokeWidth="2.6" />
        </svg>
        <span style={{ fontSize: 80, fontWeight: 600, color: '#8A6A5E' }}>Oh-oh… try again!</span>
      </div>
    </div>
  );
}

/**
 * "Let's try again?" after the toast: the board is covered by a blurred backdrop, the child's round avatar sits in
 * the middle, and two choices: Yes plays again, No goes back to the game list. Arrow keys move between them.
 */
export function CaroRetry({ avatar, onYes, onNo }: { avatar: string; onYes: () => void; onNo: () => void }) {
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => { row.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, []);

  const choice = (label: string, onClick: () => void, bg: string, shadow: string, icon: React.ReactNode) => (
    <button
      type="button"
      className="hm-tap"
      aria-label={label}
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 16, height: 120, minWidth: 260, padding: '0 44px', borderRadius: 60, border: 'none', background: bg, boxShadow: `0 8px 0 ${shadow}`, color: '#fff', fontSize: 52, fontWeight: 700, fontFamily: 'inherit', justifyContent: 'center' }}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(90,64,56,0.22)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Let's try again?"
        className="hm-pop"
        style={{ width: 640, boxSizing: 'border-box', padding: '48px 56px 56px', borderRadius: 72, background: '#fff', border: '14px solid #EBB7BC', boxShadow: '0 20px 0 #E3CFC0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 36 }}
      >
        <span style={{ width: 240, height: 240, borderRadius: 120, overflow: 'hidden', border: '8px solid #F5D9C4', boxSizing: 'border-box', background: '#F5D9C4', display: 'block' }}>
          <Pic src={avatar} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </span>
        <h2 style={{ margin: 0, fontSize: 64, fontWeight: 700, color: '#B8737B', lineHeight: 1.05, textAlign: 'center' }}>Let&apos;s try again?</h2>
        <div
          ref={row}
          role="group"
          aria-label="Choose"
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              stepFocus(Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button')), e.key === 'ArrowRight' ? 1 : -1);
            }
          }}
          style={{ display: 'flex', gap: 28, justifyContent: 'center' }}
        >
          {choice('Yes', onYes, '#7FB48C', '#5E8F69', (
            <svg aria-hidden="true" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          ))}
          {choice('No', onNo, '#D98C94', '#B8636C', (
            <svg aria-hidden="true" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          ))}
        </div>
      </div>
    </div>
  );
}
