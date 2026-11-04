import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ questions: [] as unknown[], yay: vi.fn(), ohOh: vi.fn() }));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => (table === 'settings'
          ? { single: () => Promise.resolve({ data: {} }) }
          : { order: () => Promise.resolve({ data: h.questions }) }),
      }),
    }),
  }),
}));
vi.mock('next/navigation', () => ({ useParams: () => ({ setId: 's1' }), useRouter: () => ({ push: vi.fn() }), usePathname: () => '/games/quiz/s1' }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null) => (p ? `/media/${p}` : null) }));
vi.mock('@/lib/sfx', () => ({
  yay: h.yay, ohOh: h.ohOh,
  speakKid: (_t: string, o?: { onEnd?: () => void }) => o?.onEnd?.(),
}));
vi.mock('@/components/MusicButton', () => ({ MusicButton: () => null }));
vi.mock('@/components/Confetti', () => ({ Confetti: () => null }));

import QuestionPage from '@/app/games/quiz/[setId]/page';

const answers = (correct: number) => [1, 2, 3].map((slot) => ({ slot, image_path: `a${slot}.svg`, text: null, is_correct: slot === correct }));

beforeEach(() => {
  h.yay.mockReset();
  h.ohOh.mockReset();
  localStorage.clear();
  h.questions = [{ id: 'q1', position: 1, prompt_text: 'Pick the second one', prompt_image_path: null, prompt_audio_path: null, read_answers: true, answers: answers(2) }];
});
afterEach(cleanup);

async function ready() {
  render(<QuestionPage />);
  await screen.findByRole('button', { name: 'Answer 1' });
}
const answerBtn = (n: number) => screen.getByRole('button', { name: `Answer ${n}` });
// the picked card plays a 1.5 s effect first, so the Hooray / Oh-oh popup shows a little after 1.5 s
const POPUP = { timeout: 4000 };

// T10: laptop keyboard support on the question screen.
describe('Question screen keyboard (T10, C4)', () => {
  it('TC1: arrow keys move between the answers (Right starts at 1, Left from 1 stays)', async () => {
    await ready();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(answerBtn(1));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(answerBtn(2));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(answerBtn(3));
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(answerBtn(2));
  });

  it('TC2: Enter on the focused answer picks it (right answer shows Hooray)', async () => {
    await ready();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    // a real browser turns Enter on a focused button into a click
    fireEvent.click(document.activeElement as HTMLElement);
    expect(await screen.findByText('Hooray!', undefined, POPUP)).toBeTruthy();
    expect(h.yay).toHaveBeenCalled();
  });

  it('TC3: Space on the focused answer picks it too (wrong answer shows Oh-oh)', async () => {
    await ready();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    // Space on a button also becomes a click; the arrow handler must not swallow or double it
    const e = new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true });
    document.activeElement?.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
    fireEvent.click(document.activeElement as HTMLElement);
    expect(await screen.findByText(/Oh-oh/, undefined, POPUP)).toBeTruthy();
    expect(h.ohOh).toHaveBeenCalled();
  });

  it('TC4: the number keys 1/2/3 still answer', async () => {
    await ready();
    fireEvent.keyDown(window, { key: '2' });
    expect(await screen.findByText('Hooray!', undefined, POPUP)).toBeTruthy();
  });

  it('TC6: the picked card plays its effect right away and the popup waits for it (right answer)', async () => {
    await ready();
    fireEvent.click(answerBtn(2));
    expect(answerBtn(2).className).toContain('hm-picked');
    expect(answerBtn(1).className).not.toContain('hm-picked');
    expect(screen.queryByText('Hooray!')).toBeNull(); // not yet: the card is still doing its effect
    const hooray = await screen.findByText('Hooray!', undefined, POPUP);
    expect(answerBtn(2).className).toContain('hm-picked'); // stays a little bigger under the popup
    // the popup layer must sit above the cards, which lift to z-index 3-4 when hovered, focused or picked
    expect(Number((hooray.closest('[role=status]')!.parentElement as HTMLElement).style.zIndex)).toBeGreaterThan(4);
  });

  it('TC7: a wrong pick also plays the effect first, then wobbles and shows Oh-oh', async () => {
    await ready();
    fireEvent.click(answerBtn(1));
    expect(answerBtn(1).className).toContain('hm-picked');
    expect(screen.queryByText(/Oh-oh/)).toBeNull();
    const ohOh = await screen.findByText(/Oh-oh/, undefined, POPUP);
    expect(Number((ohOh.closest('[role=status]')!.parentElement as HTMLElement).style.zIndex)).toBeGreaterThan(4); // above the lifted cards
    expect(answerBtn(1).className).toContain('hm-wobble');
    expect(answerBtn(1).className).not.toContain('hm-picked');
  });

  it('TC5: answers are real buttons a child can reach with Tab (focusable, not disabled)', async () => {
    await ready();
    [1, 2, 3].forEach((n) => {
      expect(answerBtn(n).tagName).toBe('BUTTON');
      expect((answerBtn(n) as HTMLButtonElement).disabled).toBe(false);
      expect(answerBtn(n).tabIndex).toBe(0);
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Hear the question again' })).toBeTruthy());
  });
});
