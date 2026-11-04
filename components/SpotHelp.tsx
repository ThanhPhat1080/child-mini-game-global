'use client';

import type { ReactNode } from 'react';
import { GameHelp, BUTTER, ROSE, SKY, type Slide } from '@/components/GameHelp';

/** A small picture: a pastel scene of a sun and a hill. `extra` adds the thing that differs. */
function Pic({ ring = SKY, extra, ripple }: { ring?: string; extra?: ReactNode; ripple?: boolean }) {
  return (
    <span style={{ position: 'relative', width: 230, height: 170, borderRadius: 32, background: '#E3EEF7', border: `8px solid ${ring}`, boxSizing: 'border-box', overflow: 'hidden', display: 'block' }}>
      <svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 100 74" style={{ display: 'block' }}>
        <circle cx="24" cy="20" r="9" fill={BUTTER} />
        <path d="M0 74V52q22-18 46-6t54-4v32z" fill="#BFDCC4" />
        {extra}
      </svg>
      {ripple && <span style={{ position: 'absolute', left: 120, top: 60, width: 56, height: 56, borderRadius: 28, border: `6px solid ${ROSE}`, boxSizing: 'border-box' }} />}
    </span>
  );
}

const flower = <circle cx="72" cy="34" r="7" fill="#E5555F" />;
const row = { display: 'flex', gap: 40, alignItems: 'center' } as const;

const SLIDES: Slide[] = [
  {
    title: 'What is Spot the Differences?',
    text: 'A calm picture game. Two pictures look almost the same. Look at both and find what is different. No timer and no penalties, just slow and gentle play.',
    art: (
      <span style={row}>
        <Pic />
        <Pic extra={flower} />
      </span>
    ),
  },
  {
    title: 'Tap a difference',
    text: 'Tap the spot that is different, on either picture. A tap in the wrong place only makes a soft ripple, so you can try again.',
    art: (
      <span style={row}>
        <Pic />
        <Pic extra={flower} ripple />
      </span>
    ),
  },
  {
    title: 'Find them all',
    text: 'A circle stays on every difference you find, and a dot above the pictures lights up. Find them all to see the celebration.',
    art: (
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <span style={{ display: 'flex', gap: 20 }}>
          {[0, 1, 2].map((k) => <span key={k} style={{ width: 34, height: 34, borderRadius: 17, background: k < 2 ? BUTTER : '#fff', border: `5px solid ${BUTTER}`, boxSizing: 'border-box' }} />)}
        </span>
        <span style={row}>
          <Pic ring={BUTTER} extra={<circle cx="72" cy="34" r="12" fill="none" stroke={BUTTER} strokeWidth="3" />} />
          <Pic ring={BUTTER} extra={<><circle cx="72" cy="34" r="7" fill="#E5555F" /><circle cx="72" cy="34" r="12" fill="none" stroke={BUTTER} strokeWidth="3" /></>} />
        </span>
      </span>
    ),
  },
];

/** Tutorial popup for Spot the Differences, built on the shared GameHelp shell. */
export function SpotHelp({ onClose, playHref = '/games/spot' }: { onClose: () => void; /** Where "Play" goes; null when the popup is already on the level screen, so "Play" just closes it. */ playHref?: string | null }) {
  return <GameHelp label="How to play Spot the Differences" playLabel="Play Spot the Differences" slides={SLIDES} onClose={onClose} playHref={playHref} />;
}
