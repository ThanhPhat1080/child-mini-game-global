'use client';

import type { ReactNode } from 'react';
import { GameHelp, BUTTER, ROSE, SKY, type Slide } from '@/components/GameHelp';

const apple = <span style={{ width: 52, height: 52, borderRadius: 26, background: '#E5555F' }} />;
const square = <span style={{ width: 48, height: 48, borderRadius: 10, background: '#4F7A9E' }} />;

function Card({ children, lifted }: { children: ReactNode; lifted?: boolean }) {
  return (
    <span style={{ width: 120, height: 120, borderRadius: 28, background: '#fff', border: '8px solid #EAD9A0', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: lifted ? '0 18px 22px rgba(90,64,56,.3)' : '0 6px 0 #E3CFC0', transform: lifted ? 'scale(1.1)' : undefined }}>{children}</span>
  );
}

function Tray({ tint, ring, children }: { tint: string; ring: string; children?: ReactNode }) {
  return (
    <span style={{ width: 190, height: 130, borderRadius: 36, background: tint, border: `8px solid ${ring}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>{children}</span>
  );
}

const hand = (
  <svg aria-hidden="true" width="64" height="64" viewBox="0 0 24 24" fill="#fff" stroke="#7A5C50" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10l.5-.3a1.5 1.5 0 0 1 2 .8l.5-.2a1.5 1.5 0 0 1 2 1.2V16a5 5 0 0 1-5 5h-1.2a5 5 0 0 1-4-2L4 15.5a1.5 1.5 0 0 1 2.3-1.8L9 15z" /></svg>
);

const star = (
  <svg aria-hidden="true" width="110" height="110" viewBox="0 0 24 24" fill={BUTTER} stroke="#C9A05A" strokeWidth="1" strokeLinejoin="round"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" /></svg>
);

const SLIDES: Slide[] = [
  {
    title: 'Pick up',
    text: 'Pick up an object to hear what it is.',
    art: (
      <span style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <Card lifted>{apple}</Card>
        {hand}
      </span>
    ),
  },
  {
    title: 'Drag',
    text: 'Drag it to the basket with the same kind of things.',
    art: (
      <span style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
        <Tray tint="#FBF3D9" ring="#EAD9A0"><Card>{apple}</Card></Tray>
        <Card lifted>{apple}</Card>
        <Tray tint="#FBE3D6" ring="#EDBFA6"><Card>{square}</Card></Tray>
      </span>
    ),
  },
  {
    title: 'Hooray!',
    text: 'A happy sound means it fits.',
    art: (
      <span style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
        <Tray tint="#FBF3D9" ring="#EAD9A0"><Card>{apple}</Card><Card>{apple}</Card></Tray>
        {star}
        <span style={{ width: 28, height: 28, borderRadius: 14, background: SKY }} />
        <span style={{ width: 20, height: 20, borderRadius: 10, background: ROSE }} />
      </span>
    ),
  },
];

/** Tutorial popup for Sort It, built on the shared GameHelp shell. */
export function SortHelp({ onClose, playHref = '/games/sort' }: { onClose: () => void; /** Where "Play" goes; null when the popup is already on the game's screen, so "Play" just closes it. */ playHref?: string | null }) {
  return <GameHelp label="How to play Sort It" playLabel="Play Sort It" slides={SLIDES} onClose={onClose} playHref={playHref} />;
}
