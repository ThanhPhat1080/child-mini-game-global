import { Pic } from '@/components/Pic';
import { LivelyScene } from '@/components/play/LivelyScene';
import play from '@/app/play/sign-in/playSignIn.module.css';

/** The backdrop of the play sign-in and guest pages: the common lively scene with the princess and prince between sky and bees. */
export function PlayBackdrop() {
  return (
    <LivelyScene>
      <Pic src="/images/princess.webp" alt="" width={520} height={655} className={`${play.hero} ${play.heroLeft}`} />
      <Pic src="/images/prince.webp" alt="" width={520} height={655} className={`${play.hero} ${play.heroRight}`} />
    </LivelyScene>
  );
}
