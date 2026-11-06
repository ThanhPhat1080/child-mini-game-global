'use client';

import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Stage } from '@/components/Stage';
import { Hills } from '@/components/Hills';
import { BackButton } from '@/components/BackButton';
import { MusicButton } from '@/components/MusicButton';
import { CaroMark, markColor } from '@/components/caro/CaroMark';
import { gridStep } from '@/lib/keynav';
import { CELLS, COLS, ROWS, emptyBoard, place, roundState, turnOf, type Board, type Player } from '@/lib/caro/rules';
import { applause, chime } from '@/lib/sfx';

/** One cell and the gap between cells, in stage pixels. A 20x20 board fits the 1920x1080 stage at these sizes. */
const CELL = 40;
const GAP = 2;
const PAD = 10;
const BOARD_W = COLS * CELL + (COLS - 1) * GAP + PAD * 2;
const BOARD_H = ROWS * CELL + (ROWS - 1) * GAP + PAD * 2;

/**
 * One cell. Memoised: a move re-renders only the cell it changed, not all 1800 of them.
 * Keyboard focus moves by DOM order inside the board (gridStep), so the cell needs no ref.
 */
const Cell = memo(function Cell({ index, mark, winning, clickable, onPress }: {
  index: number; mark: Player | null; winning: boolean; clickable: boolean; onPress: (i: number) => void;
}) {
  return (
    <button
      type="button"
      className={`caro-cell${winning ? ' caro-win' : ''}`}
      aria-label={mark ? `Square ${index + 1}, ${mark}` : `Square ${index + 1}, empty`}
      onClick={() => onPress(index)}
      style={{
        width: CELL, height: CELL, borderRadius: 5, border: 'none', padding: 0, cursor: clickable ? 'pointer' : 'default',
        background: winning ? '#F6E2A6' : '#F7F1E8', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {mark && <CaroMark player={mark} size={22} />}
    </button>
  );
});

/** Caro X O for two players on one computer (X1-X8). Turns alternate; no timer, no penalty, no text. */
export default function CaroPlay() {
  const [board, setBoard] = useState<Board>(emptyBoard);
  // Read by press() so that press keeps the same identity and the memoised cells do not re-render.
  const boardNow = useRef(board);
  boardNow.current = board;
  const state = useMemo(() => roundState(board), [board]);
  const turn: Player = turnOf(board);
  const over = state.status !== 'playing';
  const won = useMemo(() => new Set(state.line ?? []), [state]);

  const press = useCallback((i: number) => {
    const next = place(boardNow.current, i);
    if (!next) return;
    boardNow.current = next;
    setBoard(next);
    if (roundState(next).status === 'won') applause(2);
    else chime();
  }, []);

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
        @keyframes caroWin { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }
        .caro-win { animation: caroWin 1.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .caro-win { animation: none; } }
        .caro-cell:focus-visible { outline: 4px solid #E59AA1; outline-offset: 1px; }
      `}</style>
      <Hills />
      <div style={{ position: 'absolute', top: 40, left: 56 }}>
        <BackButton href="/games" label="Back to games" />
      </div>
      <div style={{ position: 'absolute', top: 40, right: 56 }}>
        {over && (
          <button
            type="button"
            aria-label="Play again"
            className="hm-tap"
            onClick={() => setBoard(emptyBoard())}
            style={{ width: 130, height: 130, borderRadius: 65, border: 'none', background: '#fff', boxShadow: '0 8px 0 #EADCC8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg aria-hidden="true" width="74" height="74" viewBox="0 0 24 24" fill="none" stroke="#7A5C50" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" />
            </svg>
          </button>
        )}
      </div>
      {/* pointer-events none: this full-width row must not cover the Play again button in the top right. */}
      <div style={{ position: 'absolute', top: 44, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 80, pointerEvents: 'none' }}>
        {chip('X', 'X player')}
        {chip('O', 'O player')}
      </div>

      <div
        aria-label="Caro board"
        onKeyDown={(e) => { gridStep(Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('.caro-cell')), COLS, e); }}
        style={{
          position: 'absolute', top: 200, left: (1920 - BOARD_W) / 2, width: BOARD_W, height: BOARD_H,
          boxSizing: 'border-box', padding: PAD, background: '#fff', borderRadius: 24, boxShadow: '0 8px 0 #EADCC8',
          display: 'grid', gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`, gridTemplateRows: `repeat(${ROWS}, ${CELL}px)`, gap: GAP,
        }}
      >
        {board.map((cell, i) => (
          <Cell key={i} index={i} mark={cell} winning={won.has(i)} clickable={!cell && !over} onPress={press} />
        ))}
      </div>
      <MusicButton />
    </Stage>
  );
}
