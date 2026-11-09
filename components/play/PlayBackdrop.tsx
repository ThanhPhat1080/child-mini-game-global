import { Pic } from '@/components/Pic';
import { SkyFront, SkyScene } from '@/components/play/SkyScene';
import play from '@/app/play/sign-in/playSignIn.module.css';

/**
 * The backdrop of the play sign-in and guest pages, back to front: the lively sky (clouds, then birds), the princess and
 * prince, then the bees (above the two heroes, under the page content, which sits at z-index 1).
 */
export function PlayBackdrop() {
  return (
    <>
      <div className={play.sky}><SkyScene lively /></div>
      <Pic src="/images/princess.webp" alt="" width={520} height={655} className={`${play.hero} ${play.heroLeft}`} />
      <Pic src="/images/prince.webp" alt="" width={520} height={655} className={`${play.hero} ${play.heroRight}`} />
      <div className={play.skyFront}><SkyFront /></div>
    </>
  );
}
