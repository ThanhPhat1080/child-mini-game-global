import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeFrom, type QueryState } from './support/fakeSupabase';

const h = vi.hoisted(() => ({ router: { replace: vi.fn(), push: vi.fn() }, replace: vi.fn(), push: vi.fn(), set: null as null | { id: string; status: string }, queries: [] as QueryState[] }));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => {
    const { from, queries } = fakeFrom((q) => (q.table === 'quiz_sets' ? { data: h.set } : { data: [] }));
    h.queries = queries;
    return { from };
  },
}));
vi.mock('next/navigation', () => ({ useParams: () => ({ setId: 's1' }), useRouter: () => h.router }));
vi.mock('next/link', () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));
vi.mock('@/lib/settings', () => ({ getMyChildSettings: () => Promise.resolve(null) }));
vi.mock('@/lib/media', () => ({ mediaUrl: () => null }));
vi.mock('@/lib/sfx', () => ({ ohOh: vi.fn(), yay: vi.fn(), speakKid: vi.fn() }));
vi.mock('@/components/MusicButton', () => ({ MusicButton: () => null }));

import QuestionPage from '@/app/games/quiz/[setId]/page';

h.router.replace = h.replace;
h.router.push = h.push;

beforeEach(() => { h.replace.mockReset(); h.push.mockReset(); h.set = null; });
afterEach(cleanup);

const loaded = () => h.queries.map((q) => q.table);

describe('quiz set draft guard (K10)', () => {
  it('a draft set loads no questions and goes back to the set list', async () => {
    h.set = { id: 's1', status: 'draft' };
    render(<QuestionPage />);
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/games/quiz'));
    expect(loaded()).not.toContain('questions');
  });

  it('a pending set is treated the same way', async () => {
    h.set = { id: 's1', status: 'pending' };
    render(<QuestionPage />);
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/games/quiz'));
    expect(loaded()).not.toContain('questions');
  });

  it('a missing set (or one RLS hides) goes back to the set list', async () => {
    h.set = null;
    render(<QuestionPage />);
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith('/games/quiz'));
    expect(loaded()).not.toContain('questions');
  });

  it('a published set loads its questions and stays', async () => {
    h.set = { id: 's1', status: 'published' };
    render(<QuestionPage />);
    await waitFor(() => expect(loaded()).toContain('questions'));
    expect(h.replace).not.toHaveBeenCalled();
    const setQuery = h.queries.find((q) => q.table === 'quiz_sets')!;
    expect(setQuery.filters).toContainEqual(['id', 's1']);
  });
});
