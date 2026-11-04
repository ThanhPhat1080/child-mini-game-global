'use client';

import type { ReactNode } from 'react';
import { GameHelp, ROSE, SKY, BUTTER, type Slide } from '@/components/GameHelp';

const speaker = (
  <svg aria-hidden="true" width="84" height="84" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H3v6h3l5 4z" fill="#fff" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></svg>
);

/** A small answer card like the ones on the question screen. */
function Mini({ n, bg, ring, ink, children, tapped }: { n: number; bg: string; ring: string; ink: string; children?: ReactNode; tapped?: boolean }) {
  return (
    <span style={{ position: 'relative', width: 170, height: 150, borderRadius: 30, background: bg, border: `8px solid ${ring}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: tapped ? `0 0 0 10px #fff, 0 0 0 16px ${ring}` : 'none' }}>
      <span style={{ position: 'absolute', top: -20, left: -20, width: 50, height: 50, borderRadius: 25, background: ink, color: '#fff', border: '5px solid #fff', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700 }}>{n}</span>
      {children}
    </span>
  );
}

const SLIDES: Slide[] = [
  {
    title: 'What is Quiz?',
    text: 'A calm picture game. The child hears a question, then picks the right picture. No timer and no penalties, just slow and gentle play.',
    art: (
      <span style={{ display: 'flex', gap: 28, alignItems: 'flex-end' }}>
        <Mini n={1} bg="#F8DCDF" ring={ROSE} ink="#C77D85"><span style={{ width: 54, height: 54, borderRadius: 27, background: '#E5555F' }} /></Mini>
        <Mini n={2} bg="#DCE8F1" ring={SKY} ink="#5F86A8"><span style={{ width: 54, height: 54, borderRadius: 10, background: '#4F7A9E' }} /></Mini>
        <Mini n={3} bg="#F7ECCB" ring="#E5C979" ink="#8A6A2A"><span style={{ width: 0, height: 0, borderLeft: '30px solid transparent', borderRight: '30px solid transparent', borderBottom: '54px solid #7FB38A' }} /></Mini>
      </span>
    ),
  },
  {
    title: 'Listen first',
    text: 'Each question is read aloud. Tap the round speaker to hear it again. The answers are read one by one.',
    art: (
      <span style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
        <span style={{ position: 'relative', width: 140, height: 140, borderRadius: 70, background: '#EBB7BC', boxShadow: '0 10px 0 #D9A0A6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{speaker}</span>
        <span style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 90 }} aria-hidden="true">
          {[40, 72, 54, 86, 46, 66, 36].map((h, i) => <i key={i} style={{ display: 'block', width: 16, height: h, borderRadius: 8, background: i % 2 ? '#F0C9CD' : ROSE }} />)}
        </span>
      </span>
    ),
  },
  {
    title: 'Pick an answer',
    text: 'Tap a card, or press 1, 2 or 3 on the keyboard. A right answer makes a happy hooray. A wrong one makes a soft “oh-oh” and you try again.',
    art: (
      <span style={{ display: 'flex', gap: 28, alignItems: 'flex-end' }}>
        <Mini n={1} bg="#F8DCDF" ring={ROSE} ink="#C77D85" tapped><span style={{ width: 54, height: 54, borderRadius: 27, background: '#E5555F' }} /></Mini>
        <Mini n={2} bg="#DCE8F1" ring={SKY} ink="#5F86A8"><span style={{ width: 54, height: 54, borderRadius: 10, background: '#4F7A9E' }} /></Mini>
        <Mini n={3} bg="#F7ECCB" ring="#E5C979" ink="#8A6A2A"><span style={{ width: 0, height: 0, borderLeft: '30px solid transparent', borderRight: '30px solid transparent', borderBottom: '54px solid #7FB38A' }} /></Mini>
      </span>
    ),
  },
  {
    title: 'Fill the dots',
    text: 'Every right answer turns a dot yellow. Tap a dot to jump to a question. Finish all of them to earn the stars. Progress is kept on this device.',
    art: (
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
        <span style={{ display: 'flex', gap: 16 }} aria-hidden="true">
          {[true, true, true, false, false].map((done, i) => (
            <span key={i} style={{ width: 52, height: 52, borderRadius: 26, boxSizing: 'border-box', border: '7px solid', background: done ? BUTTER : '#F1E7DA', borderColor: done ? '#E5C979' : i === 3 ? '#E59AA1' : '#D9C9B6' }} />
          ))}
        </span>
        <span style={{ display: 'flex', gap: 14 }} aria-hidden="true">
          {[1, 1.25, 1].map((k, i) => (
            <svg key={i} width={72 * k} height={72 * k} viewBox="0 0 24 24" fill={BUTTER} stroke="#C9A05A" strokeWidth="1" strokeLinejoin="round"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" /></svg>
          ))}
        </span>
      </span>
    ),
  },
];

/** Tutorial popup for the Quiz game: a short description plus a carousel of steps. */
export function QuizHelp({ onClose, playHref = '/games/quiz' }: { onClose: () => void; /** Where "Play" goes; null when the popup is already on the quiz list, so "Play" just closes it. */ playHref?: string | null }) {
  return <GameHelp label="How to play Quiz" playLabel="Play Quiz" slides={SLIDES} onClose={onClose} playHref={playHref} />;
}
