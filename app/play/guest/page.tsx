'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { BounceText } from '@/components/BounceText';
import { Pic } from '@/components/Pic';
import { SkyScene } from '@/components/play/SkyScene';
import { GenderCards, type GenderRefs } from '@/components/play/GenderCards';
import { GuestDetails } from '@/components/play/GuestDetails';
import type { AgeBand, Gender } from '@/lib/childTheme';
import { saveVisitor, validateVisitor, VISITOR_HEAD } from '@/lib/visitor';
import play from '../sign-in/playSignIn.module.css';
import styles from './guest.module.css';

/** The avatar glides up to the header slot in this long; the form slides up 200 ms after the pick. */
const FLIP_MS = 600;
const FORM_DELAY_MS = 200;
const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** gender: the Boy / Girl choice; moving: the picked card glides up to the header; details: the form. */
type Phase = 'gender' | 'moving' | 'details';

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
    const other: Gender = g === 'male' ? 'female' : 'male';
    setGender(g);
    setLeaving(other);
    if (reduceMotion()) {
      // reduced motion: a cross-fade only, no glide
      setPhase('details');
      setFormOn(true);
      return;
    }
    // the picked card flies from its place up to the header slot (the header sits above the cards)
    const from = refs.current[g]?.getBoundingClientRect();
    const to = headerRef.current?.getBoundingClientRect();
    if (from && to && from.width > 0 && to.width > 0) {
      setPickedStyle({
        transform: `translate(${to.left + to.width / 2 - (from.left + from.width / 2)}px, ${to.top + to.height / 2 - (from.top + from.height / 2)}px) scale(${to.width / from.width})`,
      });
    }
    setPhase('moving');
    timers.current.push(setTimeout(() => setFormOn(true), FORM_DELAY_MS));
    timers.current.push(setTimeout(() => setPhase('details'), FLIP_MS));
  }

  function backToGender() {
    // back to the Boy / Girl choice at once, so both cards can be picked again; the typed name stays
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setFormOn(false);
    setPhase('gender');
    setLeaving(null);
    setPickedStyle(null);
    setGender(null);
  }

  function submit() {
    const checked = validateVisitor({ name, gender, ageBand });
    if (!checked.ok) return;
    saveVisitor(checked.value);
    router.push('/');
  }

  const showChoice = phase !== 'details';

  return (
    <div className={`${play.wrap} ${styles.page} hm-child`}>
      <div className={play.sky}><SkyScene lively /></div>
      <Pic src="/images/princess.webp" alt="" width={520} height={655} className={`${play.hero} ${play.heroLeft}`} />
      <Pic src="/images/prince.webp" alt="" width={520} height={655} className={`${play.hero} ${play.heroRight}`} />
      {phase === 'gender' && (
        <div className={styles.backSlot}>
          <BackButton href="/play/sign-in" label="Back" />
        </div>
      )}
      <div className={styles.col}>
        {phase === 'gender' && (
          <h1 className={styles.who}><BounceText text="Who are you?" delay={0.3} /></h1>
        )}
        {showChoice && (
          <GenderCards
            onPick={pick}
            leaving={leaving}
            picked={gender}
            pickedStyle={pickedStyle}
            refs={refs}
          />
        )}
        <div ref={headerRef} className={`${styles.header} ${phase === 'details' ? styles.headerOn : ''}`}>
          {gender && <Pic src={VISITOR_HEAD[gender]} alt="" width={320} height={320} className={styles.avatar} />}
        </div>
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
