import { Pic } from '@/components/Pic';
import { LivelyScene } from '@/components/play/LivelyScene';
import play from '@/app/play/sign-in/playSignIn.module.css';

/** The backdrop of the play sign-in and guest pages: the common lively scene with the princess and prince between sky and bees. */
export function PlayBackdrop({ stage = false, edge }: { stage?: boolean; edge?: number }) {
  // on the 1920x1080 stage (the picker) the characters are sized in stage pixels, not window units
  const pos = (side: 'left' | 'right') => (stage ? { width: 380, [side]: 24 } : undefined);
  return (
    <LivelyScene edge={edge}>
      <Pic src="/images/princess.webp" alt="" width={520} height={655} className={`${play.hero} ${play.heroLeft}`} style={pos('left')} />
      <Pic src="/images/prince.webp" alt="" width={520} height={655} className={`${play.hero} ${play.heroRight}`} style={pos('right')} />
    </LivelyScene>
  );
}
