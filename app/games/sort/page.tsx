'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage } from '@/components/Stage';
import { Hills } from '@/components/Hills';
import { BackButton } from '@/components/BackButton';
import { MusicButton } from '@/components/MusicButton';
import { SortHelp } from '@/components/SortHelp';
import { SortDone } from '@/components/sort/SortDone';
import { SortBasket } from '@/components/sort/SortBasket';
import { SortObject, type SortObjectState } from '@/components/sort/SortObject';
import { useSortDrag } from '@/components/sort/useSortDrag';
import { fetchSortCards } from '@/lib/sort/cards';
import { buildSortRound, type SortRound } from '@/lib/sort/rounds';
import { sayWord, stopWord } from '@/lib/memory/cards';
import { preloadImages } from '@/lib/memory/preload';
import { mediaUrl } from '@/lib/media';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { chime, ohOh, type SoundHandle } from '@/lib/sfx';
import type { MemoryCard } from '@/lib/memory/types';

/** A wrong or outside drop: the object slides back to its place in the row this long (R5; none under reduced motion, R8). */
export const SLIDE_BACK_MS = 350;
/** The "Oh-oh… try again!" popup after a wrong drop stays this long; a new wrong drop restarts it (R5). */
export const WRONG_POPUP_MS = 1400;
/** After the chime of a right drop, the word comes this much later (R4); presses wait for it (the settle). */
export const WORD_AFTER_CHIME_MS = 550;
/** After the last right word, the pause before the finish (R7). */
export const FINISH_DELAY_MS = 1000;
/** Longest wait for the last word to report its end before the finish pause starts anyway. */
export const WORD_CAP_MS = 4000;

/** Stacking: baskets 1, objects 2 (a lifted one goes over the baskets), header 4, wrong popup 10, help popup 50 (GameHelp). */
const FX_Z = 10;

type Placed = [MemoryCard[], MemoryCard[]];

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

/** Sort It (R1-R6, R8-R10): drag each object into the basket of its kind. Mouse only; no timers on the child, no penalty. */
export default function SortPlay() {
  const [phase, setPhase] = useState<'loading' | 'empty' | 'play' | 'done'>('loading');
  /** The round's chosen cards (baskets with their examples, and the 6 objects). */
  const [round, setRound] = useState<SortRound | null>(null);
  /** Row state of each object by id; 'lifted' comes from the drag. */
  const [objState, setObjState] = useState<Record<string, Exclude<SortObjectState, 'lifted'>>>({});
  const [placed, setPlaced] = useState<Placed>([[], []]);
  /** Bumped by Play again; a new value draws a new round. */
  const [roundNo, setRoundNo] = useState(0);
  /** Wrong drops of this round, shown on the finish. */
  const [wrongCount, setWrongCount] = useState(0);
  /** The child's name and the optional custom praise sound, read once when the round is done (as the Memory completion). */
  const [praise, setPraise] = useState<{ name: string; url: string | null } | null>(null);
  const [settling, setSettling] = useState(false);
  /** Bumped by each wrong drop (restarts the popup); null when the popup is hidden. */
  const [wrongFx, setWrongFx] = useState<number | null>(null);
  const [help, setHelp] = useState(false);
  const [reduced, setReduced] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const basketRefs = useRef<(HTMLElement | null)[]>([null, null]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const alive = useRef(true);
  /** Bumped by every word, so only the newest word's end counts. */
  const wordSeq = useRef(0);
  const wrongFxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rightCount = useRef(0);
  const wrongRef = useRef(0);
  /** The finish: 'word' waits for the last word (or its cap), 'pause' is the breath before the done state. */
  const finishing = useRef<'none' | 'word' | 'pause'>('none');
  const capTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The help popup is open: the next word and the finish wait until it closes (set synchronously). */
  const helpOpen = useRef(false);
  const held = useRef<{ say: (() => void) | null; finish: boolean }>({ say: null, finish: false });
  const ohohUrl = useRef<string | null>(null);
  const sfx = useRef<SoundHandle | null>(null);
  const cancelDrag = useRef<() => void>(() => undefined);
  const reducedRef = useRef(false);

  const later = useCallback((fn: () => void, ms: number) => {
    if (!alive.current) return null;
    const id = setTimeout(() => { timers.current.delete(id); fn(); }, ms);
    timers.current.add(id);
    return id;
  }, []);

  const clearLater = useCallback((id: ReturnType<typeof setTimeout> | null) => {
    if (!id) return;
    clearTimeout(id);
    timers.current.delete(id);
  }, []);

  useEffect(() => {
    alive.current = true;
    reducedRef.current = reducedMotion();
    setReduced(reducedRef.current);
    const pending = timers.current;
    return () => {
      alive.current = false;
      cancelDrag.current();
      for (const id of pending) clearTimeout(id);
      pending.clear();
      try { sfx.current?.stop(); } catch { /* already stopped */ }
      sfx.current = null;
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
      stopWord();
    };
  }, []);

  // Load the pool, build the round, preload its 8 pictures, then show the board (R2, R9).
  useEffect(() => {
    let live = true;
    let stopPreload: (() => void) | null = null;
    fetchSortCards().then(
      (cards) => {
        if (!live) return;
        const r = buildSortRound(cards);
        if (!r) { setPhase('empty'); return; }
        const pics = [...r.baskets.map((b) => b.example), ...r.items.map((i) => i.card)];
        stopPreload = preloadImages(pics.map((c) => mediaUrl(c.image_path)), () => {
          if (!live) return;
          setRound(r);
          setObjState(Object.fromEntries(r.items.map((i) => [i.id, 'idle' as const])));
          setPhase('play');
        });
      },
      () => live && setPhase('empty'),
    );
    return () => { live = false; stopPreload?.(); };
  }, [roundNo]);

  // A custom oh-oh sound (as in Quiz); any error keeps the built-in one.
  useEffect(() => {
    let live = true;
    try {
      createSupabaseBrowserClient().from('settings').select('ohoh_path').eq('id', 1).single().then(
        ({ data }) => { if (live && data) ohohUrl.current = mediaUrl(data.ohoh_path); },
        () => undefined,
      );
    } catch { /* no client: built-in sound */ }
    return () => { live = false; };
  }, []);

  /** Says a word now (a newer word cuts the older one, R6); `onEnd` runs only if it is still the newest word. */
  const say = useCallback((card: MemoryCard, onEnd?: () => void) => {
    if (!alive.current) return;
    const seq = ++wordSeq.current;
    sayWord(card, () => {
      if (!alive.current || wordSeq.current !== seq) return;
      onEnd?.();
    });
  }, []);

  const finishNow = useCallback(() => {
    finishing.current = 'none';
    setPhase('done');
  }, []);

  /** The last word ended (or its cap passed): the finish comes after a short pause, or once the help closes. */
  const lastWordDone = useCallback(() => {
    if (finishing.current !== 'word') return;
    finishing.current = 'pause';
    clearLater(capTimer.current);
    capTimer.current = null;
    later(() => {
      if (helpOpen.current) held.current.finish = true;
      else finishNow();
    }, FINISH_DELAY_MS);
  }, [later, clearLater, finishNow]);

  /** Says the right-drop word; for the last one, also starts the finish (its end, or the cap). */
  const sayRight = useCallback((card: MemoryCard, last: boolean) => {
    if (!last) { say(card); return; }
    finishing.current = 'word';
    clearLater(capTimer.current);
    capTimer.current = later(lastWordDone, WORD_CAP_MS);
    say(card, lastWordDone);
  }, [say, later, clearLater, lastWordDone]);

  const showWrongPopup = useCallback(() => {
    clearLater(wrongFxTimer.current);
    setWrongFx((n) => (n ?? 0) + 1);
    wrongFxTimer.current = later(() => { wrongFxTimer.current = null; setWrongFx(null); }, WRONG_POPUP_MS);
  }, [later, clearLater]);

  /** Sends an object back to its place in the row (instantly under reduced motion, R8). */
  const slideBack = useCallback((id: string) => {
    if (reducedRef.current) { setObjState((s) => ({ ...s, [id]: 'idle' })); return; }
    setObjState((s) => ({ ...s, [id]: 'sliding' }));
    later(() => setObjState((s) => (s[id] === 'sliding' ? { ...s, [id]: 'idle' } : s)), SLIDE_BACK_MS);
  }, [later]);

  const cardOf = useCallback((id: string) => round?.items.find((i) => i.id === id), [round]);

  const onPickUp = useCallback((id: string) => {
    const item = cardOf(id);
    if (item) say(item.card);
  }, [cardOf, say]);

  const onTap = onPickUp;

  const onDrop = useCallback((id: string, basket: 0 | 1 | null) => {
    const item = cardOf(id);
    if (!item || !round) return;
    if (basket === null) { slideBack(id); return; }
    if (basket !== item.basket) {
      stopWord(); // the oh-oh does not play over a word
      wordSeq.current++;
      try { sfx.current?.stop(); } catch { /* already stopped */ }
      sfx.current = ohOh(ohohUrl.current) ?? null;
      wrongRef.current += 1;
      setWrongCount(wrongRef.current);
      showWrongPopup();
      slideBack(id);
      return;
    }
    stopWord();
    wordSeq.current++;
    try { sfx.current?.stop(); } catch { /* already stopped */ } // a still-playing oh-oh file must not overlap the chime and the word
    sfx.current = null;
    chime();
    setObjState((s) => ({ ...s, [id]: 'hidden' }));
    setPlaced((p) => {
      const next: Placed = [[...p[0]], [...p[1]]];
      next[basket].push(item.card);
      return next;
    });
    rightCount.current += 1;
    const last = rightCount.current >= round.items.length;
    setSettling(true);
    later(() => {
      setSettling(false);
      const word = () => sayRight(item.card, last);
      if (helpOpen.current) held.current.say = word;
      else word();
    }, WORD_AFTER_CHIME_MS);
  }, [cardOf, round, slideBack, showWrongPopup, later, sayRight]);

  /** The last right drop was made: the finish is on its way, so nothing else may speak or delay it. */
  const finishPending = () => finishing.current !== 'none' || (!!round && rightCount.current >= round.items.length);

  const sliding = Object.values(objState).some((s) => s === 'sliding');
  const busy = phase !== 'play' || help || settling || sliding;

  const { dragging, press, cancel } = useSortDrag({ stageRef, basketRefs, busy, onPickUp, onTap, onDrop });
  useEffect(() => { cancelDrag.current = cancel; }, [cancel]);

  const basketRefCbs = useMemo(
    () => [0, 1].map((i) => (el: HTMLElement | null) => { basketRefs.current[i] = el; }),
    [],
  );

  const openHelp = useCallback(() => {
    helpOpen.current = true;
    cancel();
    setHelp(true);
  }, [cancel]);

  /** The popup closed: say the held word, or make the held finish. */
  const closeHelp = useCallback(() => {
    helpOpen.current = false;
    setHelp(false);
    const { say: word, finish } = held.current;
    held.current = { say: null, finish: false };
    if (word) word();
    else if (finish) finishNow();
  }, [finishNow]);

  const done = phase === 'done';

  // The finish needs the child's name and the optional custom praise sound.
  useEffect(() => {
    if (!done) return;
    let live = true;
    const ready = (name: string, url: string | null) => live && setPraise({ name, url });
    try {
      createSupabaseBrowserClient().from('settings').select('child_name, complete_path').eq('id', 1).single()
        .then(({ data }) => ready(data?.child_name ?? '', mediaUrl(data?.complete_path)), () => ready('', null));
    } catch { ready('', null); }
    return () => { live = false; };
  }, [done]);

  /** Play again: every piece of round state is reset, then a new round is drawn (the round effect). */
  const again = useCallback(() => {
    cancelDrag.current();
    for (const id of timers.current) clearTimeout(id);
    timers.current.clear();
    capTimer.current = null;
    wrongFxTimer.current = null;
    wordSeq.current++;
    stopWord();
    try { sfx.current?.stop(); } catch { /* already stopped */ }
    sfx.current = null;
    rightCount.current = 0;
    wrongRef.current = 0;
    finishing.current = 'none';
    held.current = { say: null, finish: false };
    helpOpen.current = false;
    setPraise(null);
    setRound(null);
    setObjState({});
    setPlaced([[], []]);
    setWrongCount(0);
    setSettling(false);
    setWrongFx(null);
    setHelp(false);
    setPhase('loading');
    setRoundNo((n) => n + 1);
  }, []);

  const finished = done && praise !== null;

  return (
    <Stage>
      <div
        ref={stageRef}
        data-sort-play
        data-done={done ? 'true' : 'false'}
        data-wrong-count={wrongCount}
        className={reduced ? 'hm-reduced' : undefined}
        style={{ position: 'absolute', inset: 0 }}
      >
        {finished ? (
          <SortDone wrong={wrongCount} childName={praise.name} completeUrl={praise.url} onAgain={again} gamesHref="/games" />
        ) : (
          <>
          <Hills />
          <div style={{ position: 'absolute', top: 48, zIndex: 4, left: 56, right: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <BackButton href="/games" label="Back to games" />
            {!done && (
              <button
                type="button"
                className="hm-tap"
                aria-label="What is Sort It? Show how to play"
                onClick={openHelp}
                style={{ display: 'flex', alignItems: 'center', gap: 16, height: 120, padding: '0 40px 0 28px', borderRadius: 60, background: '#fff', border: '8px solid #EAD9A0', boxShadow: '0 8px 0 #EADCC8', boxSizing: 'border-box', fontFamily: 'inherit' }}
              >
                <svg aria-hidden="true" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#A8842F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
                <span style={{ fontSize: 44, fontWeight: 600, color: '#A8842F', lineHeight: 1 }}>Sort It</span>
              </button>
            )}
          </div>
          {phase === 'empty' && (
            <div role="status" aria-label="New cards are coming soon" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg aria-hidden="true" width="420" height="420" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10.5" fill="#F0ECF8" stroke="#C9BFE4" strokeWidth="0.6" />
                <path d="M10.5 8L7.5 10.4H5.6v3.2h1.9l3 2.4z" fill="#7B6BAE" />
                <path d="M13.4 10a2.8 2.8 0 0 1 0 4" fill="none" stroke="#7B6BAE" strokeWidth="1" strokeLinecap="round" />
                <path d="M15.4 8.2a5.4 5.4 0 0 1 0 7.6" fill="none" stroke="#7B6BAE" strokeWidth="1" strokeLinecap="round" />
              </svg>
            </div>
          )}
          {phase === 'play' && round && (
            <>
              {round.baskets.map((b, i) => (
                <div key={b.groupId} data-group={b.groupId} style={{ position: 'absolute', top: 210, left: i === 0 ? 120 : 1040, zIndex: 1 }}>
                  <SortBasket
                    index={i as 0 | 1}
                    basket={b}
                    placed={placed[i]}
                    onExampleTap={() => { if (!finishPending()) say(b.example); }}
                    basketRef={basketRefCbs[i]}
                  />
                </div>
              ))}
              <div style={{ position: 'absolute', top: 790, left: 0, right: 0, zIndex: 2, display: 'flex', justifyContent: 'center', gap: 40 }}>
                {round.items.map((item) => {
                  const lifted = dragging?.id === item.id;
                  return (
                    <SortObject
                      key={item.id}
                      item={item}
                      state={lifted ? 'lifted' : objState[item.id] ?? 'idle'}
                      offset={lifted ? { x: dragging.dx, y: dragging.dy } : { x: 0, y: 0 }}
                      onPointerDown={(e) => press(item.id, e)}
                    />
                  );
                })}
              </div>
            </>
          )}
          {wrongFx !== null && phase === 'play' && (
            <div data-feedback="wrong" style={{ position: 'absolute', inset: 0, zIndex: FX_Z, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', background: 'rgba(251,244,233,0.55)' }}>
              <div key={wrongFx} role="status" className="hm-rise" style={{ display: 'flex', alignItems: 'center', gap: 28, padding: '36px 64px 36px 40px', borderRadius: 80, background: '#fff', boxShadow: '0 12px 0 #EADCC8' }}>
                <svg aria-hidden="true" width="110" height="110" viewBox="0 0 24 24" fill="none" stroke="#B8737B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" fill="#F8DCDF" /><path d="M8.5 15.5c1-1 2.2-1.4 3.5-1.4s2.5.4 3.5 1.4" /><path d="M9 9.5h.01" /><path d="M15 9.5h.01" /></svg>
                <span style={{ fontSize: 80, fontWeight: 600, color: '#8A6A5E' }}>Oh-oh… try again!</span>
              </div>
            </div>
          )}
          </>
        )}
        <MusicButton />
        {help && <SortHelp playHref={null} onClose={closeHelp} />}
      </div>
    </Stage>
  );
}
