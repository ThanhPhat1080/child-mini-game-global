import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ rows: [] as unknown[], eq: vi.fn(), push: vi.fn() }));

vi.mock('@/lib/review', () => ({ playerId: async () => 'p1', familyOrGlobal: (q: unknown) => q, ownerFirst: (r: unknown) => r }));
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    from: () => ({
      select: () => ({
        eq: (...args: unknown[]) => {
          h.eq(...args);
          return { order: () => Promise.resolve({ data: h.rows, error: null }) };
        },
      }),
    }),
  }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }), usePathname: () => '/games/quiz' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null) => (p ? `/media/${p}` : null) }));
vi.mock('@/components/MusicButton', () => ({ MusicButton: () => null }));

import QuizSets from '@/app/games/quiz/page';

const good = (n: number) => ({
  prompt_text: `Question ${n}`, prompt_audio_path: null,
  answers: [
    { image_path: 'a.svg', is_correct: true },
    { image_path: 'b.svg', is_correct: false },
    { image_path: 'c.svg', is_correct: false },
  ],
});
const bad = { prompt_text: '', prompt_audio_path: null, answers: [{ image_path: null, is_correct: false }, { image_path: 'b.svg', is_correct: true }] };
const set = (id: string, title: string, subtitle: string | null, questions: unknown[]) => ({
  id, title, subtitle, heading_color: '#E59AA1', cover_path: `${id}.svg`, questions,
});

beforeEach(() => {
  sessionStorage.clear(); // the remembered set position is per tab: start every test on the first set
  h.eq.mockReset();
  h.push.mockReset();
  localStorage.clear();
  h.rows = [set('s1', 'Animals', 'Farm and zoo', [good(1), good(2), bad]), set('s2', 'Colors', null, [good(1)])];
});
afterEach(cleanup);

// T9 / C3, C11: quiz set selection.
describe('Quiz set selection (T9, C3, C11)', () => {
  it('comes back to the set that was centered when the child left (not the first)', async () => {
    sessionStorage.setItem('childPlayer:quiz:index', '1');
    render(<QuizSets />);
    const colors = await screen.findByRole('link', { name: 'Colors, 1 questions' });
    await waitFor(() => expect(document.activeElement).toBe(colors));
  });

  it('remembers the centered set when the child moves to another one', async () => {
    render(<QuizSets />);
    await screen.findByRole('link', { name: 'Animals, 2 questions' });
    fireEvent.click(screen.getByRole('button', { name: 'Go to set 2' }));
    expect(sessionStorage.getItem('childPlayer:quiz:index')).toBe('1');
  });

  it('only the signed-in family\'s own sets carry the family badge', async () => {
    h.rows = [{ ...set('s1', 'Animals', null, [good(1)]), owner_id: 'p1' }, { ...set('s2', 'Colors', null, [good(1)]), owner_id: null }];
    const { container } = render(<QuizSets />);
    await screen.findByText('Animals');
    const cards = container.querySelectorAll('a[data-set-card]');
    expect(cards[0].querySelector('[data-family-badge]')).not.toBeNull();
    expect(cards[1].querySelector('[data-family-badge]')).toBeNull();
  });

  it('a family sees its own approved set and the global copy of it (duplicates are accepted)', async () => {
    h.rows = [{ ...set('s1', 'Animals', null, [good(1)]), owner_id: 'p1', source_id: null }, { ...set('s2', 'Animals', null, [good(1)]), owner_id: 'sa', source_id: 's1' }];
    const { container } = render(<QuizSets />);
    await screen.findAllByText('Animals');
    expect(container.querySelectorAll('a[data-set-card]')).toHaveLength(2);
  });

  it('TC1: each card shows cover, name, optional sub-title and a question-count pill', async () => {
    render(<QuizSets />);
    const animals = await screen.findByRole('link', { name: 'Animals, 2 questions' });
    expect(animals.querySelector('img')?.getAttribute('src')).toBe('/media/s1.svg');
    expect(within(animals).getByText('Animals')).toBeTruthy();
    expect(within(animals).getByText('Farm and zoo')).toBeTruthy();
    expect(within(animals).getByText('2 questions')).toBeTruthy();
    const colors = screen.getByRole('link', { name: 'Colors, 1 questions' });
    expect(within(colors).getByText('1 question')).toBeTruthy();
    expect(within(colors).queryByText('Farm and zoo')).toBeNull();
  });

  it('TC2: only published sets are requested and incomplete questions are not counted', async () => {
    h.rows = [set('s1', 'Animals', null, [good(1), bad]), set('s3', 'Only broken', null, [bad])];
    render(<QuizSets />);
    await screen.findByRole('link', { name: 'Animals, 1 questions' });
    expect(h.eq).toHaveBeenCalledWith('status', 'published');
    expect(screen.queryByRole('link', { name: /Only broken/ })).toBeNull();
  });

  it('TC3: no card shows a "finished" star or "completed", even when the set was finished before', async () => {
    localStorage.setItem('childPlayer:done:s1', '1');
    render(<QuizSets />);
    const animals = await screen.findByRole('link', { name: 'Animals, 2 questions' });
    expect(animals.querySelector('svg[fill="#EED79A"]')).toBeNull();
    expect(screen.queryByRole('link', { name: /completed/ })).toBeNull();
  });

  it('TC4: a card is a keyboard-focusable link that opens its set (click, or Tab + Enter)', async () => {
    render(<QuizSets />);
    const animals = await screen.findByRole('link', { name: 'Animals, 2 questions' });
    expect(animals.tagName).toBe('A');
    expect(animals.getAttribute('href')).toBe('/games/quiz/s1');
    animals.focus();
    expect(document.activeElement).toBe(animals);
    expect(screen.getByRole('link', { name: 'Colors, 1 questions' }).getAttribute('href')).toBe('/games/quiz/s2');
  });

  it('TC5: blocked storage never breaks the page (no stars, cards still show)', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<QuizSets />);
    expect(await screen.findByRole('link', { name: 'Animals, 2 questions' })).toBeTruthy();
    spy.mockRestore();
  });

  it('TC6: with no published sets a friendly picture screen shows, not an error', async () => {
    h.rows = [];
    render(<QuizSets />);
    expect(await screen.findByText('New quizzes are coming soon!')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('TC7: the "Quiz" badge opens the How-to-play popup; its last button just closes it', async () => {
    render(<QuizSets />);
    await screen.findByRole('link', { name: 'Animals, 2 questions' });
    const badge = screen.getByRole('button', { name: /What is Quiz/ });
    expect(badge.style.height).toBe('120px');
    fireEvent.click(badge);
    const dialog = screen.getByRole('dialog', { name: 'How to play Quiz' });
    const dots = within(dialog).getAllByRole('button', { name: /Go to step/ });
    fireEvent.click(dots[dots.length - 1]);
    const play = within(dialog).getByRole('button', { name: 'Play Quiz' });
    expect(within(dialog).queryByRole('link', { name: 'Play Quiz' })).toBeNull();
    fireEvent.click(play);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.push).not.toHaveBeenCalled();
  });

  it('TC8: Esc, Close and the backdrop close the popup without leaving the page; focus returns to the badge', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      render(<QuizSets />);
      const badge = screen.getByRole('button', { name: /What is Quiz/ });
      fireEvent.click(badge);
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).toBeNull();
      vi.runAllTimers();
      expect(document.activeElement).toBe(badge);
      expect(h.push).not.toHaveBeenCalled();

      fireEvent.click(badge);
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('dialog')).toBeNull();

      fireEvent.click(badge);
      const dialog = screen.getByRole('dialog');
      fireEvent.mouseDown(dialog.parentElement as HTMLElement);
      expect(screen.queryByRole('dialog')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('TC9: the back button links to the game list and Esc goes back when no popup is open', async () => {
    render(<QuizSets />);
    await waitFor(() => expect(screen.getByRole('link', { name: 'Back to games' }).getAttribute('href')).toBe('/games'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(h.push).toHaveBeenCalledWith('/games');
  });

  it('TC10: the first set is focused at once; arrows move between sets; Space and Enter open the focused one', async () => {
    render(<QuizSets />);
    const animals = await screen.findByRole('link', { name: 'Animals, 2 questions' });
    const colors = screen.getByRole('link', { name: 'Colors, 1 questions' });
    await waitFor(() => expect(document.activeElement).toBe(animals));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(colors);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(animals);
    // Space on a link behaves like Enter (links only react to Enter by default)
    const click = vi.fn((e: Event) => e.preventDefault());
    animals.addEventListener('click', click);
    fireEvent.keyDown(animals, { key: ' ' });
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('TC11: arrows do not move the sets while the help popup is open', async () => {
    render(<QuizSets />);
    const animals = await screen.findByRole('link', { name: 'Animals, 2 questions' });
    await waitFor(() => expect(document.activeElement).toBe(animals));
    fireEvent.click(screen.getByRole('button', { name: /What is Quiz/ }));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.activeElement).not.toBe(screen.getByRole('link', { name: 'Colors, 1 questions' }));
  });

  // T9 carousel: dots, arrows, drag
  const track = (c: HTMLElement) => (c.closest('div[style*="translateX"]') as HTMLElement);
  // jsdom has no PointerEvent, so build pointer events from MouseEvent to keep clientX
  const ptr = (el: Element, type: string, clientX = 0) => fireEvent(el, new MouseEvent(type, { bubbles: true, clientX }));
  const view = (c: HTMLElement) => c.closest('.hm-view') as HTMLElement;

  it('TC12: dots pick a set and arrows / focus move the carousel; the focused set is centered', async () => {
    render(<QuizSets />);
    const animals = await screen.findByRole('link', { name: 'Animals, 2 questions' });
    const colors = screen.getByRole('link', { name: 'Colors, 1 questions' });
    expect(track(animals).style.transform).toBe('translateX(680px)');
    fireEvent.click(screen.getByRole('button', { name: 'Go to set 2' }));
    expect(track(animals).style.transform).toBe('translateX(56px)');
    expect(screen.getByRole('button', { name: 'Go to set 2' }).getAttribute('aria-current')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Previous set' }));
    expect(track(animals).style.transform).toBe('translateX(680px)');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(colors);
    expect(track(animals).style.transform).toBe('translateX(56px)');
  });

  it('TC13: dragging with the mouse moves past the 120 px threshold; a drag never opens a set', async () => {
    render(<QuizSets />);
    const animals = await screen.findByRole('link', { name: 'Animals, 2 questions' });
    const v = view(animals);
    v.getBoundingClientRect = () => ({ width: 1920 } as DOMRect);
    ptr(v, 'pointerdown', 900);
    ptr(v, 'pointermove', 850);
    ptr(v, 'pointerup');
    expect(track(animals).style.transform).toBe('translateX(680px)'); // under 120 px: stays
    ptr(v, 'pointerdown', 900);
    ptr(v, 'pointermove', 700);
    ptr(v, 'pointerup');
    expect(track(animals).style.transform).toBe('translateX(56px)');
    expect(fireEvent.click(animals)).toBe(false); // click after a drag is cancelled
  });

  it('TC14: tapping a side set centers it; tapping the centered set opens it', async () => {
    render(<QuizSets />);
    const animals = await screen.findByRole('link', { name: 'Animals, 2 questions' });
    const colors = screen.getByRole('link', { name: 'Colors, 1 questions' });
    const v = view(animals);
    v.getBoundingClientRect = () => ({ width: 1920 } as DOMRect);
    ptr(v, 'pointerdown', 1500);
    ptr(v, 'pointerup');
    expect(fireEvent.click(colors)).toBe(false);
    expect(track(animals).style.transform).toBe('translateX(56px)');
    ptr(v, 'pointerdown', 960);
    ptr(v, 'pointerup');
    expect(fireEvent.click(colors)).toBe(true);
  });

  it('TC15: a single set shows no arrows or dots', async () => {
    h.rows = [set('s1', 'Animals', null, [good(1)])];
    render(<QuizSets />);
    await screen.findByRole('link', { name: 'Animals, 1 questions' });
    expect(screen.queryByRole('button', { name: /Go to set/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next set' })).toBeNull();
  });

  it('TC16: after a dot click the arrows step from the centered set, not from the first', async () => {
    h.rows = [set('s1', 'A', null, [good(1)]), set('s2', 'B', null, [good(1)]), set('s3', 'C', null, [good(1)])];
    render(<QuizSets />);
    const first = await screen.findByRole('link', { name: 'A, 1 questions' });
    await waitFor(() => expect(document.activeElement).toBe(first)); // the page focuses the first set when it appears; wait for that so it cannot land after the dot click
    fireEvent.click(screen.getByRole('button', { name: 'Go to set 2' }));
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'C, 1 questions' }));
  });

  it('TC17: the Back and "? Quiz" buttons sit above the full-screen carousel layer so they stay clickable', async () => {
    render(<QuizSets />);
    await screen.findByRole('link', { name: 'Animals, 2 questions' });
    // Back sits in the shared corner (z-index set by ChildScreen), the help button in the header row: both above the carousel
    const corner = screen.getByRole('link', { name: 'Back to games' }).parentElement as HTMLElement;
    expect(Number(corner.style.zIndex)).toBeGreaterThan(0);
    const header = screen.getByRole('button', { name: /What is Quiz/ }).parentElement as HTMLElement;
    expect(Number(header.style.zIndex)).toBeGreaterThan(0);
  });
});
