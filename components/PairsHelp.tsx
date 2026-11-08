'use client';

import { GameHelp, BUTTER, ROSE, type Slide } from '@/components/GameHelp';
import { PairsHalves } from '@/components/pairs/PairsArt';

const speaker = (
  <svg aria-hidden="true" width="70" height="70" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H3v6h3l5 4z" fill="#fff" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></svg>
);

/** A face-down half: the peach back with its pale "?" circle. */
const peachBack = (
  <span aria-hidden="true" style={{ width: 130, height: 150, borderRadius: 28, background: '#F5D9C4', border: '8px solid #fff', boxSizing: 'border-box', boxShadow: '0 8px 0 #E3CFC0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <span style={{ width: 84, height: 84, borderRadius: 42, background: 'rgba(255,255,255,.6)', color: '#E9B99A', fontSize: 60, fontWeight: 800, lineHeight: '84px', textAlign: 'center' }}>?</span>
  </span>
);

const bigSpeaker = (
  <span aria-hidden="true" style={{ width: 130, height: 130, borderRadius: 65, background: ROSE, boxShadow: '0 10px 0 #D9A0A6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{speaker}</span>
);

const star = (
  <svg aria-hidden="true" width="120" height="120" viewBox="0 0 24 24" fill={BUTTER} stroke="#C9A05A" strokeWidth="1" strokeLinejoin="round"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" /></svg>
);

const SLIDES: Slide[] = [
  {
    title: 'Answer',
    text: 'Tap a hidden piece and answer the question.',
    art: (
      <span style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
        {peachBack}
        {bigSpeaker}
      </span>
    ),
  },
  {
    title: 'Match',
    text: 'Drag a half onto its other half.',
    art: <PairsHalves width={220} />,
  },
  {
    title: 'Done',
    text: 'Find all four pictures!',
    art: star,
  },
];

/** Tutorial popup for Puzzle Pairs, built on the shared GameHelp shell. */
export function PairsHelp({ onClose, playHref = '/games/pairs' }: { onClose: () => void; /** Where "Play" goes; null when the popup is already on the game's screen, so "Play" just closes it. */ playHref?: string | null }) {
  return <GameHelp label="How to play Puzzle Pairs" playLabel="Play Puzzle Pairs" slides={SLIDES} onClose={onClose} playHref={playHref} />;
}
