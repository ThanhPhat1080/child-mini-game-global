import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SkyFront, SkyScene } from '@/components/play/SkyScene';
import { ChildScreen } from '@/components/ChildScreen';

afterEach(cleanup);

const balloons = (c: HTMLElement) => c.querySelectorAll('ellipse[rx="56"]').length;

describe('SkyScene balloons', () => {
  it('the festive sky has three balloons, the sparse sky two', () => {
    expect(balloons(render(<SkyScene festive />).container)).toBe(3);
    cleanup();
    expect(balloons(render(<SkyScene festive sparse />).container)).toBe(2);
  });
  it('a child screen shows the sparse sky unless the page has its own scene', () => {
    expect(balloons(render(<ChildScreen />).container)).toBe(2);
    cleanup();
    expect(balloons(render(<ChildScreen backdrop={null} />).container)).toBe(0);
  });

  it('on a wide window the bees are not clipped at the stage edge and start at the window edge, like the birds', () => {
    const wide = render(<SkyFront edge={200} />).container;
    expect(wide.querySelector('svg')!.style.overflow).toBe('visible');
    const path = (c: HTMLElement) => c.querySelector('animateMotion')!.getAttribute('path')!;
    const widePath = path(wide);
    cleanup();
    const narrow = render(<SkyFront edge={0} />).container;
    expect(narrow.querySelector('svg')!.style.overflow).toBe('');
    // the first bee comes in from x=-60 on a stage-wide window, from x=-260 with 200px of window past each side
    expect(widePath).toMatch(/^M-260 /);
    expect(path(narrow)).toMatch(/^M-60 /);
  });
});
