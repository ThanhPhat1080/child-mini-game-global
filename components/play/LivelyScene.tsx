import type { ReactNode } from 'react';
import { SkyFront, SkyScene } from '@/components/play/SkyScene';
import styles from '@/components/play/LivelyScene.module.css';

/**
 * The common lively layout for the calm screens around the games (grown-up sign-in, guest setup, Welcome, the picker): the sky with
 * clouds, birds, grass and flowers at the back, then `children` (the heroes), then the bees on top of them. The page content comes
 * after this layout in the DOM, so it sits above the bees. Never use it on /games or in a game: the child needs to focus there.
 * On the stage it is the Stage `backdrop` and gets `edge`, so everything reaches the window's edges (`bleed`).
 */
export function LivelyScene({ children, edge, bleed = edge !== undefined }: { children?: ReactNode; edge?: number; bleed?: boolean }) {
  return (
    <>
      <div className={styles.sky}><SkyScene lively bleed={bleed} edge={edge} /></div>
      {children}
      <div className={styles.front}><SkyFront edge={edge} /></div>
    </>
  );
}
