import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The result screens of Caro X O: the Hooray win, the Oh-oh toast, and the "Let's try again?" popup.

import { CaroHooray, CaroOhOh, CaroRetry } from '@/components/caro/CaroResult';

afterEach(cleanup);

describe('Caro result screens', () => {
  it('the Hooray screen says Hooray! in a status region', () => {
    render(<CaroHooray />);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText('Hooray!')).toBeTruthy();
  });

  it('the Oh-oh toast says Oh-oh… try again! in a status region', () => {
    render(<CaroOhOh />);
    expect(screen.getByRole('status').textContent).toContain('Oh-oh… try again!');
  });

  it('the popup is a dialog named "Let\'s try again?" with the avatar, the question, and Yes and No', () => {
    render(<CaroRetry avatar="/images/prince.webp" onYes={() => {}} onNo={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: "Let's try again?" });
    expect(within(dialog).getByRole('heading', { name: "Let's try again?" })).toBeTruthy();
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe('/images/prince.webp');
    expect(within(dialog).getByRole('button', { name: 'Yes' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'No' })).toBeTruthy();
  });

  it('Yes is focused when the popup opens, and the arrow keys move between Yes and No', () => {
    render(<CaroRetry avatar="/images/prince.webp" onYes={() => {}} onNo={() => {}} />);
    const yes = screen.getByRole('button', { name: 'Yes' });
    const no = screen.getByRole('button', { name: 'No' });
    expect(document.activeElement).toBe(yes);
    fireEvent.keyDown(yes, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(no);
    fireEvent.keyDown(no, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(yes);
  });

  it('Yes and No call their own handlers', () => {
    const onYes = vi.fn();
    const onNo = vi.fn();
    render(<CaroRetry avatar="/images/princess.webp" onYes={onYes} onNo={onNo} />);
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(onNo).toHaveBeenCalledTimes(1);
    expect(onYes).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(onYes).toHaveBeenCalledTimes(1);
  });
});
