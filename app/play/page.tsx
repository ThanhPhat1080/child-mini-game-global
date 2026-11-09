'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listMyChildren, type Child } from '@/lib/children';
import { getMyUserId } from '@/lib/review';
import { setActiveChild, setGuestPlay } from '@/lib/childSession';
import { clearVisitor } from '@/lib/visitor';
import { handleChoiceKey, isPressKey } from '@/lib/keynav';
import { ChildScreen } from '@/components/ChildScreen';
import { BounceText } from '@/components/BounceText';
import AdultCheck from '@/components/auth/AdultCheck';
import StopHandIcon from '@/components/auth/StopHandIcon';
import ChildPickCard from '@/components/play/ChildPickCard';
import GuestPickCard from '@/components/play/GuestPickCard';
import ParentConfigCard from '@/components/play/ParentConfigCard';
import { SkyScene } from '@/components/play/SkyScene';
import PinEntry from '@/components/play/PinEntry';
import styles from '@/components/play/play.module.css';

const cards = () => Array.from(document.querySelectorAll<HTMLElement>('[data-pick-card]'));

/** Who is playing? (K7, KU9-KU12) A card per child, then the Parent Configuration shortcut. No text for the child to read. */
export default function Play() {
  const router = useRouter();
  const [kids, setKids] = useState<Child[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<Child | null>(null);
  const [check, setCheck] = useState(false);
  const lastPicked = useRef<string | null>(null);
  // 4 or fewer cards in total keeps the large size; with 5 children the six cards use the small size (FP2)
  const size = kids && kids.length + 1 <= 4 ? 'large' : 'small';

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const me = await getMyUserId();
      if (!me) {
        router.replace('/play/sign-in');
        return;
      }
      setKids((await listMyChildren(undefined, me)).filter((c) => c.parent_id === me));
    } catch {
      setFailed(true);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  // focus the first card once the cards are there, and give focus back to the card after leaving the PIN step
  useEffect(() => {
    if (kids && !picked && !check) {
      const all = cards();
      (all.find((el) => el.dataset.childId === lastPicked.current) ?? all[0])?.focus();
    }
  }, [kids, picked, check]);

  useEffect(() => {
    if (!kids || picked || check) return;
    const onKey = (e: KeyboardEvent) => {
      handleChoiceKey(e, cards());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [kids, picked, check]);

  function onCorrect(child: Child) {
    clearVisitor(); // a guest setup left behind must not stand in for the child
    setActiveChild(child.id);
    router.push('/');
  }

  // No child yet: Guest plays without a PIN (there is no child to protect), global content only. It uses the same
  // setup as a visitor (Boy or Girl, name, age); the guest cookie keeps the signed-in parent's door open.
  function onGuest() {
    setGuestPlay();
    router.push('/play/guest');
  }

  return (
    <ChildScreen logout music>
      <SkyScene festive />
      {failed ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button type="button" className={`hm-tap ${styles.retry}`} aria-label="Try again" onClick={() => void load()} autoFocus>
            <svg aria-hidden="true" width="110" height="110" viewBox="0 0 24 24" fill="none" stroke="#7A5C50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 12a8 8 0 1 1-2.4-5.7" />
              <path d="M20 4v5h-5" />
            </svg>
          </button>
        </div>
      ) : (
        kids && (
          <>
            <h1 className={styles.title}><BounceText text="Who are you?" delay={0.3} /></h1>
            <div
              style={{ position: 'absolute', left: 60, right: 60, top: 240, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: size === 'large' ? 32 : 24 }}
              onKeyDown={(e) => {
                const el = e.target as HTMLElement;
                if (isPressKey(e) && el.hasAttribute('data-pick-card')) {
                  e.preventDefault();
                  el.click();
                }
              }}
            >
              {kids.map((c) => (
                <ChildPickCard key={c.id} child={c} size={size} onPick={() => { lastPicked.current = c.id; setPicked(c); }} />
              ))}
              {kids.length === 0 && <GuestPickCard size={size} onPick={onGuest} />}
              <ParentConfigCard size={size} onOpen={() => setCheck(true)} />
            </div>
          </>
        )
      )}
      {picked && <PinEntry child={picked} onCorrect={() => onCorrect(picked)} onCancel={() => setPicked(null)} />}
      <AdultCheck open={check} title="Grown-ups only" hint="Solve the sum to open Parent configuration." icon={<StopHandIcon />} centered twoDigit submitLabel="OK" onPass={() => { setCheck(false); router.push('/admin'); }} onCancel={() => setCheck(false)} />
    </ChildScreen>
  );
}
