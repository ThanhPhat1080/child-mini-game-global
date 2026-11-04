import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SortBasket } from '@/components/sort/SortBasket';
import type { MemoryCard } from '@/lib/memory/types';

afterEach(cleanup);

const card = (id: string, word: string, image_path = `seed/${word}.svg`): MemoryCard => ({ id, word, image_path, audio_path: null, active: true });

function setup(placed: MemoryCard[] = [], over: Partial<{ example: MemoryCard; index: 0 | 1 }> = {}) {
  const props = {
    index: over.index ?? (0 as 0 | 1),
    basket: { groupId: 'g1', example: over.example ?? card('ex', 'apple') },
    placed,
    onExampleTap: vi.fn(),
    basketRef: vi.fn(),
  };
  render(<SortBasket {...props} />);
  return props;
}

describe('SortBasket', () => {
  it('root is the drop area with data-basket and is given to basketRef', () => {
    const p = setup([], { index: 1 });
    const root = document.querySelector('[data-basket]') as HTMLElement;
    expect(root.getAttribute('data-basket')).toBe('1');
    expect(p.basketRef).toHaveBeenCalledWith(root);
  });

  it('the example is a button named Example that calls onExampleTap', () => {
    const p = setup();
    const b = document.querySelector('[data-basket-example]') as HTMLButtonElement;
    expect(b.tagName).toBe('BUTTON');
    expect(b.getAttribute('aria-label')).toBe('Example');
    fireEvent.click(b);
    expect(p.onExampleTap).toHaveBeenCalledTimes(1);
  });

  it('has three slots; placed cards fill them and carry their id', () => {
    setup([card('p1', 'ball'), card('p2', 'cat')]);
    expect(document.querySelectorAll('[data-slot]')).toHaveLength(3);
    const filled = Array.from(document.querySelectorAll('[data-placed]'));
    expect(filled.map((e) => e.getAttribute('data-placed'))).toEqual(['p1', 'p2']);
    expect(filled.every((e) => e.querySelector('img'))).toBe(true);
  });

  it('never shows a word in the DOM text', () => {
    setup([card('p1', 'ball')]);
    const text = (document.body.textContent ?? '').toLowerCase();
    for (const w of ['apple', 'ball']) expect(text).not.toContain(w);
  });

  it('a missing or broken picture shows a plain placeholder', () => {
    setup([card('p1', 'ball', '')], { example: card('ex', 'apple', '') });
    expect(document.querySelectorAll('[data-placeholder]').length).toBe(2);
    cleanup();
    setup();
    const img = document.querySelector('[data-basket-example] img') as HTMLImageElement;
    fireEvent.error(img);
    expect(document.querySelector('[data-basket-example] [data-placeholder]')).not.toBeNull();
  });
});
