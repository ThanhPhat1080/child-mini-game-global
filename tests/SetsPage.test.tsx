import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ rows: [] as unknown[], deleteSet: vi.fn() }));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    from: () => ({ select: () => ({ order: () => Promise.resolve({ data: h.rows, error: null }) }) }),
  }),
}));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null) => (p ? `/media/${p}` : null) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('@/lib/sets', async (orig) => ({ ...(await orig<typeof import('@/lib/sets')>()), deleteSet: h.deleteSet }));

import SetsPage from '@/app/admin/(panel)/sets/page';

const done = (n: number) => ({
  prompt_text: `Question ${n}`, prompt_audio_path: null,
  answers: [
    { slot: 1, image_path: 'a.svg', is_correct: true },
    { slot: 2, image_path: 'b.svg', is_correct: false },
    { slot: 3, image_path: 'c.svg', is_correct: false },
  ],
});
const incomplete = { prompt_text: '', prompt_audio_path: null, answers: [{ slot: 1, image_path: null, is_correct: false }, { slot: 2, image_path: null, is_correct: false }] };
const set = (id: string, title: string, status: string, questions: unknown[]) => ({
  id, title, subtitle: null, heading_color: '#E59AA1', cover_path: null, status, updated_at: '2026-10-20T00:00:00Z', questions,
});

function rowOf(title: string) {
  return screen.getByRole('button', { name: `Delete ${title}` }).closest('tr') as HTMLElement;
}

beforeEach(() => {
  h.deleteSet.mockReset();
  h.deleteSet.mockResolvedValue({ error: null, warning: null });
  h.rows = [
    set('s1', 'Animals', 'published', [done(1), done(2)]),
    set('s2', 'Colors', 'draft', [done(1), incomplete]),
    set('s3', 'Empty draft', 'draft', []),
  ];
});
afterEach(cleanup);

// T4 / A3: set list table, actions, front-page preview strip.
describe('Admin set list (T4, A3)', () => {
  it('TC1: the table shows name, question count and draft/published status for each set', async () => {
    render(<SetsPage />);
    const animals = within(await waitFor(() => rowOf('Animals')));
    expect(animals.getByText('Animals')).toBeTruthy();
    expect(animals.getByText('2')).toBeTruthy();
    expect(animals.getByText('Published')).toBeTruthy();
    expect(within(rowOf('Colors')).getByText('Draft')).toBeTruthy();
    expect(within(rowOf('Empty draft')).getByText('0')).toBeTruthy();
  });

  it('TC2: incomplete questions are not counted and are flagged', async () => {
    render(<SetsPage />);
    const colors = within(await waitFor(() => rowOf('Colors')));
    expect(colors.getByText(/1 incomplete/)).toBeTruthy();
  });

  it('TC3: "New quiz set" and "Edit" link to the right editor pages', async () => {
    render(<SetsPage />);
    await waitFor(() => rowOf('Animals'));
    expect(screen.getByRole('link', { name: /New quiz set/ }).getAttribute('href')).toBe('/admin/sets/new');
    const edit = within(rowOf('Animals')).getByRole('link', { name: 'Edit' });
    expect(edit.getAttribute('href')).toBe('/admin/sets/s1');
  });

  it('TC4: Delete asks for confirmation first and Cancel deletes nothing', async () => {
    render(<SetsPage />);
    await waitFor(() => rowOf('Animals'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Animals' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/Delete “Animals”\?/)).toBeTruthy();
    expect(within(dialog).getByText(/disappears from the front page/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(h.deleteSet).not.toHaveBeenCalled();
  });

  it('TC5: confirming Delete removes that set and reloads the list', async () => {
    render(<SetsPage />);
    await waitFor(() => rowOf('Colors'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Colors' }));
    h.rows = [set('s1', 'Animals', 'published', [done(1), done(2)])];
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete set' }));
    await waitFor(() => expect(h.deleteSet).toHaveBeenCalledWith('s2'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete Colors' })).toBeNull());
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('TC6: a failed delete shows an error message', async () => {
    h.deleteSet.mockResolvedValue({ error: 'Could not delete.', warning: null });
    render(<SetsPage />);
    await waitFor(() => rowOf('Colors'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Colors' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete set' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Could not delete.');
  });

  it('TC7: the preview strip shows published sets with at least one complete question, using SetCard', async () => {
    render(<SetsPage />);
    const card = await screen.findByLabelText('Animals, 2 questions');
    // SetCard renders the name and the question-count pill from the shared component.
    expect(within(card).getByText('Animals')).toBeTruthy();
    expect(within(card).getByText('2 questions')).toBeTruthy();
    expect(screen.queryByLabelText(/^Colors,/)).toBeNull();
    expect(screen.queryByLabelText(/^Empty draft,/)).toBeNull();
  });

  it('TC8: with no published sets the strip explains that the Quiz screen will be empty', async () => {
    h.rows = [set('s2', 'Colors', 'draft', [done(1)])];
    render(<SetsPage />);
    expect(await screen.findByText(/No published sets yet/)).toBeTruthy();
  });

  it('TC9: with no sets at all the table shows a friendly empty message', async () => {
    h.rows = [];
    render(<SetsPage />);
    expect(await screen.findByText(/No quiz sets yet/)).toBeTruthy();
  });
});
