import type { ReactNode } from 'react';
import { SkyFront, SkyScene } from '@/components/play/SkyScene';
import styles from '@/components/play/LivelyScene.module.css';

/**
 * The common lively layout for the calm screens around the games (grown-up sign-in, guest setup, Welcome): the sky with clouds,
 * birds, grass and flowers at the back, then `children` (the heroes), then the bees on top of them. The page content comes after
 * this layout in the DOM, so it sits above the bees. Never use it on /games or in a game: the child needs to focus there.
 */
export function LivelyScene({ children }: { children?: ReactNode }) {
  return (
    <>
      <div className={styles.sky}><SkyScene lively /></div>
      {children}
      <div className={styles.front}><SkyFront /></div>
    </>
  );
}
