'use client';

import type { ReactNode } from 'react';
import { BackButton } from '@/components/BackButton';
import { MusicButton } from '@/components/MusicButton';
import { Stage, useStageScale } from '@/components/Stage';
import LeaveGameButton from '@/components/auth/LeaveGameButton';
import LogoutButton from '@/components/auth/LogoutButton';
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

/** A child screen on the 1920x1080 stage plus its corner controls. Children draw the page; the corners stay uniform. */
export function ChildScreen({ children, ...corners }: ChildCornerProps & { children?: ReactNode }) {
  return (
    <Stage>
      {children}
      <ChildCorners {...corners} />
    </Stage>
  );
}

/**
 * The same corner controls for a page that is laid out in the window, not on the stage (Guest Play setup): they are
 * drawn on an invisible 1920x1080 sheet scaled like the stage, so they keep the stage size and place.
 */
export function WindowCorners(props: ChildCornerProps) {
  const scale = useStageScale();
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transform: `scale(${scale})`, transformOrigin: 'top left', pointerEvents: 'none', zIndex: 3 }}>
      <div style={{ pointerEvents: 'auto' }}>
        <ChildCorners {...props} />
      </div>
    </div>
  );
}
