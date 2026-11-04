'use client';

import type { ReactNode } from 'react';
import { GameHelp, BUTTER, ROSE, SKY, type Slide } from '@/components/GameHelp';

const PINK = '#F8DCDF';

/** The pink card back with a small white flower, like FlowerBack on the real cards. */
function Back() {
  return (
    <svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 100 100" style={{ display: 'block' }}>
      <rect width="100" height="100" fill={PINK} />
      <g transform="translate(50 50)">
        {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy="-8" rx="5" ry="8" fill="#fff" transform={`rotate(${a})`} />)}
        <circle r="4.5" fill={BUTTER} />
      </g>
    </svg>
  );
}

/** A small card: face down shows the flower back, face up shows its picture. */
function Card({ up, ring = ROSE, tapped, children }: { up?: boolean; ring?: string; tapped?: boolean; children?: ReactNode }) {
  return (
    <span style={{ width: 130, height: 150, borderRadius: 28, background: up ? '#fff' : PINK, border: `8px solid ${ring}`, boxSizing: 'border-box', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: tapped ? `0 0 0 10px #fff, 0 0 0 16px ${ring}` : 'none' }}>
      {up ? children : <Back />}
    </span>
  );
}

const apple = <span style={{ width: 56, height: 56, borderRadius: 28, background: '#E5555F' }} />;
const square = <span style={{ width: 52, height: 52, borderRadius: 10, background: '#4F7A9E' }} />;
const row = { display: 'flex', gap: 24, alignItems: 'flex-end' } as const;

const speaker = (
  <svg aria-hidden="true" width="70" height="70" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H3v6h3l5 4z" fill="#fff" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></svg>
);

const SLIDES: Slide[] = [
  {
    title: 'What is Memory Match?',
    text: 'A calm picture game. Flip the cards to find two that match. No timer and no penalties, just slow and gentle play.',
    art: (
      <span style={row}>
        {[0, 1, 2, 3].map((k) => <Card key={k} />)}
      </span>
    ),
  },
  {
    title: 'Flip two cards',
    text: 'Tap a card, or move with the arrow keys and press Enter or Space. Two face-up cards are compared.',
    art: (
      <span style={row}>
        <Card />
        <Card up tapped ring={SKY}>{apple}</Card>
        <Card up tapped ring={SKY}>{square}</Card>
        <Card />
      </span>
    ),
  },
  {
    title: 'Find the pair',
    text: 'Two of the same picture stay open with a happy chime. Different ones flip back gently, so you can try again.',
    art: (
      <span style={{ display: 'flex', alignItems: 'center', gap: 48 }}>
        <span style={row}>
          <Card up ring={BUTTER}>{apple}</Card>
          <Card up ring={BUTTER}>{apple}</Card>
        </span>
        <span style={row}>
          <Card />
          <Card />
        </span>
      </span>
    ),
  },
  {
    title: 'Hear the word',
    text: 'Every pair you find says its English word. Tap an open card to hear it again. Find all the pairs to see the celebration.',
    art: (
      <span style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
        <Card up ring={BUTTER}>{apple}</Card>
        <span style={{ width: 130, height: 130, borderRadius: 65, background: ROSE, boxShadow: '0 10px 0 #D9A0A6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{speaker}</span>
        <svg aria-hidden="true" width="120" height="120" viewBox="0 0 24 24" fill={BUTTER} stroke="#C9A05A" strokeWidth="1" strokeLinejoin="round"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" /></svg>
      </span>
    ),
  },
];

/** Tutorial popup for Memory Match, built on the shared GameHelp shell. */
export function MemoryHelp({ onClose, playHref = '/games/memory' }: { onClose: () => void; /** Where "Play" goes; null when the popup is already on the level screen, so "Play" just closes it. */ playHref?: string | null }) {
  return <GameHelp label="How to play Memory Match" playLabel="Play Memory Match" slides={SLIDES} onClose={onClose} playHref={playHref} />;
}
