'use client';

import { useMemo, useRef, useState } from 'react';
import { Stage } from '@/components/Stage';
import { Hills } from '@/components/Hills';
import { BackButton } from '@/components/BackButton';
import { MusicButton } from '@/components/MusicButton';
import { CaroMark, markColor } from '@/components/caro/CaroMark';
import { gridStep } from '@/lib/keynav';
import { emptyBoard, place, roundState, turnOf, type Board, type Player } from '@/lib/caro/rules';
import { applause, chime } from '@/lib/sfx';

const CELL = 270;
const GAP = 22;
const BOARD = CELL * 3 + GAP * 2;

/** Caro X O for two players on one computer (X1-X8). Turns alternate; no timer, no penalty, no text. */
export default function CaroPlay() {
  const [board, setBoard] = useState<Board>(emptyBoard);
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const state = useMemo(() => roundState(board), [board]);
  const turn: Player = turnOf(board);
  const over = state.status !== 'playing';
  const won = new Set(state.line ?? []);

  function press(i: number) {
    const next = place(board, i);
    if (!next) return;
    setBoard(next);
    if (roundState(next).status === 'won') applause(2);
    else chime();
  }

  const chip = (p: Player, label: string) => {
    const active = !over && turn === p;
    return (
      <div
        aria-label={label}
        aria-current={active ? 'true' : undefined}
        style={{
          width: 200, height: 130, borderRadius: 40, background: '#fff', boxSizing: 'border-box',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: active ? `0 0 0 10px ${markColor(p)}55, 0 8px 0 #EADCC8` : '0 6px 0 #EADCC8',
          transform: active ? 'scale(1.12)' : 'scale(1)', transition: 'transform .4s ease, box-shadow .4s ease',
        }}
      >
        <CaroMark player={p} size={96} />
      </div>
    );
  };

  return (
    <Stage>
      <style>{`
        @keyframes caroWin { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        .caro-win { animation: caroWin 1.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .caro-win { animation: none; } }
        .caro-cell:focus-visible { outline: 8px solid #E59AA1; outline-offset: 4px; }
      `}</style>
      <Hills />
      <div style={{ position: 'absolute', top: 40, left: 56 }}>
        <BackButton href="/games" label="Back to games" />
      </div>
      <div style={{ position: 'absolute', top: 44, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 80 }}>
        {chip('X', 'X player')}
        {chip('O', 'O player')}
      </div>

      <div
        aria-label="Caro board"
        onKeyDown={(e) => { gridStep(cells.current.filter((c): c is HTMLButtonElement => !!c), 3, e); }}
        style={{
          position: 'absolute', top: 200, left: (1920 - BOARD) / 2, width: BOARD, height: BOARD,
          display: 'grid', gridTemplateColumns: `repeat(3, ${CELL}px)`, gridTemplateRows: `repeat(3, ${CELL}px)`, gap: GAP,
        }}
      >
        {board.map((cell, i) => {
          const winning = won.has(i);
          return (
            <button
              key={i}
              ref={(el) => { cells.current[i] = el; }}
              type="button"
              className={`caro-cell${winning ? ' caro-win' : ''}`}
              aria-label={cell ? `Square ${i + 1}, ${cell}` : `Square ${i + 1}, empty`}
              onClick={() => press(i)}
              style={{
                width: CELL, height: CELL, borderRadius: 44, border: 'none', padding: 0, cursor: cell || over ? 'default' : 'pointer',
                background: winning ? '#F6E2A6' : '#fff', boxShadow: '0 10px 0 #EADCC8', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {cell && <CaroMark player={cell} size={190} />}
            </button>
          );
        })}
      </div>

      {over && (
        <button
          type="button"
          aria-label="Play again"
          className="hm-tap"
          onClick={() => setBoard(emptyBoard())}
          style={{ position: 'absolute', right: 56, top: 480, width: 150, height: 150, borderRadius: 75, border: 'none', background: '#fff', boxShadow: '0 8px 0 #EADCC8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg aria-hidden="true" width="84" height="84" viewBox="0 0 24 24" fill="none" stroke="#7A5C50" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" />
          </svg>
        </button>
      )}
      <MusicButton />
    </Stage>
  );
}
