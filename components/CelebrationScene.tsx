'use client';

import type { ReactNode } from 'react';
import { Hills } from '@/components/Hills';
import { Confetti } from '@/components/Confetti';
import { Pic } from '@/components/Pic';
import { celebrationSlots, useCelebrationPictures, type CelebrationSlot } from '@/lib/celebration';

const STAR = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z';

/** One character of the scene: the child's uploaded picture (swaying) or the built-in prince or princess (floating). */
function Character({ slot, side }: { slot: CelebrationSlot; side: 'left' | 'right' }) {
  const uploaded = slot.kind !== 'default';
  return (
    <div
      className={uploaded ? 'hm-sway' : 'hm-float'}
      data-celebration-picture={slot.kind}
      style={{ position: 'absolute', left: side === 'left' ? 180 : 1400, top: 300, width: 340, height: 600, animationDelay: side === 'right' ? '-2.4s' : undefined }}
    >
      <Pic src={slot.src} alt="" width={340} height={600} style={{ display: 'block', width: 340, height: 600, objectFit: 'contain', objectPosition: 'bottom' }} />
    </div>
  );
}

/**
 * Shared "you did it" scene (Quiz set done, Memory completion, and the other games): hills, confetti, the child's
 * characters (see `celebrationSlots`: the built-in prince or princess, or the parent's pictures), 3 stars, the
 * greeting, an optional extra line and the action buttons. Renders absolutely positioned
 * layers, so place it inside a Stage or another absolutely positioned 1920x1080 container.
 * Sound and keyboard handling stay with the caller.
 */
export function CelebrationScene({ greeting, extra, children }: { greeting: string; extra?: ReactNode; children: ReactNode }) {
  const pics = useCelebrationPictures();
  const slots = pics ? celebrationSlots(pics) : null;
  return (
    <>
      <Hills variant="double" />
      <Confetti count={36} delayStep={0.6} />
      {slots && <Character slot={slots.left} side="left" />}
      {slots?.right && <Character slot={slots.right} side="right" />}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 44, paddingBottom: 60, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: 28 }} role="img" aria-label="3 stars earned">
          {[150, 180, 150].map((w, i) => (
            <svg key={i} aria-hidden="true" width={w} height={w} viewBox="0 0 24 24" fill="#EED79A" stroke="#C9A05A" strokeWidth="1" strokeLinejoin="round" style={i === 1 ? { marginTop: -30 } : undefined}><path d={STAR} /></svg>
          ))}
        </div>
        <h1 style={{ margin: 0, maxWidth: 840, textAlign: 'center', lineHeight: 1.08, fontSize: 96, fontWeight: 600, color: '#B8737B' }}>{greeting}</h1>
        {extra}
        <div style={{ display: 'flex', gap: 56 }}>{children}</div>
      </div>
    </>
  );
}
