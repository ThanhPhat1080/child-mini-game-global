'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WindowCorners } from '@/components/ChildScreen';
import { BounceText } from '@/components/BounceText';
import { PlayBackdrop } from '@/components/play/PlayBackdrop';
import { GenderCards, type GenderRefs } from '@/components/play/GenderCards';
import { GuestDetails } from '@/components/play/GuestDetails';
import type { AgeBand, Gender } from '@/lib/childTheme';
import { saveVisitor, validateVisitor } from '@/lib/visitor';
import play from '../sign-in/playSignIn.module.css';
import styles from './guest.module.css';

/** The picked avatar glides to its fixed spot in GLIDE_MS; only then does the form rise (FORM_MS). X runs it backwards. */
const GLIDE_MS = 650;
const CLOSE_MS = 700;
const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** gender: Boy / Girl; moving: the avatar glides up; details: the form; closing: the form sinks and the avatar returns. */
type Phase = 'gender' | 'moving' | 'details' | 'closing';

/**
 * Guest Play setup (spec GU2-GU4): Boy or Girl, then the name and age. Play now! saves the visitor and goes to Welcome.
 * Nothing is written to the database (GU12). The X returns to the gender choice and keeps the typed name.
 */
export default function GuestSetup() {
  const router = useRouter();
  const [gender, setGender] = useState<Gender | null>(null);
  const [phase, setPhase] = useState<Phase>('gender');
  const [leaving, setLeaving] = useState<Gender | null>(null);
  const [pickedStyle, setPickedStyle] = useState<{ transform: string } | null>(null);
  const [formOn, setFormOn] = useState(false);
  const [name, setName] = useState('');
  const [ageBand, setAgeBand] = useState<AgeBand>('2-5');
  const refs = useRef<GenderRefs>({ male: null, female: null });
  const headerRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const valid = validateVisitor({ name, gender, ageBand }).ok;

  function pick(g: Gender) {
    if (phase !== 'gender') return;
    setGender(g);
    setLeaving(g === 'male' ? 'female' : 'male');
    if (reduceMotion()) {
      // reduced motion: a cross-fade only, no glide
      setPhase('details');
      setFormOn(true);
      return;
    }
    // the avatar ring flies to the fixed header spot; the layout above it does not move (the title only fades)
    const card = refs.current[g];
    const ring = card?.firstElementChild?.getBoundingClientRect();
    const box = card?.getBoundingClientRect();
    const to = headerRef.current?.getBoundingClientRect();
    if (card && ring && box && to && ring.width > 0 && to.width > 0) {
      const s = to.width / ring.width;
      const ox = box.left + box.width / 2;
      const oy = box.top + box.height / 2;
      const dx = to.left + to.width / 2 - ox - s * (ring.left + ring.width / 2 - ox);
      const dy = to.top + to.height / 2 - oy - s * (ring.top + ring.height / 2 - oy);
      setPickedStyle({ transform: `translate(${dx}px, ${dy}px) scale(${s})` });
    }
    setPhase('moving');
    // the form rises only after the avatar has arrived
    timers.current.push(setTimeout(() => { setPhase('details'); setFormOn(true); }, GLIDE_MS));
  }

  function backToGender() {
    // the form sinks away, the avatar glides home and grows back, the other avatar fades in; the typed name stays
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setFormOn(false);
    if (reduceMotion()) { reset(); return; }
    setPhase('closing');
    setLeaving(null);
    setPickedStyle(null);
    timers.current.push(setTimeout(reset, CLOSE_MS));
  }

  function reset() {
    setPhase('gender');
    setGender(null);
  }

  function submit() {
    const checked = validateVisitor({ name, gender, ageBand });
    if (!checked.ok) return;
    saveVisitor(checked.value);
    router.push('/');
  }

  const locked = phase !== 'gender';

  return (
    <div className={`${play.wrap} ${styles.page} hm-child`}>
      <PlayBackdrop />
      {phase === 'gender' && <WindowCorners back={{ href: '/play/sign-in', label: 'Back' }} />}
      <div className={styles.col}>
        <h1 className={`${styles.who} ${locked ? styles.whoOff : ''}`}><BounceText text="Who are you?" delay={0.3} /></h1>
        <GenderCards
          onPick={pick}
          leaving={leaving}
          picked={gender}
          pickedStyle={pickedStyle}
          refs={refs}
          locked={locked}
        />
        <div ref={headerRef} className={styles.header} aria-hidden="true" />
        {gender && phase !== 'gender' && (
          <div className={`${styles.details} ${formOn ? styles.detailsOn : ''}`}>
            <GuestDetails
              gender={gender}
              name={name}
              ageBand={ageBand}
              valid={valid}
              onName={setName}
              onAge={setAgeBand}
              onClose={backToGender}
              onSubmit={submit}
            />
          </div>
        )}
      </div>
    </div>
  );
}
