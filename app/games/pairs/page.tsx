'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Stage } from '@/components/Stage';
import { Hills } from '@/components/Hills';
import { BackButton } from '@/components/BackButton';
import { MusicButton } from '@/components/MusicButton';
import { LoadError } from '@/components/LoadError';
import { PairsHelp } from '@/components/PairsHelp';
import { PairsBoard, type Joining } from '@/components/pairs/PairsBoard';
import { PairsShelf } from '@/components/pairs/PairsShelf';
import { PairsDone } from '@/components/pairs/PairsDone';
import { PairsMark } from '@/components/pairs/PairsArt';
import { QuestionModal } from '@/components/pairs/QuestionModal';
import { LEVEL_SIZE, dealPieces, drawLevel, parsePieceId, removePair } from '@/lib/pairs/board';
import { drawQuestion, type DrawnQuestion, type QuestionSources } from '@/lib/pairs/questions';
import { fetchPuzzlePictures, fetchQuestionSources } from '@/lib/pairs/load';
import { FINISH_MS, FLIP_MS, FLY_AT_MS, LAND_MS, SLIDE_MS } from '@/lib/pairs/timing';
import type { PuzzlePicture } from '@/lib/pairs/types';
import { preloadImages } from '@/lib/memory/preload';
import { sayWord, stopWord } from '@/lib/memory/cards';
import { mediaUrl } from '@/lib/media';
import { getMyChildSettings } from '@/lib/settings';
import { chime } from '@/lib/sfx';

type Sounds = { hooray: string | null; ohoh: string | null };
type Phase = 'loading' | 'empty' | 'play' | 'finishing' | 'done';
type Modal = { id: string; drawn: DrawnQuestion };

/** One level on the board: its 4 pictures, the halves in grid order, the finished pictures, and what is moving. */
type State = {
  phase: Phase;
  pictures: PuzzlePicture[];
  order: string[];
  up: string[];
  done: PuzzlePicture[];
  modal: Modal | null;
  joining: Joining | null;
  flipping: string | null;
  /** The key of the last question drawn: the next draw never repeats it (H4). */
  lastKey: string | null;
};

type Action =
  | { type: 'loading' }
  | { type: 'empty' }
  | { type: 'show'; pictures: PuzzlePicture[]; order: string[] }
  | { type: 'modal'; id: string; drawn: DrawnQuestion }
  | { type: 'close' }
  | { type: 'right' }
  | { type: 'turn'; id: string }
  | { type: 'flipEnd' }
  | { type: 'move'; order: string[] }
  | { type: 'join'; a: string; b: string }
  | { type: 'fly' }
  | { type: 'landed' }
  | { type: 'finish' };

const INITIAL: State = { phase: 'loading', pictures: [], order: [], up: [], done: [], modal: null, joining: null, flipping: null, lastKey: null };

/** A half turns face up and the flip starts; the question (if any) is closed. */
function turn(s: State, id: string): State {
  return { ...s, modal: null, up: [...s.up, id], flipping: id };
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'loading':
      return { ...s, phase: 'loading' };
    case 'empty':
      return { ...s, phase: 'empty' };
    case 'show':
      return { ...s, phase: 'play', pictures: a.pictures, order: a.order, up: [], done: [], modal: null, joining: null, flipping: null };
    case 'modal':
      return { ...s, modal: { id: a.id, drawn: a.drawn }, lastKey: a.drawn.key };
    case 'close':
      return { ...s, modal: null };
    case 'right':
      return s.modal ? turn(s, s.modal.id) : s;
    case 'turn':
      return turn(s, a.id);
    case 'flipEnd':
      return { ...s, flipping: null };
    case 'move':
      return { ...s, order: a.order };
    case 'join':
      return { ...s, joining: { a: a.a, b: a.b, phase: 'slide', shelfIndex: s.done.length } };
    case 'fly':
      return s.joining ? { ...s, joining: { ...s.joining, phase: 'fly' } } : s;
    case 'landed': {
      if (!s.joining) return s;
      const { a: first, b: second } = s.joining;
      const picture = s.pictures.find((p) => p.id === parsePieceId(first).pictureId);
      const done = picture ? [...s.done, picture] : s.done;
      return {
        ...s,
        order: removePair(s.order, first, second),
        up: s.up.filter((x) => x !== first && x !== second),
        done,
        joining: null,
        phase: done.length >= LEVEL_SIZE ? 'finishing' : s.phase,
      };
    }
    case 'finish':
      return s.phase === 'finishing' ? { ...s, phase: 'done' } : s;
  }
}

/** Puts the keyboard focus on a half (its hit area), if it is on the board. */
function focusHalf(id: string | undefined) {
  if (!id) return;
  document.querySelector<HTMLElement>(`[data-piece="${id}"] [data-hit]`)?.focus();
}

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

/**
 * Puzzle Pairs (H1-H3, H9-H12): hidden halves of 4 pictures; a half opens a question, a right answer turns it up,
 * two halves of one picture are joined by a drag and go to the shelf. Four pictures finish the level.
 * No score, no counter, no timer on screen.
 */
export default function PairsPlay() {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [loadErr, setLoadErr] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [help, setHelp] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [sounds, setSounds] = useState<Sounds>({ hooray: null, ohoh: null });
  const [praise, setPraise] = useState<{ name: string; url: string | null } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const helpBtn = useRef<HTMLButtonElement>(null);
  const pool = useRef<PuzzlePicture[]>([]);
  const sources = useRef<QuestionSources>({ quiz: [], cards: [] });
  /** Every pending timer of the page, cleared on leaving. */
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const alive = useRef(true);
  const stopPreload = useRef<(() => void) | null>(null);
  /** The level just shown is the first of a round: its first half takes the focus. */
  const focusFirst = useRef(false);

  const later = useCallback((fn: () => void, ms: number) => {
    if (!alive.current) return;
    const id = setTimeout(() => { timers.current.delete(id); fn(); }, ms);
    timers.current.add(id);
  }, []);

  useEffect(() => {
    alive.current = true;
    setReduced(reducedMotion());
    const pending = timers.current;
    return () => {
      alive.current = false;
      for (const id of pending) clearTimeout(id);
      pending.clear();
      stopPreload.current?.();
      stopPreload.current = null;
      stopWord();
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    };
  }, []);

  /** Draws a level that is not the `previous` one, preloads its pictures, then shows it with all halves face down. */
  const deal = useCallback((previous: readonly string[]) => {
    const level = drawLevel(pool.current, Math.random, previous);
    if (!level) {
      dispatch({ type: 'empty' });
      return;
    }
    stopPreload.current?.();
    stopPreload.current = preloadImages(level.map((p) => mediaUrl(p.image_path)), () => {
      stopPreload.current = null;
      if (!alive.current) return;
      focusFirst.current = true;
      dispatch({ type: 'show', pictures: level, order: dealPieces(level, Math.random) });
    });
  }, []);

  // The pictures and the question sources; any failure shows LoadError (retry loads again).
  useEffect(() => {
    let live = true;
    Promise.all([fetchPuzzlePictures(), fetchQuestionSources()]).then(
      ([pictures, src]) => {
        if (!live) return;
        pool.current = pictures;
        sources.current = src;
        deal([]);
      },
      (e: unknown) => { if (live) setLoadErr(e ?? true); },
    );
    return () => { live = false; };
  }, [attempt, deal]);

  // The child's sounds and name (and the custom "You did it" sound); any error keeps the built-in ones.
  useEffect(() => {
    let live = true;
    const none: Sounds = { hooray: null, ohoh: null };
    const ready = (name: string, url: string | null, s: Sounds) => { if (live) { setPraise({ name, url }); setSounds(s); } };
    try {
      getMyChildSettings().then(
        (data) => ready(data?.child_name ?? '', mediaUrl(data?.complete_path), { hooray: mediaUrl(data?.hooray_path), ohoh: mediaUrl(data?.ohoh_path) }),
        () => ready('', null, none),
      );
    } catch { ready('', null, none); }
    return () => { live = false; };
  }, []);

  // The first half of a new level takes the focus (keyboard players start on the board).
  useEffect(() => {
    if (!focusFirst.current || state.phase !== 'play') return;
    focusFirst.current = false;
    focusHalf(state.order[0]);
  });

  // A flip takes FLIP_MS, then the half is still.
  useEffect(() => {
    if (state.flipping) later(() => dispatch({ type: 'flipEnd' }), FLIP_MS);
  }, [state.flipping, later]);

  // The last picture has landed: the finish screen comes FINISH_MS later.
  useEffect(() => {
    if (state.phase === 'finishing') later(() => dispatch({ type: 'finish' }), FINISH_MS);
  }, [state.phase, later]);

  const pictureOf = (id: string) => state.pictures.find((p) => p.id === parsePieceId(id).pictureId);

  const refocus = (id: string) => later(() => focusHalf(id), 0);

  /** A tap or Enter on a face-down half: a question, or the half turns at once when there is none (H4, H7). */
  const onOpen = (id: string) => {
    if (state.phase !== 'play' || state.modal || state.joining || state.flipping || help) return;
    const drawn = drawQuestion(sources.current, Math.random, state.lastKey);
    if (drawn) dispatch({ type: 'modal', id, drawn });
    else dispatch({ type: 'turn', id });
  };

  const onRight = () => {
    const id = state.modal?.id;
    dispatch({ type: 'right' });
    if (id) refocus(id);
  };

  /** X, Esc or a backdrop click: the half stays face down and nothing counts (H5). */
  const onClose = () => {
    const id = state.modal?.id;
    dispatch({ type: 'close' });
    if (id) refocus(id);
  };

  const onMove = (order: string[]) => dispatch({ type: 'move', order });

  /**
   * The pair has landed and leaves the board. The pair's halves are removed, so if the keyboard focus was on one of them
   * (or on nothing), the half at the joined slot takes it, or the first half when there is none (H11).
   */
  const land = (a: string, b: string) => {
    const active = document.activeElement;
    const activeId = active?.closest('[data-piece]')?.getAttribute('data-piece') ?? null;
    const lost = !active || active === document.body || activeId === a || activeId === b;
    const slot = Math.min(state.order.indexOf(a), state.order.indexOf(b));
    const rest = removePair(state.order, a, b);
    dispatch({ type: 'landed' });
    if (lost) focusHalf(rest[slot] ?? rest[0]);
  };

  /** Two halves of one picture meet: chime and the word, the whole picture flies to the shelf, the pair leaves the board (H9). */
  const onJoin = (a: string, b: string) => {
    if (state.phase !== 'play' || state.joining || state.modal || state.flipping || help) return;
    const picture = pictureOf(a);
    dispatch({ type: 'join', a, b });
    later(() => { chime(); if (picture) sayWord(picture); }, SLIDE_MS);
    later(() => dispatch({ type: 'fly' }), FLY_AT_MS);
    later(() => land(a, b), LAND_MS);
  };

  /** New level: a draw that is not the level just played, all halves face down (H10). */
  const again = () => {
    stopWord();
    const previous = state.pictures.map((p) => p.id);
    dispatch({ type: 'loading' });
    deal(previous);
  };

  const toGames = useCallback(() => router.push('/games'), [router]);
  const closeHelp = () => {
    setHelp(false);
    later(() => helpBtn.current?.focus(), 0);
  };
  const retry = () => { setLoadErr(null); setAttempt((n) => n + 1); };

  const pictureMap = useMemo(() => new Map(state.pictures.map((p) => [p.id, p] as const)), [state.pictures]);
  const upSet = useMemo(() => new Set(state.up), [state.up]);
  const busy = !!state.modal || !!state.flipping || help;
  const onBoard = state.phase === 'play' || state.phase === 'finishing';
  const celebrate = state.phase === 'done' ? praise : null;

  return (
    <Stage>
      <div ref={stageRef} data-pairs-play data-phase={state.phase} className={reduced ? 'hm-reduced' : undefined} style={{ position: 'absolute', inset: 0 }}>
        {celebrate ? (
          <PairsDone pictures={state.done} childName={celebrate.name} completeUrl={celebrate.url} onAgain={again} onHome={toGames} />
        ) : (
          <>
            <Hills />
            <div style={{ position: 'absolute', top: 48, zIndex: 2, left: 56, right: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <BackButton href="/games" label="Back to games" game="pairs" />
              {state.phase !== 'done' && (
                <button
                  ref={helpBtn}
                  type="button"
                  className="hm-tap"
                  aria-label="What is Puzzle Pairs? Show how to play"
                  onClick={() => setHelp(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 16, height: 120, padding: '0 40px 0 28px', borderRadius: 60, background: '#fff', border: '8px solid #E3B5CF', boxShadow: '0 8px 0 #EADCC8', boxSizing: 'border-box', fontFamily: 'inherit' }}
                >
                  <svg aria-hidden="true" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#A2577F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
                  <span style={{ fontSize: 44, fontWeight: 600, color: '#A2577F', lineHeight: 1 }}>Puzzle Pairs</span>
                </button>
              )}
            </div>
            {onBoard && <PairsShelf done={state.done} />}
            {onBoard && (
              <PairsBoard
                pictures={pictureMap}
                order={state.order}
                up={upSet}
                flipping={state.flipping}
                busy={busy}
                joining={state.joining}
                stageRef={stageRef}
                onOpen={onOpen}
                onMove={onMove}
                onJoin={onJoin}
              />
            )}
            {loadErr ? <LoadError error={loadErr} onRetry={retry} /> : null}
            {!loadErr && state.phase === 'empty' && (
              <div role="status" aria-label="New pictures are coming soon" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PairsMark size={420} ring={0.6} />
              </div>
            )}
            {state.modal && (
              <QuestionModal key={state.modal.drawn.key} drawn={state.modal.drawn} sounds={sounds} onRight={onRight} onClose={onClose} />
            )}
          </>
        )}
        <MusicButton />
        {help && <PairsHelp playHref={null} onClose={closeHelp} />}
      </div>
    </Stage>
  );
}
