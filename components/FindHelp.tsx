'use client';

import type { ReactNode } from 'react';
import { GameHelp, BUTTER, ROSE, SKY, type Slide } from '@/components/GameHelp';
import { FIND_PEACH } from '@/components/games/GameArt';

/** A small picture frame in the Find It peach, with a scene of a sun and a hill. `extra` adds the things to find. */
function Pic({ extra }: { extra?: ReactNode }) {
  return (
    <span style={{ position: 'relative', width: 260, height: 190, borderRadius: 32, background: '#F6E6D8', border: `8px solid ${FIND_PEACH}`, boxSizing: 'border-box', overflow: 'hidden', display: 'block' }}>
      <svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 100 74" style={{ display: 'block' }}>
        <circle cx="24" cy="20" r="9" fill={BUTTER} />
        <path d="M0 74V52q22-18 46-6t54-4v32z" fill="#BFDCC4" />
        {extra}
      </svg>
    </span>
  );
}

const flower = <circle cx="72" cy="34" r="7" fill="#E5555F" />;
const row = { display: 'flex', gap: 40, alignItems: 'center' } as const;

const SLIDES: Slide[] = [
  {
    title: 'What is Find It?',
    text: 'A calm picture game. One big picture is shown, and one thing at a time is named. Look for it and tap it. No timer and no penalties, just slow and gentle play.',
    art: <Pic extra={flower} />,
  },
  {
    title: 'Listen and look',
    text: 'Listen to the name, then tap that thing in the picture. A tap somewhere else only makes a soft ripple, so you can try again.',
    art: (
      <span style={row}>
        <span style={{ width: 96, height: 96, borderRadius: 48, background: '#FFFFFF', border: `6px solid ${SKY}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg aria-hidden="true" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke={FIND_PEACH} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9.5h3l4.5-3.5v12L7 14.5H4z" fill="#F0ECF8" /><path d="M15 9.5a3.5 3.5 0 0 1 0 5" /></svg>
        </span>
        <Pic extra={<circle cx="72" cy="34" r="12" fill="none" stroke={ROSE} strokeWidth="3" />} />
      </span>
    ),
  },
  {
    title: 'Find them all',
    text: 'Each thing you find gets a circle, and a dot above the picture lights up. Find them all, in order, to see the celebration.',
    art: (
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <span style={{ display: 'flex', gap: 20 }}>
          {[0, 1, 2].map((k) => <span key={k} style={{ width: 34, height: 34, borderRadius: 17, background: k < 2 ? FIND_PEACH : '#fff', border: `5px solid ${FIND_PEACH}`, boxSizing: 'border-box' }} />)}
        </span>
        <Pic extra={<><circle cx="72" cy="34" r="7" fill="#E5555F" /><circle cx="72" cy="34" r="12" fill="none" stroke={BUTTER} strokeWidth="3" /></>} />
      </span>
    ),
  },
];

/** Tutorial popup for Find It, built on the shared GameHelp shell. */
export function FindHelp({ onClose, playHref = '/games/find' }: { onClose: () => void; /** Where "Play" goes; null when the popup is already on the level screen, so "Play" just closes it. */ playHref?: string | null }) {
  return <GameHelp label="How to play Find It" playLabel="Play Find It" slides={SLIDES} onClose={onClose} playHref={playHref} />;
}
