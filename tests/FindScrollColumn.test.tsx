// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FindScrollColumn } from '@/components/find/FindScrollColumn';

afterEach(cleanup);

/** jsdom has no layout: fake the sizes the column measures. */
function sizes(scrollHeight: number, clientHeight: number) {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(scrollHeight);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(clientHeight);
}

describe('FindScrollColumn (Up / Down buttons instead of a scrollbar)', () => {
  it('shows no buttons when the words fit', () => {
    sizes(400, 600);
    render(<FindScrollColumn reduced={false}><p>words</p></FindScrollColumn>);
    expect(screen.queryByRole('button', { name: 'Up' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Down' })).toBeNull();
  });

  it('shows Up (disabled at the top) and Down when the words overflow; Down scrolls the list', () => {
    sizes(1200, 600);
    render(<FindScrollColumn reduced={false}><p>words</p></FindScrollColumn>);
    const up = screen.getByRole('button', { name: 'Up' }) as HTMLButtonElement;
    const down = screen.getByRole('button', { name: 'Down' }) as HTMLButtonElement;
    expect(up.disabled).toBe(true);
    expect(down.disabled).toBe(false);
    const area = document.querySelector<HTMLElement>('[data-find-scroll-area]')!;
    area.scrollBy = vi.fn() as unknown as typeof area.scrollBy;
    fireEvent.click(down);
    expect(area.scrollBy).toHaveBeenCalledWith({ top: 480, behavior: 'smooth' });
  });

  it('scrolls without animation under reduced motion', () => {
    sizes(1200, 600);
    render(<FindScrollColumn reduced><p>words</p></FindScrollColumn>);
    const area = document.querySelector<HTMLElement>('[data-find-scroll-area]')!;
    area.scrollBy = vi.fn() as unknown as typeof area.scrollBy;
    fireEvent.click(screen.getByRole('button', { name: 'Down' }));
    expect(area.scrollBy).toHaveBeenCalledWith({ top: 480, behavior: 'auto' });
  });
});
