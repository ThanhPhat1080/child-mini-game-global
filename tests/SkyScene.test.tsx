import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SkyScene } from '@/components/play/SkyScene';
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
    expect(balloons(render(<ChildScreen sky={false} />).container)).toBe(0);
  });
});
