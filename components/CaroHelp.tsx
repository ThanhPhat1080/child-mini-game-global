'use client';

import { GameHelp, ROSE, SKY, type Slide } from '@/components/GameHelp';
import { CaroMark } from '@/components/caro/CaroMark';
import { CARO_TEAL } from '@/components/games/GameArt';

/** A small piece of the board: a square with a mark in it. */
function Square({ mark, win }: { mark?: 'X' | 'O'; win?: boolean }) {
  return (
    <span style={{ width: 88, height: 88, borderRadius: 18, background: win ? '#F6E2A6' : '#F7F1E8', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
      {mark && <CaroMark player={mark} size={62} />}
    </span>
  );
}

const SLIDES: Slide[] = [
  {
    title: 'What is Caro?',
    text: 'A board game for two. Put five of your marks in a row: across, down, or on a slant. X is blue and O is red.',
    art: (
      <span style={{ display: 'flex', gap: 10 }}>
        {(['O', 'X', 'O', 'X', 'O'] as const).map((m, i) => <Square key={i} mark={m} />)}
      </span>
    ),
  },
  {
    title: 'Take turns',
    text: 'Blue X starts. Then the other player takes a turn. Tap an empty square. The one whose turn it is bounces, and its mark wiggles.',
    art: (
      <span style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <span style={{ width: 150, height: 150, borderRadius: 75, background: '#fff', border: `8px solid ${SKY}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CaroMark player="X" size={96} />
        </span>
        <span style={{ fontSize: 56, color: CARO_TEAL, fontWeight: 700 }} aria-hidden="true">→</span>
        <span style={{ width: 150, height: 150, borderRadius: 75, background: '#fff', border: `8px solid ${ROSE}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CaroMark player="O" size={96} />
        </span>
      </span>
    ),
  },
  {
    title: 'Five in a row!',
    text: 'Five in a row wins, and the winning marks light up. No timer and no penalties: when the board is full, just start again.',
    art: (
      <span style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 88px)', gap: 10 }}>
        <Square mark="O" />
        <Square mark="X" win />
        <Square mark="O" />
        <Square mark="X" win />
        <Square mark="X" win />
        <Square mark="O" />
        <Square mark="O" />
        <Square mark="X" />
        <Square mark="O" />
      </span>
    ),
  },
];

/** Tutorial popup for Caro X O, built on the shared GameHelp shell. */
export function CaroHelp({ onClose, playHref = '/games/caro' }: { onClose: () => void; /** Where "Play" goes; null when the popup is already on the game's screen, so "Play" just closes it. */ playHref?: string | null }) {
  return <GameHelp label="How to play Caro" playLabel="Play Caro" slides={SLIDES} onClose={onClose} playHref={playHref} />;
}
