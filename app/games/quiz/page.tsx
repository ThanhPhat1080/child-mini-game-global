'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { familyOrGlobal, ownerFirst, playerId } from '@/lib/review';
import { Stage } from '@/components/Stage';
import { Hills } from '@/components/Hills';
import { BackButton } from '@/components/BackButton';
import { SetCard, type SetCardData } from '@/components/SetCard';
import { MusicButton } from '@/components/MusicButton';
import { QuizHelp } from '@/components/QuizHelp';
import { handleChoiceKey } from '@/lib/keynav';
import { hasAnswerContent } from '@/lib/sets';

const PITCH = 544; // card width 480 + gap 64
const cards = () => Array.from(document.querySelectorAll<HTMLElement>('a[data-set-card]'));

type Row = Omit<SetCardData, 'count'> & { questions: { prompt_text: string | null; prompt_audio_path: string | null; answers: { image_path: string | null; text: string | null; is_correct: boolean }[] }[] };

function isComplete(q: Row['questions'][number]): boolean {
  const a = q.answers;
  return (!!q.prompt_text?.trim() || !!q.prompt_audio_path) && a.length >= 2 && a.length <= 3 && a.every((x) => hasAnswerContent(x.image_path, x.text)) && a.filter((x) => x.is_correct).length === 1;
}

/** Quiz set selection (C3/C11). Only published sets are visible to anon (RLS). */
export default function QuizSets() {
  const [sets, setSets] = useState<SetCardData[] | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [help, setHelp] = useState(false);
  const [idx, setIdx] = useState(0);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const helpBtn = useRef<HTMLButtonElement>(null);
  const startX = useRef(0);
  const scale = useRef(1);
  const moved = useRef(false);
  const pressIdx = useRef<number | null>(null);
  const pressing = useRef(false);
  const n = sets?.length ?? 0;

  useEffect(() => {
    playerId()
      .then(async (me) => {
        const { data } = await familyOrGlobal(
          createSupabaseBrowserClient()
            .from('quiz_sets')
            .select('id, title, subtitle, heading_color, cover_path, owner_id, questions(prompt_text, prompt_audio_path, answers(image_path, text, is_correct))')
            .eq('status', 'published'),
          me,
        ).order('position');
        const rows = ownerFirst((data as unknown as Row[]) ?? [], me).map((r) => ({ ...r, count: r.questions.filter(isComplete).length })).filter((r) => r.count > 0);
        setSets(rows);
        const d: Record<string, boolean> = {};
        try { rows.forEach((r) => { if (localStorage.getItem(`childPlayer:done:${r.id}`)) d[r.id] = true; }); } catch { /* storage blocked */ }
        setDone(d);
      });
  }, []);

  // keyboard: start on the first set; arrows move between sets; Enter or Space opens the focused one
  useEffect(() => {
    if (sets && sets.length > 0) cards()[0]?.focus();
  }, [sets]);
  useEffect(() => {
    if (help) return;
    const onKey = (e: KeyboardEvent) => {
      const items = cards();
      // after a dot or arrow click no set has focus: step from the centered one, not from the first
      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !items.includes(document.activeElement as HTMLElement) && items.length > 0) {
        e.preventDefault();
        items[Math.max(0, Math.min(items.length - 1, idx + (e.key === 'ArrowRight' ? 1 : -1)))].focus();
        return;
      }
      handleChoiceKey(e, items);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [help, idx]);

  const go = (d: number) => { setIdx((v) => Math.max(0, Math.min(n - 1, v + d))); setDx(0); setDragging(false); };
  const base = 720 - idx * PITCH;
  const slide = dragging ? 'none' : 'transform .7s cubic-bezier(.3,.7,.2,1)';
  const arrow = (side: 'left' | 'right'): React.CSSProperties => ({ position: 'absolute', [side]: 56, top: 440, width: 120, height: 120, borderRadius: 60, border: 'none', background: '#fff', boxShadow: '0 8px 0 #EADCC8', display: 'flex', alignItems: 'center', justifyContent: 'center' });

  return (
    <Stage>
      <Hills />
      <div style={{ position: 'absolute', top: 48, zIndex: 2, left: 56, right: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <BackButton href="/games" label="Back to games" game="quiz" />
        <button
          ref={helpBtn}
          type="button"
          className="hm-tap"
          aria-label="What is Quiz? Show how to play"
          onClick={() => setHelp(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 16, height: 120, padding: '0 40px 0 28px', borderRadius: 60, background: '#fff', border: '8px solid #EBB7BC', boxShadow: '0 8px 0 #EADCC8', boxSizing: 'border-box', fontFamily: 'inherit' }}
        >
          <svg aria-hidden="true" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#B8737B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
          <span style={{ fontSize: 44, fontWeight: 600, color: '#B8737B', lineHeight: 1 }}>Quiz</span>
        </button>
      </div>
      {sets && sets.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72, fontWeight: 600, color: '#8A6A5E' }}>
          New quizzes are coming soon!
        </div>
      )}
      {sets && sets.length > 0 && (
        <div
          className="hm-view"
          aria-label="Quiz sets. Use left and right arrows or drag to browse."
          style={{ position: 'absolute', inset: 0 }}
          onPointerDown={(e) => { const r = e.currentTarget.getBoundingClientRect(); scale.current = r.width / 1920 || 1; startX.current = e.clientX; moved.current = false; pressIdx.current = idx; pressing.current = true; }}
          onPointerMove={(e) => {
            if (!pressing.current) return;
            const d = (e.clientX - startX.current) / scale.current;
            // the track only follows the mouse (no animation) once it is a real drag, so a plain tap still slides smoothly
            if (Math.abs(d) > 10) { moved.current = true; setDragging(true); setDx(d); }
          }}
          onPointerUp={() => { pressing.current = false; if (!dragging) return; let t = idx; if (dx < -120) t = Math.min(n - 1, t + 1); else if (dx > 120) t = Math.max(0, t - 1); setIdx(t); setDx(0); setDragging(false); }}
          onPointerCancel={() => { pressing.current = false; setDragging(false); setDx(0); }}
          onPointerLeave={() => { pressing.current = false; if (dragging) { setDragging(false); setDx(0); } }}
        >
          <div style={{ position: 'absolute', top: 180, left: 0, display: 'flex', gap: 64, transform: `translateX(${base + dx}px)`, transition: slide }}>
            {sets.map((s, i) => (
              <div key={s.id} style={{ flex: 'none', width: 480, height: 700, transform: `scale(${i === idx ? 1 : 0.86})`, opacity: i === idx ? 1 : 0.7, transition: dragging ? 'none' : 'transform .7s cubic-bezier(.3,.7,.2,1), opacity .7s ease' }}>
                <Link
                  href={`/games/quiz/${s.id}`}
                  data-set-card
                  draggable={false}
                  className="hm-card"
                  aria-label={`${s.title}, ${s.count} questions${done[s.id] ? ', completed' : ''}`}
                  style={{ display: 'block', borderRadius: 56 }}
                  onFocus={() => { setIdx(i); setDx(0); }}
                  onClick={(e) => {
                    // a drag, or a tap on a side card, only moves the carousel; the centered card opens its set
                    if (moved.current) e.preventDefault();
                    else if (pressIdx.current !== null && pressIdx.current !== i) { e.preventDefault(); setIdx(i); }
                    pressIdx.current = null;
                  }}
                >
                  <SetCard set={s} index={i} done={done[s.id]} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {n > 1 && (
        <>
          <button type="button" className="hm-arrow hm-tap" aria-label="Previous set" disabled={idx === 0} onClick={() => go(-1)} style={arrow('left')}>
            <svg aria-hidden="true" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#7A5C50" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <button type="button" className="hm-arrow hm-tap" aria-label="Next set" disabled={idx === n - 1} onClick={() => go(1)} style={arrow('right')}>
            <svg aria-hidden="true" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#7A5C50" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
          </button>
          <div role="group" aria-label="Pick a set" style={{ position: 'absolute', left: 0, right: 0, top: 896, display: 'flex', justifyContent: 'center' }}>
            {sets?.map((s, i) => (
              <button key={s.id} type="button" className="hm-tap" aria-label={`Go to set ${i + 1}`} aria-current={i === idx} onClick={() => { setIdx(i); setDx(0); setDragging(false); }} style={{ width: 120, height: 120, padding: 0, border: 'none', background: 'none', borderRadius: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ display: 'block', height: 22, borderRadius: 11, transition: 'width .5s ease', width: i === idx ? 56 : 22, background: i === idx ? '#E59AA1' : '#E3D5C4' }} />
              </button>
            ))}
          </div>
        </>
      )}
      <MusicButton />
      {help && <QuizHelp playHref={null} onClose={() => { setHelp(false); setTimeout(() => helpBtn.current?.focus(), 0); }} />}
    </Stage>
  );
}
