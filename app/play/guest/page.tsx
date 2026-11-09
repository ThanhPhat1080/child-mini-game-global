'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BounceText } from '@/components/BounceText';
import { Pic } from '@/components/Pic';
import { SkyScene } from '@/components/play/SkyScene';
import { GenderCards, type GenderRefs } from '@/components/play/GenderCards';
import { GuestDetails } from '@/components/play/GuestDetails';
import type { AgeBand, Gender } from '@/lib/childTheme';
import { saveVisitor, validateVisitor, VISITOR_HEAD } from '@/lib/visitor';
import play from '../sign-in/playSignIn.module.css';
import styles from './guest.module.css';

const FLIP_MS = 600;
const FORM_DELAY_MS = 200;
const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Guest Play setup (spec GU2-GU4): Boy or Girl, then the name and age. OK saves the visitor and goes to Welcome.
 * Nothing is written to the database (GU12). The X returns to the gender choice and keeps the typed name.
 */
export default function GuestSetup() {
  const router = useRouter();
  const [gender, setGender] = useState<Gender | null>(null);
  const [step, setStep] = useState<'gender' | 'details'>('gender');
  const [leaving, setLeaving] = useState<Gender | null>(null);
  const [pickedStyle, setPickedStyle] = useState<{ transform: string } | null>(null);
  const [formOn, setFormOn] = useState(false);
  const [name, setName] = useState('');
  const [ageBand, setAgeBand] = useState<AgeBand>('2-5');
  const refs = useRef<GenderRefs>({ male: null, female: null });
  const headerRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const valid = validateVisitor({ name, gender, ageBand }).ok;

  function pick(g: Gender) {
    const other: Gender = g === 'male' ? 'female' : 'male';
    setGender(g);
    if (reduceMotion()) {
      // reduced motion: a cross-fade only, no glide
      setLeaving(other);
      setStep('details');
      setFormOn(true);
      return;
    }
    // FLIP: the picked card glides to the header avatar slot, the other card fades away, the form follows 200 ms later
    const from = refs.current[g]?.getBoundingClientRect();
    const to = headerRef.current?.getBoundingClientRect();
    if (from && to && from.width > 0 && to.width > 0) {
      setPickedStyle({ transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width})` });
    }
    setLeaving(other);
    setStep('details');
    timer.current = setTimeout(() => setFormOn(true), FORM_DELAY_MS);
  }

  function backToGender() {
    // the reverse of the pick; the typed name stays
    setFormOn(false);
    setStep('gender');
    timer.current = setTimeout(() => {
      setLeaving(null);
      setPickedStyle(null);
    }, FLIP_MS);
  }

  function submit() {
    const checked = validateVisitor({ name, gender, ageBand });
    if (!checked.ok) return;
    saveVisitor(checked.value);
    router.push('/');
  }

  return (
    <div className={`${play.wrap} hm-child`}>
      <div className={play.sky}><SkyScene lively /></div>
      <Pic src="/images/princess.webp" alt="" width={520} height={655} className={`${play.hero} ${play.heroLeft}`} />
      <Pic src="/images/prince.webp" alt="" width={520} height={655} className={`${play.hero} ${play.heroRight}`} />
      <div className={styles.col}>
        {step === 'gender' && (
          <>
            <button type="button" className={styles.back} aria-label="Back" onClick={() => router.push('/play/sign-in')}>&larr;</button>
            <h1 className={styles.who}><BounceText text="Who are you?" delay={0.3} /></h1>
            <GenderCards
              onPick={pick}
              leaving={leaving}
              picked={gender}
              pickedStyle={pickedStyle}
              refs={refs}
            />
          </>
        )}
        <div ref={headerRef} className={`${styles.header} ${step === 'details' ? styles.headerOn : ''} ${gender === 'female' ? styles.headerGirl : ''}`}>
          {gender && <Pic src={VISITOR_HEAD[gender]} alt="" width={320} height={320} className={styles.avatar} />}
        </div>
        {step === 'details' && gender && (
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
