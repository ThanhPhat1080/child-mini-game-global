import { beforeEach, describe, expect, it, vi } from 'vitest';

type Res = { data: unknown; error: { message: string } | null };
const h = vi.hoisted(() => ({
  results: {} as Record<string, Res>,
  calls: [] as { table: string; method: string; args: unknown[] }[],
  cards: vi.fn(),
}));

/** A chainable stand-in for a Supabase query: records every call and resolves with the table's result. */
function query(table: string) {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'or', 'in', 'order']) {
    q[m] = (...args: unknown[]) => {
      h.calls.push({ table, method: m, args });
      return q;
    };
  }
  q.then = (ok: (r: Res) => unknown, bad: (e: unknown) => unknown) =>
    Promise.resolve(h.results[table] ?? { data: [], error: null }).then(ok, bad);
  return q;
}

vi.mock('@/lib/review', async (orig) => ({ ...(await orig<typeof import('@/lib/review')>()), playerId: async () => 'me' }));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({ from: (t: string) => query(t) }) }));
vi.mock('@/lib/memory/cards', () => ({ fetchActiveCards: h.cards }));

import { fetchPuzzlePictures, fetchQuestionSources } from '@/lib/pairs/load';

const callsOf = (table: string, method?: string) => h.calls.filter((c) => c.table === table && (!method || c.method === method));
const answer = (slot: number, ok: boolean) => ({ slot, image_path: `${slot}.png`, text: null, is_correct: ok });
const question = (id: string, set_id: string, answers = [answer(2, false), answer(1, true)]) => ({
  id, set_id, position: 1, prompt_text: 'Which?', prompt_image_path: null, prompt_audio_path: null,
  read_answers: false, hide_answer_text: false, answers,
});
const cardRows = [{ id: 'c1', word: 'cat', image_path: 'seed/cat.svg', audio_path: null, active: true }];

beforeEach(() => {
  h.results = {};
  h.calls = [];
  h.cards.mockReset();
  h.cards.mockResolvedValue(cardRows);
});

describe('fetchPuzzlePictures (H2)', () => {
  it('reads active pictures in sort order and maps them', async () => {
    h.results.puzzle_pictures = {
      data: [{ id: 'p1', word: 'fish', image_path: 'seed/fish.svg', audio_path: null, active: true, sort_order: 0 }],
      error: null,
    };
    await expect(fetchPuzzlePictures()).resolves.toEqual([{ id: 'p1', word: 'fish', image_path: 'seed/fish.svg', audio_path: null }]);
    expect(callsOf('puzzle_pictures', 'eq')[0].args).toEqual(['active', true]);
    expect(callsOf('puzzle_pictures', 'order').map((c) => c.args[0])).toEqual(['sort_order', 'created_at']);
  });

  it('throws on a Supabase error', async () => {
    h.results.puzzle_pictures = { data: null, error: { message: 'boom' } };
    await expect(fetchPuzzlePictures()).rejects.toThrow('boom');
  });
});

describe('fetchQuestionSources (H4)', () => {
  it('reads published family-or-global sets, keeps playable questions and drops empty sets', async () => {
    h.results.quiz_sets = {
      data: [
        { id: 's1', owner_id: 'me', source_id: null },
        { id: 's2', owner_id: null, source_id: null },
        { id: 'copy', owner_id: 'sa', source_id: 's1' },
      ],
      error: null,
    };
    h.results.questions = {
      data: [
        question('q1', 's1'),
        question('bad', 's1', [answer(1, true)]),
        question('none', 's2', [answer(1, false), answer(2, false)]),
      ],
      error: null,
    };
    const src = await fetchQuestionSources();
    expect(src.quiz).toHaveLength(1);
    expect(src.quiz[0].setId).toBe('s1');
    expect(src.quiz[0].questions.map((q) => q.id)).toEqual(['q1']);
    expect(src.quiz[0].questions[0].answers.map((a) => a.slot)).toEqual([1, 2]);
    expect(src.cards).toEqual(cardRows);
    expect(callsOf('quiz_sets', 'eq')[0].args).toEqual(['status', 'published']);
    expect(callsOf('quiz_sets', 'or')[0].args).toEqual(['owner_id.eq.me,visibility.eq.global']);
    expect(callsOf('questions', 'in')[0].args).toEqual(['set_id', ['s1', 's2']]);
    expect(String(callsOf('questions', 'select')[0].args[0])).toContain('answers(slot, image_path, text, is_correct)');
  });

  it('still returns cards when the quiz query fails, and quiz when cards fail', async () => {
    h.results.quiz_sets = { data: null, error: { message: 'no sets' } };
    await expect(fetchQuestionSources()).resolves.toEqual({ quiz: [], cards: cardRows });

    h.results.quiz_sets = { data: [{ id: 's1', owner_id: 'me', source_id: null }], error: null };
    h.results.questions = { data: [question('q1', 's1')], error: null };
    h.cards.mockRejectedValue(new Error('no cards'));
    const src = await fetchQuestionSources();
    expect(src.cards).toEqual([]);
    expect(src.quiz[0].questions[0].id).toBe('q1');
  });

  it('skips the questions query when no set is visible', async () => {
    h.results.quiz_sets = { data: [], error: null };
    await expect(fetchQuestionSources()).resolves.toEqual({ quiz: [], cards: cardRows });
    expect(callsOf('questions')).toHaveLength(0);
  });

  it('throws when both sources fail', async () => {
    h.results.quiz_sets = { data: null, error: { message: 'no sets' } };
    h.cards.mockRejectedValue(new Error('no cards'));
    await expect(fetchQuestionSources()).rejects.toThrow();
  });
});
