import { hasAnswerContent } from '@/lib/sets';

export type QuizAnswer = { slot: number; image_path: string | null; text: string | null; is_correct: boolean };
export type QuizQuestion = {
  id: string;
  position: number;
  prompt_text: string | null;
  prompt_image_path: string | null;
  prompt_audio_path: string | null;
  read_answers: boolean;
  hide_answer_text: boolean;
  answers: QuizAnswer[];
};

/** The question with its answers in slot order. */
export function sortAnswers(q: QuizQuestion): QuizQuestion {
  return { ...q, answers: [...q.answers].sort((a, b) => a.slot - b.slot) };
}

/** The Quiz game plays a question only when it has a prompt, 2+ answers with content and exactly one right answer. */
export function isPlayableQuestion(q: QuizQuestion): boolean {
  return (
    (!!q.prompt_text?.trim() || !!q.prompt_audio_path) &&
    q.answers.length >= 2 &&
    q.answers.every((a) => hasAnswerContent(a.image_path, a.text)) &&
    q.answers.filter((a) => a.is_correct).length === 1
  );
}
