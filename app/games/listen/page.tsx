'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage } from '@/components/Stage';
import { Hills } from '@/components/Hills';
import { BackButton } from '@/components/BackButton';
import { MusicButton } from '@/components/MusicButton';
import { ListenHelp } from '@/components/ListenHelp';
import { ListenQuestion } from '@/components/listen/ListenQuestion';
import { Confetti } from '@/components/Confetti';
import { ListenDone } from '@/components/listen/ListenDone';
import { fetchActiveCards, sayWord, stopWord } from '@/lib/memory/cards';
import { preloadImages } from '@/lib/memory/preload';
import { buildRounds, type Question } from '@/lib/listen/rounds';
import { clearWrong, readWrong, recordWrong, type WrongEntry } from '@/lib/listen/wrongLog';
import { mediaUrl } from '@/lib/media';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ohOh, yay, type SoundHandle } from '@/lib/sfx';
import { handleChoiceKey } from '@/lib/keynav';
import type { MemoryCard } from '@/lib/memory/types';

/** A new question's word comes a short pause after it appears (L3). */
export const SAY_AFTER_SHOW_MS = 600;
/** After a wrong pick the word comes again once the oh-oh has started fading (L4). */
export const SAY_AFTER_WRONG_MS = 700;
/** Longest wait for the hooray before the right word is said (L5). */
export const HOORAY_CAP_MS = 1800;
/** A breath between the end of the right word and the next question. */
export const NEXT_PAUSE_MS = 400;
/** After the last right word, the pause before the finish screen. */
export const FINISH_DELAY_MS = 1000;
/** The next question comes at the latest this long after a right pick, even if the voice never reports its end. */
export const STEP_CAP_MS = 4000;

/** The "Oh-oh… try again!" popup after a wrong pick stays this long; a new wrong pick restarts it (L4). */
export const WRONG_POPUP_MS = 1400;
/** Stacking of the feedback overlays: above the question, below the help popup (GameHelp, 50). */
const FX_Z = 10;

/** A right pick being resolved: `cap` is its cap timer (re-armed when the help popup held the word). */
type Step = { cap: ReturnType<typeof setTimeout> | null; last: boolean };

const answerEls = () => Array.from(document.querySelectorAll<HTMLElement>('[data-answer]'));
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

/** Listen & Pick (L1-L5, L8, L10): hear a word, pick its picture out of three. No timers on the child, no penalty. */
export default function ListenPlay() {
  const [phase, setPhase] = useState<'loading' | 'empty' | 'play' | 'done'>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [wrong, setWrong] = useState<ReadonlySet<number>>(() => new Set());
  const [locked, setLocked] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [help, setHelp] = useState(false);
  /** Bumped by Play again; a new value draws a new round. */
  const [round, setRound] = useState(0);
  /** The wrong picks of the finished round, read once when the last question is done. */
  const [finish, setFinish] = useState<readonly WrongEntry[]>([]);
  const [praise, setPraise] = useState<{ name: string; url: string | null } | null>(null);
  const [reduced, setReduced] = useState(false);
  /** The visual feedback of the current question's picks (purely visual): `q` is the question index it belongs to. */
  const [fx, setFx] = useState<{ kind: 'wrong' | 'right'; q: number } | null>(null);
  const wrongFxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const helpBtn = useRef<HTMLButtonElement>(null);
  const sounds = useRef<{ hooray: string | null; ohoh: string | null }>({ hooray: null, ohoh: null });
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const alive = useRef(true);
  /** Bumped by every word, so only the newest word's end counts. */
  const wordSeq = useRef(0);
  /** The pending delayed word (after showing a question or a wrong pick); a newer one replaces it. */
  const pendingSay = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Guards picks synchronously (two clicks or keys before React re-renders). */
  const lockedRef = useRef(false);
  const wrongRef = useRef(new Set<number>());
  /** The right pick being resolved; the normal path and the cap both try to finish it, only the first one counts. */
  const step = useRef<Step | null>(null);
  /** The help popup is open: the round holds its next word and its advance until it closes (set synchronously). */
  const helpOpen = useRef(false);
  const held = useRef<{ say: (() => void) | null; advance: Step | null }>({ say: null, advance: null });
  /** A question appeared behind the popup: answer 1 gets focus when it closes. */
  const focusOnClose = useRef(false);
  /** The last hooray / oh-oh, stopped when leaving. */
  const sfx = useRef<SoundHandle | null>(null);

  const later = useCallback((fn: () => void, ms: number) => {
    if (!alive.current) return null;
    const id = setTimeout(() => { timers.current.delete(id); fn(); }, ms);
    timers.current.add(id);
    return id;
  }, []);

  useEffect(() => {
    alive.current = true;
    setReduced(reducedMotion());
    const pending = timers.current;
    return () => {
      alive.current = false;
      for (const id of pending) clearTimeout(id);
      pending.clear();
      try { sfx.current?.stop(); } catch { /* already stopped */ }
      sfx.current = null;
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
      stopWord();
      clearWrong(); // L7: leaving the game clears the wrong-picks log
    };
  }, []);

  // A round starts: clear the log, load the pool, build the questions, preload their pictures, show question 1.
  useEffect(() => {
    let live = true;
    let stopPreload: (() => void) | null = null;
    clearWrong();
    fetchActiveCards().then(
      (cards) => {
        if (!live) return;
        const qs = buildRounds(cards);
        if (!qs) { setPhase('empty'); return; }
        stopPreload = preloadImages(qs.flatMap((q) => q.options.map((c) => mediaUrl(c.image_path))), () => {
          if (!live) return;
          setQuestions(qs);
          setIndex(0);
          setPhase('play');
        });
      },
      () => live && setPhase('empty'),
    );
    return () => { live = false; stopPreload?.(); };
  }, [round]);

  // Custom hooray / oh-oh sounds (as in Quiz); any error just keeps the built-in ones.
  useEffect(() => {
    let live = true;
    try {
      createSupabaseBrowserClient().from('settings').select('hooray_path, ohoh_path').eq('id', 1).single().then(
        ({ data }) => { if (live && data) sounds.current = { hooray: mediaUrl(data.hooray_path), ohoh: mediaUrl(data.ohoh_path) }; },
        () => undefined,
      );
    } catch { /* no client: built-in sounds */ }
    return () => { live = false; };
  }, []);

  /** Says a word now; `onEnd` runs only if it is still the newest word. */
  const say = useCallback((card: MemoryCard, onEnd?: () => void) => {
    if (!alive.current) return;
    const seq = ++wordSeq.current;
    setSpeaking(true);
    sayWord(card, () => {
      if (!alive.current || wordSeq.current !== seq) return;
      setSpeaking(false);
      onEnd?.();
    });
  }, []);

  /** Runs a word now, or keeps it (newest wins) for when the help popup closes: nothing is said under the popup. */
  const gateSay = useCallback((fn: () => void) => {
    if (helpOpen.current) held.current.say = fn;
    else fn();
  }, []);

  /** Says a word after `ms`, replacing any word still waiting. */
  const sayLater = useCallback((card: MemoryCard, ms: number) => {
    if (pendingSay.current) { clearTimeout(pendingSay.current); timers.current.delete(pendingSay.current); }
    pendingSay.current = later(() => { pendingSay.current = null; gateSay(() => say(card)); }, ms);
  }, [later, say, gateSay]);

  const clearFx = useCallback(() => {
    if (wrongFxTimer.current) { clearTimeout(wrongFxTimer.current); timers.current.delete(wrongFxTimer.current); }
    wrongFxTimer.current = null;
    setFx(null);
  }, []);

  const cancelPendingSay = useCallback(() => {
    if (pendingSay.current) { clearTimeout(pendingSay.current); timers.current.delete(pendingSay.current); }
    pendingSay.current = null;
  }, []);

  const current = phase === 'play' ? questions[index] : undefined;

  // Each new question: fresh state, focus on answer 1, the word after a short pause.
  useEffect(() => {
    if (!current) return;
    lockedRef.current = false;
    wrongRef.current = new Set();
    setWrong(new Set());
    setLocked(false);
    clearFx();
    // Behind the help popup the focus stays in the popup; answer 1 gets it when the popup closes.
    if (helpOpen.current) focusOnClose.current = true;
    else answerEls()[0]?.focus();
    sayLater(current.answer, SAY_AFTER_SHOW_MS);
  }, [current, sayLater, clearFx]);

  /** Moves on after a right pick, once (the word's end and the cap both call it). */
  const moveOn = useCallback((token: Step) => {
    if (step.current !== token) return;
    step.current = null;
    if (index + 1 < questions.length) setIndex(index + 1);
    else { setFinish(readWrong()); setPhase('done'); }
  }, [index, questions.length]);

  /** Advances now, or once the help popup closes. */
  const gateAdvance = useCallback((token: Step) => {
    if (helpOpen.current) held.current.advance = token;
    else moveOn(token);
  }, [moveOn]);

  /** The cap of a right pick: the child never waits on a voice that does not report its end. */
  const armCap = useCallback((token: Step) => {
    if (token.cap) { clearTimeout(token.cap); timers.current.delete(token.cap); }
    token.cap = later(() => gateAdvance(token), token.last ? STEP_CAP_MS + FINISH_DELAY_MS : STEP_CAP_MS);
  }, [later, gateAdvance]);

  const pick = useCallback((i: 0 | 1 | 2) => {
    const q = current;
    if (!q || lockedRef.current || wrongRef.current.has(i)) return;
    if (i !== q.answerIndex) {
      wrongRef.current.add(i);
      setWrong(new Set(wrongRef.current));
      stopWord(); // the oh-oh does not play over a word
      try { sfx.current?.stop(); } catch { /* already stopped */ }
      sfx.current = ohOh(sounds.current.ohoh) ?? null;
      recordWrong(q.answer);
      if (wrongFxTimer.current) { clearTimeout(wrongFxTimer.current); timers.current.delete(wrongFxTimer.current); }
      setFx({ kind: 'wrong', q: index });
      wrongFxTimer.current = later(() => { wrongFxTimer.current = null; setFx(null); }, WRONG_POPUP_MS);
      sayLater(q.answer, SAY_AFTER_WRONG_MS);
      return;
    }
    lockedRef.current = true;
    setLocked(true);
    if (wrongFxTimer.current) { clearTimeout(wrongFxTimer.current); timers.current.delete(wrongFxTimer.current); wrongFxTimer.current = null; }
    setFx({ kind: 'right', q: index });
    cancelPendingSay();
    stopWord();
    try { sfx.current?.stop(); } catch { /* already stopped */ }
    const handle = yay(sounds.current.hooray) ?? null;
    sfx.current = handle;
    // A file's length is unknown (ms 0): wait the full cap so the word does not talk over it.
    const hooray = handle && handle.ms > 0 ? Math.min(handle.ms, HOORAY_CAP_MS) : HOORAY_CAP_MS;
    const last = index + 1 >= questions.length;
    const token: Step = { cap: null, last };
    step.current = token;
    later(() => gateSay(() => say(q.answer, () => later(() => gateAdvance(token), last ? FINISH_DELAY_MS : NEXT_PAUSE_MS))), hooray);
    armCap(token);
  }, [current, index, questions.length, later, say, sayLater, cancelPendingSay, gateSay, gateAdvance, armCap]);

  const openHelp = useCallback(() => {
    helpOpen.current = true;
    setHelp(true);
  }, []);

  /** The popup closed: say the held word (re-arming the cap so it is heard), or make the held advance; then focus. */
  const closeHelp = useCallback(() => {
    helpOpen.current = false;
    setHelp(false);
    const { say: word, advance } = held.current;
    held.current = { say: null, advance: null };
    if (word) {
      if (step.current) armCap(step.current);
      word();
    } else if (advance) moveOn(advance);
    const toAnswer = focusOnClose.current;
    focusOnClose.current = false;
    setTimeout(() => (toAnswer ? answerEls()[0] : helpBtn.current)?.focus(), 0);
  }, [armCap, moveOn]);

  const replay = useCallback(() => {
    // Not during the hooray pause: the right word comes on its own and must not be cut.
    if (current && !lockedRef.current) { cancelPendingSay(); say(current.answer); }
  }, [current, cancelPendingSay, say]);

  useEffect(() => {
    if (!current || help) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '1' || e.key === '2' || e.key === '3') { e.preventDefault(); pick((Number(e.key) - 1) as 0 | 1 | 2); return; }
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); replay(); return; }
      handleChoiceKey(e, answerEls());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, help, pick, replay]);

  const done = phase === 'done';

  // The finish needs the child's name and the optional custom praise sound (as the Memory completion).
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

  /** The round's cards by id, for the pictures of the wrong-picks list. */
  const roundCards = useMemo(() => new Map<string, MemoryCard>(questions.flatMap((q) => q.options.map((c) => [c.id, c] as const))), [questions]);

  /** Play again: a clean log and a new round, back to question 1. */
  const again = useCallback(() => {
    clearWrong();
    stopWord();
    step.current = null;
    clearFx();
    setFinish([]);
    setPraise(null);
    setQuestions([]);
    setIndex(0);
    setPhase('loading');
    setRound((n) => n + 1);
  }, [clearFx]);

  const finished = done && praise !== null;

  return (
    <Stage>
      <div data-listen-play data-done={done ? 'true' : 'false'} className={reduced ? 'hm-reduced' : undefined} style={{ position: 'absolute', inset: 0 }}>
        {finished ? (
          <ListenDone wrong={finish} cards={roundCards} childName={praise.name} completeUrl={praise.url} onAgain={again} gamesHref="/games" />
        ) : (
        <>
        <Hills />
        <div style={{ position: 'absolute', top: 48, zIndex: 2, left: 56, right: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <BackButton href="/games" label="Back to games" />
          {!done && (
            <button
              ref={helpBtn}
              type="button"
              className="hm-tap"
              aria-label="What is Listen & Pick? Show how to play"
              onClick={openHelp}
              style={{ display: 'flex', alignItems: 'center', gap: 16, height: 120, padding: '0 40px 0 28px', borderRadius: 60, background: '#fff', border: '8px solid #C9BFE4', boxShadow: '0 8px 0 #EADCC8', boxSizing: 'border-box', fontFamily: 'inherit' }}
            >
              <svg aria-hidden="true" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#7B6BAE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
              <span style={{ fontSize: 44, fontWeight: 600, color: '#7B6BAE', lineHeight: 1 }}>Listen &amp; Pick</span>
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
        {current && (
          <div key={index} className="hm-ls-q" data-question-index={index} data-answer-id={current.answer.id} style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
            <ListenQuestion question={current} wrong={wrong} picked={fx?.kind === 'right' && fx.q === index ? current.answerIndex : null} locked={locked} speaking={speaking} onPick={pick} onReplay={replay} />
          </div>
        )}
        {fx && fx.q === index && phase !== 'empty' && phase !== 'loading' && (fx.kind === 'wrong' ? (
          <div data-feedback="wrong" style={{ position: 'absolute', inset: 0, zIndex: FX_Z, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', background: 'rgba(251,244,233,0.55)' }}>
            <div role="status" className="hm-rise" style={{ display: 'flex', alignItems: 'center', gap: 28, padding: '36px 64px 36px 40px', borderRadius: 80, background: '#fff', boxShadow: '0 12px 0 #EADCC8' }}>
              <svg aria-hidden="true" width="110" height="110" viewBox="0 0 24 24" fill="none" stroke="#B8737B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" fill="#F8DCDF" /><path d="M8.5 15.5c1-1 2.2-1.4 3.5-1.4s2.5.4 3.5 1.4" /><path d="M9 9.5h.01" /><path d="M15 9.5h.01" /></svg>
              <span style={{ fontSize: 80, fontWeight: 600, color: '#8A6A5E' }}>Oh-oh… try again!</span>
            </div>
          </div>
        ) : (
          <div data-feedback="right" style={{ position: 'absolute', inset: 0, zIndex: FX_Z, background: 'rgba(251,244,233,0.78)', overflow: 'hidden', pointerEvents: 'none' }}>
            <span className="hm-flash" aria-hidden="true" style={{ position: 'absolute', left: 560, top: 70, width: 800, height: 800, borderRadius: 400, background: 'radial-gradient(circle, rgba(246,226,166,0.9) 0%, rgba(246,226,166,0) 68%)' }} />
            <Confetti count={56} />
            <div role="status" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30 }}>
              <svg className="hm-pop" aria-hidden="true" width="240" height="240" viewBox="0 0 24 24" fill="#EED79A" stroke="#C9A05A" strokeWidth="1" strokeLinejoin="round"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" /></svg>
              <span className="hm-pop" style={{ fontSize: 140, fontWeight: 700, color: '#B8737B', lineHeight: 1 }}>Hooray!</span>
            </div>
          </div>
        ))}
        </>
        )}
        <MusicButton />
        {help && <ListenHelp playHref={null} onClose={closeHelp} />}
      </div>
    </Stage>
  );
}
