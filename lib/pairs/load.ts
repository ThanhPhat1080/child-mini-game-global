import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { familyOrGlobal, playerId } from '@/lib/review';
import { fetchActiveCards } from '@/lib/memory/cards';
import { isPlayableQuestion, sortAnswers, type QuizQuestion } from '@/lib/quiz/playable';
import type { QuestionSources } from './questions';
import type { PuzzlePicture } from './types';

/** H2: the pictures that are on, in the Super Admin's order. Throws Error(message) on failure. */
export async function fetchPuzzlePictures(): Promise<PuzzlePicture[]> {
  const { data, error } = await createSupabaseBrowserClient()
    .from('puzzle_pictures')
    .select('id, word, image_path, audio_path')
    .eq('active', true)
    .order('sort_order')
    .order('created_at');
  if (error) throw new Error(error.message);
  return ((data ?? []) as PuzzlePicture[]).map(({ id, word, image_path, audio_path }) => ({ id, word, image_path, audio_path: audio_path ?? null }));
}

const QUESTION_SELECT =
  'id, set_id, position, prompt_text, prompt_image_path, prompt_audio_path, read_answers, hide_answer_text, answers(slot, image_path, text, is_correct)';

type SetRow = { id: string; owner_id?: string | null; source_id?: string | null };

/** The published sets the child can see (family + global, as the Quiz game), each with its playable questions. */
async function fetchQuiz(): Promise<QuestionSources['quiz']> {
  const me = await playerId();
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await familyOrGlobal(
    supabase.from('quiz_sets').select('id, owner_id, source_id').eq('status', 'published'),
    me,
  ).order('position');
  if (error) throw new Error(error.message);
  const sets = (data ?? []) as SetRow[];
  if (!sets.length) return [];
  const res = await supabase.from('questions').select(QUESTION_SELECT).in('set_id', sets.map((s) => s.id)).order('position');
  if (res.error) throw new Error(res.error.message);
  const rows = (res.data ?? []) as unknown as (QuizQuestion & { set_id: string })[];
  return sets
    .map((s) => ({
      setId: s.id,
      questions: rows.filter((q) => q.set_id === s.id).map(sortAnswers).filter(isPlayableQuestion),
    }))
    .filter((s) => s.questions.length > 0);
}

/** H4: Quiz sets and Listen & Pick cards. A failing source gives an empty list; throws only when both fail. */
export async function fetchQuestionSources(): Promise<QuestionSources> {
  const [quiz, cards] = await Promise.allSettled([fetchQuiz(), fetchActiveCards()]);
  if (quiz.status === 'rejected' && cards.status === 'rejected') {
    throw quiz.reason instanceof Error ? quiz.reason : new Error(String(quiz.reason));
  }
  return {
    quiz: quiz.status === 'fulfilled' ? quiz.value : [],
    cards: cards.status === 'fulfilled' ? cards.value : [],
  };
}
