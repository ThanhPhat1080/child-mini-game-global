// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Pic } from '@/components/Pic';

afterEach(cleanup);

describe('Pic', () => {
  it('renders pictures as not draggable (NS3)', () => {
    const { container } = render(<Pic src="/seed/fish.svg" alt="" width={100} height={100} />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('draggable')).toBe('false');
  });

  it('lets a caller override draggable', () => {
    const { container } = render(<Pic src="/seed/fish.svg" alt="" width={100} height={100} draggable />);
    expect(container.querySelector('img')?.getAttribute('draggable')).toBe('true');
  });
});
