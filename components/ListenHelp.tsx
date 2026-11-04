'use client';

import type { ReactNode } from 'react';
import { GameHelp, BUTTER, ROSE, SKY, type Slide } from '@/components/GameHelp';

const speaker = (
  <svg aria-hidden="true" width="70" height="70" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H3v6h3l5 4z" fill="#fff" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></svg>
);

const apple = <span style={{ width: 56, height: 56, borderRadius: 28, background: '#E5555F' }} />;
const square = <span style={{ width: 52, height: 52, borderRadius: 10, background: '#4F7A9E' }} />;

function Tile({ ring, tapped, children }: { ring: string; tapped?: boolean; children: ReactNode }) {
  return (
    <span style={{ width: 130, height: 150, borderRadius: 28, background: '#fff', border: `8px solid ${ring}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: tapped ? `0 0 0 10px #fff, 0 0 0 16px ${ring}` : 'none' }}>{children}</span>
  );
}

const bigSpeaker = (
  <span style={{ width: 130, height: 130, borderRadius: 65, background: ROSE, boxShadow: '0 10px 0 #D9A0A6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{speaker}</span>
);

const star = (
  <svg aria-hidden="true" width="120" height="120" viewBox="0 0 24 24" fill={BUTTER} stroke="#C9A05A" strokeWidth="1" strokeLinejoin="round"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" /></svg>
);

const SLIDES: Slide[] = [
  {
    title: 'Listen',
    text: 'Tap the speaker to hear a word.',
    art: bigSpeaker,
  },
  {
    title: 'Pick',
    text: 'Tap the picture that matches the word.',
    art: (
      <span style={{ display: 'flex', alignItems: 'flex-end', gap: 24 }}>
        <Tile ring={ROSE}>{square}</Tile>
        <Tile ring={SKY} tapped>{apple}</Tile>
        <Tile ring={BUTTER}>{square}</Tile>
      </span>
    ),
  },
  {
    title: 'Hooray!',
    text: 'A right pick says Hooray, then comes the next word.',
    art: (
      <span style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
        <Tile ring={BUTTER}>{apple}</Tile>
        {star}
        {bigSpeaker}
      </span>
    ),
  },
];

/** Tutorial popup for Listen & Pick, built on the shared GameHelp shell. */
export function ListenHelp({ onClose, playHref = '/games/listen' }: { onClose: () => void; /** Where "Play" goes; null when the popup is already on the game's screen, so "Play" just closes it. */ playHref?: string | null }) {
  return <GameHelp label="How to play Listen & Pick" playLabel="Play Listen & Pick" slides={SLIDES} onClose={onClose} playHref={playHref} />;
}
