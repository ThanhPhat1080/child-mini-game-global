// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { BEE_CYCLE, BEES, BIRDS, BIRD_SRC, BLUE_BIRD_SRC, PINK_BIRD_SRC, SkyFront, SkyScene, flowerSeat } from '@/components/play/SkyScene';
import { PlayBackdrop } from '@/components/play/PlayBackdrop';
import { wavePath } from '@/components/play/SkyBees';

afterEach(cleanup);

const endOf = (d: string) => d.trim().split(/[\s,CM]+/).filter(Boolean).slice(-2).map(Number);

describe('SkyScene birds and bees', () => {
  it('the lively sky has two yellow birds (one smaller), a pale blue bird and three mirrored pink birds, plus the clouds', () => {
    const { container } = render(<SkyScene lively />);
    const images = [...container.querySelectorAll('image')];
    const yellow = images.filter((el) => el.getAttribute('href') === BIRD_SRC);
    expect(yellow).toHaveLength(2);
    const [a, b] = yellow.map((el) => Number(el.getAttribute('width')));
    expect(b).toBeLessThan(a);
    const pink = images.filter((el) => el.getAttribute('href') === PINK_BIRD_SRC);
    expect(pink).toHaveLength(3);
    pink.forEach((el) => expect(el.getAttribute('transform')).toBe('scale(-1 1)')); // faces left: they fly the other way
    const blue = images.filter((el) => el.getAttribute('href') === BLUE_BIRD_SRC);
    expect(blue).toHaveLength(1);
    expect(blue[0].getAttribute('transform')).toBeNull();
    expect(container.querySelectorAll('ellipse[rx="140"]').length).toBe(5); // the five drifting clouds stay
    // every bird is drawn after every cloud, so it flies in front of them
    const lastCloud = [...container.querySelectorAll('ellipse[rx="140"]')].pop()!;
    images.forEach((img) => expect(lastCloud.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy());
  });

  it('two small pink birds follow the big pink bird: same pace and start, a little behind it', () => {
    const [lead, ...kids] = BIRDS.filter((b) => b.src === PINK_BIRD_SRC);
    expect(kids).toHaveLength(2);
    for (const kid of kids) {
      expect(kid.w).toBeLessThan(lead.w);
      expect([kid.dur, kid.delay, kid.back]).toEqual([lead.dur, lead.delay, true]);
      expect(kid.dx! - (lead.dx ?? 0)).toBeGreaterThan(0); // flying left, so behind means farther right
    }
  });

  it('three bees fly legs that land on flowers, then leave the screen', () => {
    const { container } = render(<SkyFront />);
    const bees = container.querySelectorAll('[data-bee]');
    expect(bees).toHaveLength(3);
    const seats = [2, 3, 4].map(flowerSeat).map((p) => p.join(','));
    BEES.forEach((bee) => {
      const legs = bee.legs.map((l) => l.to);
      expect(legs.slice(0, -1).every((p) => seats.includes(p.join(',')))).toBe(true); // every stop is a flower
      const [x] = legs[legs.length - 1];
      expect(x < 0 || x > 1920).toBe(true); // the last leg flies off-screen
    });
    const motions = container.querySelectorAll('[data-bee="beeA"] animateMotion');
    expect(motions).toHaveLength(BEES[0].legs.length);
    expect(endOf(motions[0].getAttribute('path')!)).toEqual(flowerSeat(2));
  });

  it('every bee route lasts one cycle, so two bees never meet on a flower as the loops go on', () => {
    for (const bee of BEES) {
      const total = bee.legs.reduce((s, l) => s + l.secs + l.rest, 0) + bee.wait;
      expect(total).toBeCloseTo(BEE_CYCLE, 5);
    }
  });

  it('a wave path starts and ends exactly on its points', () => {
    const d = wavePath([0, 0], [300, 40], 3, 20);
    expect(d.startsWith('M0 0')).toBe(true);
    expect(endOf(d)).toEqual([300, 40]);
  });

  it('the backdrop stacks sky, princess, prince, then the bees on top, and the bee layer lets clicks through', () => {
    const { container } = render(<PlayBackdrop />);
    expect(container.querySelector('svg [data-bee]')).toBeTruthy();
    const order = [...container.children].map((el) => el.querySelector('[data-bee]') ? 'bees' : el.querySelector('image') ? 'sky' : el.getAttribute('src')?.includes('princess') ? 'princess' : el.getAttribute('src')?.includes('prince') ? 'prince' : el.tagName);
    expect(order).toEqual(['sky', 'princess', 'prince', 'bees']);
    expect((container.lastElementChild!.querySelector('svg') as SVGElement).style.pointerEvents).toBe('none');
  });

  it('the back sky has no bees; the plain and festive skies have no birds and no bees', () => {
    expect(render(<SkyScene lively />).container.querySelectorAll('[data-bee]')).toHaveLength(0);
    cleanup();
    const { container } = render(<SkyScene festive />);
    expect(container.querySelectorAll('image')).toHaveLength(0);
    expect(container.querySelectorAll('[data-bee]')).toHaveLength(0);
  });
});
