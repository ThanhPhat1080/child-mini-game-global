// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { BIRD_SRC, SkyScene } from '@/components/play/SkyScene';

afterEach(cleanup);

describe('SkyScene birds', () => {
  it('the lively sky has two flying birds, one smaller than the other, plus the clouds', () => {
    const { container } = render(<SkyScene lively />);
    const birds = [...container.querySelectorAll('image')].filter((el) => el.getAttribute('href') === BIRD_SRC);
    expect(birds).toHaveLength(2);
    const [a, b] = birds.map((el) => Number(el.getAttribute('width')));
    expect(b).toBeLessThan(a);
    expect(container.querySelectorAll('ellipse[rx="140"]').length).toBe(5); // the five drifting clouds stay
  });

  it('the plain and festive skies have no birds', () => {
    const { container } = render(<SkyScene festive />);
    expect(container.querySelectorAll('image')).toHaveLength(0);
  });
});
