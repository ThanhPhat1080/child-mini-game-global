'use client';

import type { ReactNode } from 'react';
import { Hills } from '@/components/Hills';
import { Confetti } from '@/components/Confetti';
import { Pic } from '@/components/Pic';
import { useCelebrationPictures } from '@/lib/celebration';

const STAR = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z';

/**
 * Shared "you did it" scene (Quiz set done, Memory completion): hills, confetti, both characters,
 * 3 stars (the two characters are the child's own pictures when the parent uploaded them, swaying gently), the greeting, an optional extra line and the action buttons. Renders absolutely positioned
 * layers, so place it inside a Stage or another absolutely positioned 1920x1080 container.
 * Sound and keyboard handling stay with the caller.
 */
export function CelebrationScene({ greeting, extra, children }: { greeting: string; extra?: ReactNode; children: ReactNode }) {
  const pics = useCelebrationPictures();
  return (
    <>
      <Hills variant="double" />
      <Confetti count={36} delayStep={0.6} />
      {pics.a ? (
        <div className="hm-sway" data-celebration-picture="a" style={{ position: 'absolute', left: 200, top: 340, width: 330, height: 682 }}>
          <Pic src={pics.a} alt="" width={330} height={682} style={{ display: 'block', width: 330, height: 682, objectFit: 'contain', objectPosition: 'bottom' }} />
        </div>
      ) : (
        <div className="hm-float" style={{ position: 'absolute', left: 220, top: 340, width: 289, height: 682 }}>
          <Pic src="/images/girl.webp" alt="" width={289} height={682} style={{ display: 'block', width: 289, height: 682 }} />
        </div>
      )}
      {/* second character on the right (transparent background); floats out of step with the left one */}
      {pics.b ? (
        <div className="hm-sway" data-celebration-picture="b" style={{ position: 'absolute', left: 1360, top: 340, width: 360, height: 682, animationDelay: '-2.4s' }}>
          <Pic src={pics.b} alt="" width={360} height={682} style={{ display: 'block', width: 360, height: 682, objectFit: 'contain', objectPosition: 'bottom' }} />
        </div>
      ) : (
        <div className="hm-float" style={{ position: 'absolute', left: 1378, top: 360, width: 327, height: 650, animationDelay: '-2.2s' }}>
          <Pic src="/images/girl-beret.webp" alt="" width={327} height={650} style={{ display: 'block', width: 327, height: 650 }} />
        </div>
      )}
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
