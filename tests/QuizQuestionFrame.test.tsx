import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ questions: [] as unknown[] }));

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
  yay: vi.fn(), ohOh: vi.fn(),
  speakKid: (_t: string, o?: { onEnd?: () => void }) => o?.onEnd?.(),
}));
vi.mock('@/components/MusicButton', () => ({ MusicButton: () => null }));
vi.mock('@/components/Confetti', () => ({ Confetti: () => null }));

import QuestionPage from '@/app/games/quiz/[setId]/page';

const answers = [1, 2, 3].map((slot) => ({ slot, image_path: `a${slot}.svg`, text: null, is_correct: slot === 2 }));

beforeEach(() => {
  localStorage.clear();
  h.questions = [{ id: 'q1', position: 1, prompt_text: 'Pick the second one', prompt_image_path: 'q.svg', prompt_audio_path: null, read_answers: true, answers }];
});
afterEach(cleanup);

describe('Quiz question picture frame (ADR-032)', () => {
  it('the question picture sits in a 300x300 square frame', async () => {
    const { container } = render(<QuestionPage />);
    await waitFor(() => expect(container.querySelector('img[src="/media/q.svg"]')).not.toBeNull());
    const frame = container.querySelector<HTMLElement>('img[src="/media/q.svg"]')!.parentElement!;
    expect(frame.style.width).toBe('300px');
    expect(frame.style.height).toBe('300px');
  });
});
