import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/sfx', () => ({ applause: vi.fn(), speakKid: vi.fn(), playFile: vi.fn() }));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null) => (p ? `/media/${p}` : null) }));
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { child_name: 'Mi', complete_path: null } }) }) }) }),
  }),
}));
vi.mock('next/navigation', () => ({ useParams: () => ({ setId: 's1' }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('@/components/MusicButton', () => ({ MusicButton: () => null }));

import Done from '@/app/games/quiz/[setId]/done/page';

afterEach(cleanup);

describe('Quiz done page', () => {
  it('shows the greeting, stars, both characters and its three links', async () => {
    render(<Done />);
    await waitFor(() => expect(screen.getByRole('heading').textContent).toBe('You did it, Mi!'));
    expect(screen.getByRole('img', { name: '3 stars earned' })).toBeTruthy();
    const srcs = [...document.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    expect(srcs).toContain('/images/girl.webp');
    expect(srcs).toContain('/images/girl-beret.webp');
    expect(screen.getByRole('link', { name: 'Play this set again' }).getAttribute('href')).toBe('/games/quiz/s1');
    expect(screen.getByRole('link', { name: 'Choose another set' }).getAttribute('href')).toBe('/games/quiz');
    expect(screen.getByRole('link', { name: 'Go home' }).getAttribute('href')).toBe('/');
  });
});
