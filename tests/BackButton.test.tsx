import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }) }));

import { BackButton } from '@/components/BackButton';

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

const back = () => screen.getByRole('link', { name: 'Back to games' });
const ask = () => screen.queryByRole('dialog', { name: 'Leave now?' });
const overlay = () => document.querySelector('[data-leave-ask]') as Element;

function renderOnGame() {
  return render(<BackButton href="/games" label="Back to games" game="caro" />);
}

describe('BackButton on a game screen', () => {
  it('asks "Leave now?" with Yes and No, and No has the focus', () => {
    renderOnGame();
    fireEvent.click(back());
    expect(ask()).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Yes' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'No' }));
    expect(h.push).not.toHaveBeenCalled();
  });

  it('Yes goes back to the href', () => {
    renderOnGame();
    fireEvent.click(back());
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(h.push).toHaveBeenCalledWith('/games');
  });

  it.each([
    ['No', () => fireEvent.click(screen.getByRole('button', { name: 'No' }))],
    ['X', () => fireEvent.click(screen.getByRole('button', { name: 'Close' }))],
    ['Esc', () => fireEvent.keyDown(ask() as Element, { key: 'Escape' })],
    ['outside', () => fireEvent.mouseDown(overlay())],
  ])('%s stays in the game and gives the focus back to the back button', async (_name, act) => {
    renderOnGame();
    fireEvent.click(back());
    act();
    expect(ask()).toBeNull();
    expect(h.push).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(back()));
  });

  it('Left moves the focus from No to Yes', () => {
    renderOnGame();
    fireEvent.click(back());
    fireEvent.keyDown(ask() as Element, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Yes' }));
  });

  it('while the question is open, Esc on the page does not leave', () => {
    renderOnGame();
    fireEvent.click(back());
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(h.push).not.toHaveBeenCalled();
    expect(ask()).toBeTruthy();
  });

  it('Esc with no question open still goes back straight away', () => {
    renderOnGame();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(h.push).toHaveBeenCalledWith('/games');
    expect(ask()).toBeNull();
  });
});

describe('BackButton without a game (home and other non-game screens)', () => {
  it('is a plain link to its href and opens no question', () => {
    render(<BackButton href="/games" label="Back to games" />);
    expect(back().getAttribute('href')).toBe('/games');
    expect(ask()).toBeNull();
  });
});
