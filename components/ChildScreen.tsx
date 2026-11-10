'use client';

import type { ReactNode } from 'react';
import { BackButton } from '@/components/BackButton';
import { MusicButton } from '@/components/MusicButton';
import { Stage, useStageScale } from '@/components/Stage';
import LeaveGameButton from '@/components/auth/LeaveGameButton';
import LogoutButton from '@/components/auth/LogoutButton';
import { SkyScene } from '@/components/play/SkyScene';
import type { Game } from '@/lib/games/registry';

/** Where the round Back button sits on every child screen (1920x1080 stage pixels). */
export const BACK_CORNER = { top: 48, left: 56 } as const;

export type ChildBack = { href: string; label?: string; home?: boolean; game?: Game['id'] };

/** The corner controls a child screen may show: Back (top-left), music (bottom-right), Leave game, grown-up sign-out. */
export type ChildCornerProps = { back?: ChildBack; music?: boolean; leave?: boolean; logout?: boolean };

/** The round Back button in its one place. A page that shows Back only in some states renders this where it needs it. */
export function CornerBack(back: ChildBack) {
  return (
    <div style={{ position: 'absolute', top: BACK_CORNER.top, left: BACK_CORNER.left, zIndex: 5 }}>
      <BackButton {...back} />
    </div>
  );
}

/**
 * The corner controls in their one fixed place. Music, Leave game and sign-out place themselves in the stage corners;
 * Back is placed here, so no page repeats its own top and left. Must sit inside the 1920x1080 stage.
 */
export function ChildCorners({ back, music, leave, logout }: ChildCornerProps) {
  return (
    <>
      {back && <CornerBack {...back} />}
      {music && <MusicButton />}
      {leave && <LeaveGameButton />}
      {logout && <LogoutButton />}
    </>
  );
}

/**
 * A child screen on the 1920x1080 stage plus its corner controls. Children draw the page; the corners stay uniform.
 * Behind it sits the calm sky (sun, clouds, two balloons); a page with a scene of its own (Welcome, /play) passes `sky={false}`.
 */
export function ChildScreen({ children, sky = true, ...corners }: ChildCornerProps & { children?: ReactNode; sky?: boolean }) {
  return (
    <Stage>
      {sky && <SkyScene festive sparse hills={false} />}
      {children}
      <ChildCorners {...corners} />
    </Stage>
  );
}

/**
 * The same corner controls for a page that is laid out in the window, not on the stage (the play sign-in and the
 * Guest Play setup). Each corner gets its own invisible 1920x1080 sheet, scaled like the stage but pinned to that
 * corner of the window, so a control keeps its stage size and sits in its corner at any window shape: Back top-left,
 * Leave game and sign-out bottom-left, music bottom-right. Add a control to a corner here, not on the page.
 */
export function WindowCorners({ back, music, leave, logout }: ChildCornerProps) {
  const scale = useStageScale();
  const sheet = (corner: 'tl' | 'bl' | 'br', children: ReactNode) => (
    <div
      style={{
        position: 'fixed', width: 1920, height: 1080, transform: `scale(${scale})`, pointerEvents: 'none', zIndex: 3,
        ...(corner === 'tl' ? { left: 0, top: 0, transformOrigin: 'top left' } : corner === 'bl' ? { left: 0, bottom: 0, transformOrigin: 'bottom left' } : { right: 0, bottom: 0, transformOrigin: 'bottom right' }),
      }}
    >
      <div style={{ pointerEvents: 'auto' }}>{children}</div>
    </div>
  );
  return (
    <>
      {back && sheet('tl', <CornerBack {...back} />)}
      {(leave || logout) && sheet('bl', <>{leave && <LeaveGameButton />}{logout && <LogoutButton />}</>)}
      {music && sheet('br', <MusicButton />)}
    </>
  );
}
