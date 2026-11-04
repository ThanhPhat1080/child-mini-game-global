import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FindLevelTile } from '@/components/find/FindLevelTile';
import { SpotLevelTile } from '@/components/spot/SpotLevelTile';
import type { FindLevel } from '@/lib/find/types';
import type { SpotLevel } from '@/lib/spot/types';

afterEach(cleanup);

const findLevel = { id: 'F1', image_path: 'seed/find.svg', objects: [], active: true, sort_order: 1 } as unknown as FindLevel;
const spotLevel = { id: 'S1', image_a_path: 'seed/a.svg', image_b_path: 'seed/b.svg', differences: [], active: true, sort_order: 1 } as unknown as SpotLevel;

describe('level thumbnails are squares (ADR-032)', () => {
  it('a Find It level tile has a 1:1 frame', () => {
    const { container } = render(<FindLevelTile level={findLevel} index={0} />);
    const style = container.querySelector<HTMLElement>('a')!.getAttribute('style') ?? '';
    expect(style).toContain('aspect-ratio: 1 / 1');
    expect(style).not.toContain('4 / 3');
  });

  it('a Spot the Differences level tile has a 1:1 frame', () => {
    const { container } = render(<SpotLevelTile level={spotLevel} index={0} />);
    const style = container.querySelector<HTMLElement>('a')!.getAttribute('style') ?? '';
    expect(style).toContain('aspect-ratio: 1 / 1');
    expect(style).not.toContain('4 / 3');
  });
});
