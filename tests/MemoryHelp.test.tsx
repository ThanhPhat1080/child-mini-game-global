import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

import { MemoryHelp } from '@/components/MemoryHelp';

afterEach(cleanup);

const TITLES = ['What is Memory Match?', 'Flip two cards', 'Find the pair', 'Hear the word'];

describe('MemoryHelp', () => {
  it('is a dialog named "How to play Memory Match" with 4 steps and their titles', () => {
    render(<MemoryHelp onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'How to play Memory Match' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const heads = Array.from(dialog.querySelectorAll('h2')).map((x) => x.textContent);
    expect(heads).toEqual(TITLES);
    expect(within(dialog).getAllByRole('button', { name: /Go to step/ })).toHaveLength(4);
  });

  it('Next, Previous, the dots and Left/Right keys move between steps', () => {
    render(<MemoryHelp onClose={() => {}} />);
    const slides = () => Array.from(document.querySelectorAll('section'));
    const active = () => slides().findIndex((s) => s.getAttribute('aria-hidden') === 'false');
    expect(active()).toBe(0);
    expect((screen.getByRole('button', { name: 'Previous step' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    expect(active()).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Previous step' }));
    expect(active()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Go to step 3' }));
    expect(active()).toBe(2);
    expect(screen.getByRole('button', { name: 'Go to step 3' }).getAttribute('aria-current')).toBe('true');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(active()).toBe(3);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(active()).toBe(2);
  });

  it('the last step shows a Play link to /games/memory instead of Next', () => {
    render(<MemoryHelp onClose={() => {}} />);
    expect(screen.queryByRole('link', { name: 'Play Memory Match' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Go to step 4' }));
    expect(screen.queryByRole('button', { name: 'Next step' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Play Memory Match' }).getAttribute('href')).toBe('/games/memory');
  });

  it('with playHref null the last button is a Play button that only closes', () => {
    const onClose = vi.fn();
    render(<MemoryHelp playHref={null} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to step 4' }));
    expect(screen.queryByRole('link', { name: 'Play Memory Match' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Play Memory Match' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc, Close and a backdrop mouse-down close it; a mouse-down inside does not', () => {
    const onClose = vi.fn();
    render(<MemoryHelp onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    const dialog = screen.getByRole('dialog');
    fireEvent.mouseDown(dialog);
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('keeps the 120 px buttons', () => {
    render(<MemoryHelp onClose={() => {}} />);
    for (const name of ['Close', 'Previous step', 'Next step', 'Go to step 1']) {
      expect(screen.getByRole('button', { name }).style.height).toBe('120px');
    }
  });
});
