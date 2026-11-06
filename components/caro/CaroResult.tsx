'use client';

import { Confetti } from '@/components/Confetti';
import { Pic } from '@/components/Pic';

/** After the winning mark, the board waits this long (the win line is already lit) before Hooray or Oh-oh comes. */
export const RESULT_DELAY_MS = 1000;
/** How long the Hooray screen stays before the board is shown again (the win line stays lit). */
export const HOORAY_MS = 3000;
/** How long the Oh-oh toast stays before the board is shown again. */
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
