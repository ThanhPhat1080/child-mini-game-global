import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fetchActiveCards: vi.fn(), push: vi.fn() }));

vi.mock('@/lib/memory/cards', () => ({ fetchActiveCards: h.fetchActiveCards }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }), usePathname: () => '/games/memory' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('@/components/MusicButton', () => ({ MusicButton: () => null }));

import MemoryLevels from '@/app/games/memory/page';

const cards = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, word: `w${i}`, image_path: 'a.svg', audio_path: null, active: true }));
const link = (n: number) => screen.getByRole('link', { name: `${n} cards` });

beforeEach(() => {
  h.fetchActiveCards.mockReset();
  h.push.mockReset();
});
afterEach(cleanup);

describe('Memory level select (M1)', () => {
  const ALL = [12, 16, 20, 24, 30];

  it('4 cards: all five levels are disabled buttons', async () => {
    h.fetchActiveCards.mockResolvedValue(cards(4));
    render(<MemoryLevels />);
    for (const n of ALL) {
      const b = (await screen.findByRole('button', { name: `${n} cards` })) as HTMLButtonElement;
      expect(b.disabled).toBe(true);
      expect(b.getAttribute('aria-disabled')).toBe('true');
    }
    expect(screen.queryByRole('link', { name: /cards/ })).toBeNull();
  });

  it.each([[6, [12]], [8, [12, 16]], [10, [12, 16, 20]], [12, [12, 16, 20, 24]], [15, ALL]])(
    '%i cards: exactly levels %j are links with their href, the rest disabled buttons',
    async (n, on) => {
      h.fetchActiveCards.mockResolvedValue(cards(n));
      render(<MemoryLevels />);
      await screen.findByRole('link', { name: '12 cards' });
      expect(screen.getAllByRole('link', { name: /cards/ })).toHaveLength(on.length);
      expect(screen.queryAllByRole('button', { name: /cards/ }).filter((b) => (b as HTMLButtonElement).disabled)).toHaveLength(ALL.length - on.length);
      for (const l of ALL) {
        if (on.includes(l)) expect(link(l).getAttribute('href')).toBe(`/games/memory/${l}`);
        else expect((screen.getByRole('button', { name: `${l} cards` }) as HTMLButtonElement).disabled).toBe(true);
      }
    },
  );

  it('shows five buttons in one row, each with its mini grid of the right shape', async () => {
    h.fetchActiveCards.mockResolvedValue(cards(15));
    render(<MemoryLevels />);
    await screen.findByRole('link', { name: '12 cards' });
    const shapes: Record<number, [number, number]> = { 12: [4, 3], 16: [4, 4], 20: [5, 4], 24: [6, 4], 30: [6, 5] };
    const group = screen.getByRole('group', { name: 'Choose how many cards' });
    expect(group.querySelectorAll('[data-level]')).toHaveLength(5);
    for (const l of ALL) {
      const grid = link(l).querySelector('span') as HTMLElement;
      const [cols, rows] = shapes[l];
      expect(grid.style.gridTemplateColumns).toBe(`repeat(${cols}, 1fr)`);
      expect(grid.children).toHaveLength(cols * rows);
    }
  });

  it('0 cards shows a friendly picture screen, no alert, no level buttons', async () => {
    h.fetchActiveCards.mockResolvedValue([]);
    render(<MemoryLevels />);
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('link', { name: /cards/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /cards/ })).toBeNull();
  });

  it('a fetch error shows the same friendly screen, not an alert', async () => {
    h.fetchActiveCards.mockRejectedValue(new Error('boom'));
    render(<MemoryLevels />);
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: /cards/ })).toBeNull();
  });

  it('the first enabled level is focused on arrival', async () => {
    h.fetchActiveCards.mockResolvedValue(cards(15));
    render(<MemoryLevels />);
    const first = await screen.findByRole('link', { name: '12 cards' });
    await waitFor(() => expect(document.activeElement).toBe(first));
  });

  it('Right and Left move among enabled levels only', async () => {
    h.fetchActiveCards.mockResolvedValue(cards(15));
    render(<MemoryLevels />);
    await waitFor(() => expect(document.activeElement).toBe(link(12)));
    for (const n of [16, 20, 24, 30]) {
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(link(n));
    }
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(link(24));
  });

  it('with 10 cards Right stops at 20 (24 and 30 are disabled)', async () => {
    h.fetchActiveCards.mockResolvedValue(cards(10));
    render(<MemoryLevels />);
    await waitFor(() => expect(document.activeElement).toBe(link(12)));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(link(16));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(link(20));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(link(20));
  });

  it('Right skips disabled levels (stays on the only enabled one)', async () => {
    h.fetchActiveCards.mockResolvedValue(cards(6));
    render(<MemoryLevels />);
    await waitFor(() => expect(document.activeElement).toBe(link(12)));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(link(12));
  });

  it('Space clicks the focused link', async () => {
    h.fetchActiveCards.mockResolvedValue(cards(15));
    render(<MemoryLevels />);
    await waitFor(() => expect(document.activeElement).toBe(link(12)));
    const click = vi.fn((e: Event) => e.preventDefault());
    link(12).addEventListener('click', click);
    fireEvent.keyDown(link(12), { key: ' ' });
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('Esc goes to the game list; the back button links there', async () => {
    h.fetchActiveCards.mockResolvedValue(cards(15));
    render(<MemoryLevels />);
    await screen.findByRole('link', { name: '12 cards' });
    expect(screen.getByRole('link', { name: 'Back to games' }).getAttribute('href')).toBe('/games');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(h.push).toHaveBeenCalledWith('/games');
  });

  it('each level shows its visible label under the picture, decorative', async () => {
    h.fetchActiveCards.mockResolvedValue(cards(15));
    render(<MemoryLevels />);
    await screen.findByRole('link', { name: '12 cards' });
    for (const n of ALL) {
      const label = screen.getByText(`${n} cards`);
      expect(label.getAttribute('aria-hidden')).toBe('true');
      expect(label.closest('[data-level]')?.contains(link(n))).toBe(true);
    }
  });

  it('a disabled level dims its label together with the button', async () => {
    h.fetchActiveCards.mockResolvedValue(cards(6));
    render(<MemoryLevels />);
    await screen.findByRole('link', { name: '12 cards' });
    const dim = (n: number) => screen.getByText(`${n} cards`).closest('[data-level]') as HTMLElement;
    for (const n of [16, 20, 24, 30]) expect(dim(n).style.opacity).toBe('0.4');
    expect(dim(12).style.opacity).toBe('');
  });

  describe('help badge', () => {
    const badge = () => screen.getByRole('button', { name: 'What is Memory Match? Show how to play' });

    it('is a real 120 px button with the game name', async () => {
      h.fetchActiveCards.mockResolvedValue(cards(15));
      render(<MemoryLevels />);
      await screen.findByRole('link', { name: '12 cards' });
      expect(badge().tagName).toBe('BUTTON');
      expect(badge().style.height).toBe('120px');
      expect(badge().textContent).toBe('Memory Match');
      expect(screen.getByRole('link', { name: 'Back to games' })).toBeTruthy();
    });

    it('also shows while the pool is empty', async () => {
      h.fetchActiveCards.mockResolvedValue([]);
      render(<MemoryLevels />);
      await screen.findByRole('status');
      expect(badge()).toBeTruthy();
    });

    it('opens the popup; its Play only closes it and does not navigate', async () => {
      h.fetchActiveCards.mockResolvedValue(cards(15));
      render(<MemoryLevels />);
      await screen.findByRole('link', { name: '12 cards' });
      fireEvent.click(badge());
      const dialog = screen.getByRole('dialog', { name: 'How to play Memory Match' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Go to step 4' }));
      expect(within(dialog).queryByRole('link', { name: 'Play Memory Match' })).toBeNull();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Play Memory Match' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(h.push).not.toHaveBeenCalled();
    });

    it('Esc, Close and the backdrop close it without leaving; focus returns to the badge', async () => {
      h.fetchActiveCards.mockResolvedValue(cards(15));
      render(<MemoryLevels />);
      await screen.findByRole('link', { name: '12 cards' });
      vi.useFakeTimers({ toFake: ['setTimeout'] });
      try {
        fireEvent.click(badge());
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
        vi.runAllTimers();
        expect(document.activeElement).toBe(badge());
        expect(h.push).not.toHaveBeenCalled();

        fireEvent.click(badge());
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(screen.queryByRole('dialog')).toBeNull();
        vi.runAllTimers();
        expect(document.activeElement).toBe(badge());

        fireEvent.click(badge());
        fireEvent.mouseDown(screen.getByRole('dialog').parentElement as HTMLElement);
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(h.push).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('arrows do not move the level focus while it is open', async () => {
      h.fetchActiveCards.mockResolvedValue(cards(15));
      render(<MemoryLevels />);
      await waitFor(() => expect(document.activeElement).toBe(link(12)));
      fireEvent.click(badge());
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(document.activeElement).not.toBe(link(24));
      expect(document.activeElement).not.toBe(link(12));
    });
  });
});
