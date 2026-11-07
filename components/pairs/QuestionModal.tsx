'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ListenQuestion } from '@/components/listen/ListenQuestion';
import { ModalClose } from '@/components/ModalClose';
import { Confetti } from '@/components/Confetti';
import { QuizAsk } from '@/components/pairs/QuizAsk';
import { sayWord, stopWord } from '@/lib/memory/cards';
import { yay, ohOh } from '@/lib/sfx';
import { handleChoiceKey } from '@/lib/keynav';
import { trapTab } from '@/lib/trapTab';
import type { DrawnQuestion } from '@/lib/pairs/questions';
import type { QuizAnswer } from '@/lib/quiz/playable';

/** Pause after the modal opens before the word or prompt is said (ms). */
export const OPEN_SAY_MS = 600;
/** After the modal opens, picks, Enter/Space on an answer, X, Esc and backdrop closes wait this long (ms), so a double click on a half cannot answer it. */
export const OPEN_GUARD_MS = 400;
/** Pause after a wrong pick before the Listen & Pick word is said again (ms). */
export const SAY_AFTER_WRONG_MS = 700;
/** How long the oh-oh popup stays; a new wrong pick restarts it (ms). */
export const WRONG_POPUP_MS = 1400;
/** After a right pick the hooray shows this long, then `onRight` (ms). */
export const RIGHT_CLOSE_MS = 1200;
/** Quiz read-aloud: pause before each answer (ms). */
const READ_GAP_MS = 1000;

/** The card is 1350 x 840 on the 1920 x 1080 stage; the question inside is drawn at 1920 x 1080 and scaled down. */
const CARD_W = 1350;
const CARD_H = 840;
const QUESTION_W = 1920;
const QUESTION_H = 1080;
const SCALE = 0.7;

type Popup = 'wrong' | 'right' | null;

type Props = {
  /** The question shown; the parent keeps it stable while the modal is open (it mounts once per question). */
  drawn: DrawnQuestion;
  sounds: { hooray: string | null; ohoh: string | null };
  /** Called once, RIGHT_CLOSE_MS after the right pick. */
  onRight: () => void;
  /** X, Esc or a click on the backdrop (not while a right pick is being celebrated). */
  onClose: () => void;
};

/**
 * The question modal for a Puzzle Pairs half (H5-H7): a Quiz or Listen & Pick question over a veil.
 * A wrong pick says oh-oh and dims that answer; the right pick says hooray and then calls `onRight` once.
 */
export function QuestionModal({ drawn, sounds, onRight, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  /** Bumped by every stop, so a word that ends late does nothing. */
  const token = useRef(0);
  /** False until OPEN_GUARD_MS after the modal opened: picks and closes are ignored before that. */
  const armed = useRef(false);
  /** Whether the last mousedown was on the veil (null: none seen), so a press that starts on an answer does not close. */
  const pressOnVeil = useRef<boolean | null>(null);
  /** Named timers, so each one can be cancelled on its own. */
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [picked, setPicked] = useState<number | null>(null);
  const [wrong, setWrong] = useState<ReadonlySet<number>>(() => new Set());
  const [locked, setLocked] = useState(false);
  const [popup, setPopup] = useState<Popup>(null);
  const [speaking, setSpeaking] = useState(false);
  const [readIdx, setReadIdx] = useState<number | null>(null);

  const isListen = drawn.kind === 'listen';
  const answerCount = drawn.kind === 'listen' ? 3 : drawn.question.answers.length;
  const rightIndex = drawn.kind === 'listen' ? drawn.question.answerIndex : drawn.question.answers.findIndex((a) => a.is_correct);

  const clearLater = useCallback((name: string) => {
    const t = timers.current.get(name);
    if (t !== undefined) {
      clearTimeout(t);
      timers.current.delete(name);
    }
  }, []);

  const later = useCallback((name: string, ms: number, fn: () => void) => {
    clearLater(name);
    const t = setTimeout(() => {
      timers.current.delete(name);
      fn();
    }, ms);
    timers.current.set(name, t);
  }, [clearLater]);

  const clearAll = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current.clear();
  }, []);

  /** Stops the word and every pending speech step. */
  const hush = useCallback(() => {
    token.current++;
    clearLater('open');
    clearLater('again');
    clearLater('read');
    stopWord();
  }, [clearLater]);

  /** Reads the quiz answers one by one from `from`, skipping empty ones, highlighting each as it is read. */
  const readFrom = useCallback((my: number, answers: readonly QuizAnswer[], from: number): void => {
    const live = () => alive.current && my === token.current;
    let j = from;
    while (j < answers.length && !answers[j].text?.trim()) j++;
    if (j >= answers.length) return;
    later('read', READ_GAP_MS, () => {
      if (!live()) return;
      const text = answers[j].text?.trim() ?? '';
      setReadIdx(j);
      setSpeaking(true);
      sayWord({ word: text, audio_path: null }, () => {
        if (!live()) return;
        setReadIdx(null);
        setSpeaking(false);
        readFrom(my, answers, j + 1);
      });
    });
  }, [later]);

  /** Says the word (Listen & Pick) or the prompt (Quiz) now; a Quiz with read_answers goes on to the answers. */
  const say = useCallback((): void => {
    const my = token.current;
    setSpeaking(true);
    setReadIdx(null);
    if (drawn.kind === 'listen') {
      sayWord(drawn.question.answer, () => {
        if (alive.current && my === token.current) setSpeaking(false);
      });
      return;
    }
    const q = drawn.question;
    sayWord({ word: q.prompt_text ?? '', audio_path: q.prompt_audio_path }, () => {
      if (!alive.current || my !== token.current) return;
      setSpeaking(false);
      if (q.read_answers) readFrom(my, q.answers, 0);
    });
  }, [drawn, readFrom]);

  const pick = useCallback((i: number) => {
    if (!armed.current || locked || wrong.has(i) || i >= answerCount) return;
    hush();
    setSpeaking(false);
    setReadIdx(null);
    if (i === rightIndex) {
      setPicked(i);
      setLocked(true);
      setPopup('right');
      yay(sounds.hooray);
      later('close', RIGHT_CLOSE_MS, onRight);
      return;
    }
    setWrong((w) => new Set(w).add(i));
    ohOh(sounds.ohoh);
    setPopup('wrong');
    later('popup', WRONG_POPUP_MS, () => setPopup(null));
    if (isListen) later('again', SAY_AFTER_WRONG_MS, say);
  }, [locked, wrong, answerCount, rightIndex, hush, sounds, onRight, later, isListen, say]);

  /** X, Esc and a backdrop click: ignored during the opening guard and while a right pick is celebrated. */
  const close = useCallback(() => {
    if (armed.current && !locked) onClose();
  }, [locked, onClose]);

  const replay = useCallback(() => {
    if (locked) return;
    hush();
    say();
  }, [locked, hush, say]);

  // Opens: focus the first answer and say the word or prompt after a short pause. Leaving stops everything.
  useEffect(() => {
    alive.current = true;
    armed.current = false;
    later('arm', OPEN_GUARD_MS, () => { armed.current = true; });
    later('open', OPEN_SAY_MS, say);
    later('focus', 0, () => dialogRef.current?.querySelector<HTMLElement>('[data-answer]')?.focus());
    return () => {
      alive.current = false;
      clearAll();
      hush();
    };
  }, [clearAll, hush, later, say]);

  // Esc belongs to the question while it is open: a capture listener stops it here, so the page's Back button
  // (and any other window listener) does not also leave the game. Ignored while the right pick is celebrated.
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close();
    };
    window.addEventListener('keydown', onEsc, true);
    return () => window.removeEventListener('keydown', onEsc, true);
  }, [close]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A held key repeats: it must not pick (a focused answer would be clicked by Enter or Space) or replay.
      if (e.repeat && (e.key === '1' || e.key === '2' || e.key === '3' || e.key === 'r' || e.key === 'R' || e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        return;
      }
      if (e.key === '1' || e.key === '2' || e.key === '3') {
        pick(Number(e.key) - 1);
      } else if (e.key === 'r' || e.key === 'R') {
        replay();
      } else if (dialogRef.current) {
        trapTab(e, dialogRef.current);
        handleChoiceKey(e, Array.from(dialogRef.current.querySelectorAll<HTMLElement>('[data-answer]')));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pick, replay]);

  const question = drawn.kind === 'listen' ? (
    <ListenQuestion question={drawn.question} wrong={wrong} picked={picked} locked={locked} speaking={speaking} onPick={pick} onReplay={replay} />
  ) : (
    <QuizAsk question={drawn.question} wrong={wrong} picked={picked} locked={locked} speaking={speaking} readIdx={readIdx} onPick={pick} onReplay={replay} />
  );

  return (
    <div
      data-backdrop
      onMouseDown={(e) => { pressOnVeil.current = e.target === e.currentTarget; }}
      onClick={(e) => {
        // A press that began on an answer (or the card) and ended on the veil is not a close.
        const began = pressOnVeil.current !== false;
        pressOnVeil.current = null;
        if (began && e.target === e.currentTarget) close();
      }}
      style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(90,64,56,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        style={{ position: 'relative', width: CARD_W, height: CARD_H, borderRadius: 56, background: '#fff', boxShadow: '0 16px 0 #EADCC8', overflow: 'hidden' }}
      >
        <ModalClose size="child" disabled={locked} onClick={close} />
        <div style={{ position: 'absolute', left: (CARD_W - QUESTION_W * SCALE) / 2, top: (CARD_H - QUESTION_H * SCALE) / 2, width: QUESTION_W, height: QUESTION_H, transform: `scale(${SCALE})`, transformOrigin: '0 0' }}>
          {question}
        </div>

        {popup === 'wrong' && (
          <div data-feedback="wrong" style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', background: 'rgba(251,244,233,0.55)' }}>
            <div role="status" className="hm-rise" style={{ display: 'flex', alignItems: 'center', gap: 28, padding: '36px 64px 36px 40px', borderRadius: 80, background: '#fff', boxShadow: '0 12px 0 #EADCC8' }}>
              <svg aria-hidden="true" width="110" height="110" viewBox="0 0 24 24" fill="none" stroke="#B8737B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" fill="#F8DCDF" /><path d="M8.5 15.5c1-1 2.2-1.4 3.5-1.4s2.5.4 3.5 1.4" /><path d="M9 9.5h.01" /><path d="M15 9.5h.01" /></svg>
              <span style={{ fontSize: 80, fontWeight: 600, color: '#8A6A5E' }}>Oh-oh… try again!</span>
            </div>
          </div>
        )}
        {popup === 'right' && (
          <div data-feedback="right" style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(251,244,233,0.78)', overflow: 'hidden', pointerEvents: 'none' }}>
            <span className="hm-flash" aria-hidden="true" style={{ position: 'absolute', left: (CARD_W - 800) / 2, top: 20, width: 800, height: 800, borderRadius: 400, background: 'radial-gradient(circle, rgba(246,226,166,0.9) 0%, rgba(246,226,166,0) 68%)' }} />
            <Confetti count={56} />
            <div role="status" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30 }}>
              <svg className="hm-pop" aria-hidden="true" width="240" height="240" viewBox="0 0 24 24" fill="#EED79A" stroke="#C9A05A" strokeWidth="1" strokeLinejoin="round"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" /></svg>
              <span className="hm-pop" style={{ fontSize: 140, fontWeight: 700, color: '#B8737B', lineHeight: 1 }}>Hooray!</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
