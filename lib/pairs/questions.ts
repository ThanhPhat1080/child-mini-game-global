import type { MemoryCard } from '@/lib/memory/types';
import type { Question as ListenQ } from '@/lib/listen/rounds';
import type { QuizQuestion } from '@/lib/quiz/playable';
import { shuffle } from './board';

export type QuestionSources = { quiz: { setId: string; questions: QuizQuestion[] }[]; cards: MemoryCard[] };
export type DrawnQuestion =
  | { kind: 'quiz'; key: string; question: QuizQuestion }
  | { kind: 'listen'; key: string; question: ListenQ };

const pick = <T,>(items: readonly T[], rng: () => number): T => items[Math.min(items.length - 1, Math.floor(rng() * items.length))];

/** Active cards, one per word (first wins). */
function listenPool(cards: readonly MemoryCard[]): MemoryCard[] {
  const seen = new Set<string>();
  return cards.filter((c) => {
    const k = c.word.trim().toLowerCase();
    if (!c.active || !k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** One Listen & Pick question: an answer card and two cards with other words; null under 3 words. */
export function pickListenQuestion(cards: readonly MemoryCard[], rng: () => number, avoidId: string | null = null): ListenQ | null {
  const pool = listenPool(cards);
  if (pool.length < 3) return null;
  const answers = avoidId ? pool.filter((c) => c.id !== avoidId) : pool;
  const answer = pick(answers, rng);
  const others = shuffle(pool.filter((c) => c.id !== answer.id), rng).slice(0, 2);
  const answerIndex = Math.min(2, Math.floor(rng() * 3)) as 0 | 1 | 2;
  const options = [...others];
  options.splice(answerIndex, 0, answer);
  return { answer, options: options as ListenQ['options'], answerIndex };
}

function drawQuiz(src: QuestionSources, rng: () => number, avoid: string | null): DrawnQuestion | null {
  const sets = src.quiz
    .map((s) => s.questions.filter((q) => `quiz:${q.id}` !== avoid))
    .filter((qs) => qs.length > 0);
  if (!sets.length) return null;
  const q = pick(pick(sets, rng), rng);
  return { kind: 'quiz', key: `quiz:${q.id}`, question: q };
}

function drawListen(src: QuestionSources, rng: () => number, avoid: string | null): DrawnQuestion | null {
  const avoidId = avoid?.startsWith('listen:') ? avoid.slice('listen:'.length) : null;
  const q = pickListenQuestion(src.cards, rng, avoidId);
  if (!q) return null;
  const key = `listen:${q.answer.id}`;
  return key === avoid ? null : { kind: 'listen', key, question: q };
}

/**
 * H4: a Quiz or Listen & Pick question with equal chance (the first rng() call decides),
 * falling back to the other source; never `lastKey` again unless it is the only question.
 */
export function drawQuestion(src: QuestionSources, rng: () => number, lastKey: string | null): DrawnQuestion | null {
  const hasQuiz = src.quiz.some((s) => s.questions.length > 0);
  const hasListen = listenPool(src.cards).length >= 3;
  if (!hasQuiz && !hasListen) return null;
  const quizFirst = hasQuiz && (!hasListen || rng() < 0.5);
  const order = quizFirst ? [drawQuiz, drawListen] : [drawListen, drawQuiz];
  for (const draw of order) {
    const d = draw(src, rng, lastKey);
    if (d) return d;
  }
  return drawQuiz(src, rng, null) ?? drawListen(src, rng, null);
}
