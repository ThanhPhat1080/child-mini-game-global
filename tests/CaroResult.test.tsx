import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

// The result screens of Caro X O: the Hooray win, the Oh-oh toast, and the "Let's try again?" popup.

import { CaroHooray, CaroOhOh, RESULT_DELAY_MS } from '@/components/caro/CaroResult';

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

  it('the result waits one second before the board shows Hooray or Oh-oh', () => {
    expect(RESULT_DELAY_MS).toBe(1000);
  });
});
