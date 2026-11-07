import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ maybeSingle: vi.fn(), childId: vi.fn() }));
vi.mock('@/lib/childSession', () => ({ getActiveChildId: h.childId }));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null) => (p ? `/media/${p}` : null) }));
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: h.maybeSingle }) }) }) }),
}));
vi.mock('@/components/Hills', () => ({ Hills: () => null }));
vi.mock('@/components/Confetti', () => ({ Confetti: () => null }));

import { CelebrationScene } from '@/components/CelebrationScene';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const CHILD = '7b0f4f0e-3c1a-4d57-9a8e-1f2b3c4d5e6f';
const row = (over: Record<string, unknown>) => ({ data: { celebrate_a_path: null, celebrate_b_path: null, gender: 'male', ...over }, error: null });
const srcOf = (container: HTMLElement, sel: string) => container.querySelector(sel)?.querySelector('img')?.getAttribute('src');

describe('CelebrationScene pictures (parent feedback 3)', () => {
  it('both uploaded: A on the left and B on the right, swaying, with no built-in character', async () => {
    h.childId.mockReturnValue(CHILD);
    h.maybeSingle.mockResolvedValue(row({ celebrate_a_path: 'p/a.png', celebrate_b_path: 'p/b.png' }));
    const { container } = render(<CelebrationScene greeting="You did it!"><span /></CelebrationScene>);
    await waitFor(() => expect(srcOf(container, '[data-celebration-picture="a"]')).toContain('/media/p/a.png'));
    expect(srcOf(container, '[data-celebration-picture="b"]')).toContain('/media/p/b.png');
    expect(container.querySelector('[data-celebration-picture="a"]')?.className).toContain('hm-sway');
    expect(container.querySelector('img[src*="prince"], img[src*="princess"]')).toBeNull();
  });

  it('only A uploaded: the prince stays on the left for a boy and A is on the right', async () => {
    h.childId.mockReturnValue(CHILD);
    h.maybeSingle.mockResolvedValue(row({ celebrate_a_path: 'p/a.png', gender: 'male' }));
    const { container } = render(<CelebrationScene greeting="You did it!"><span /></CelebrationScene>);
    await waitFor(() => expect(srcOf(container, '[data-celebration-picture="a"]')).toContain('/media/p/a.png'));
    expect(srcOf(container, '[data-celebration-picture="default"]')).toContain('/images/prince.webp');
    expect(container.querySelectorAll('[data-celebration-picture]')).toHaveLength(2);
  });

  it('only B uploaded: the princess stays on the left for a girl and B is on the right', async () => {
    h.childId.mockReturnValue(CHILD);
    h.maybeSingle.mockResolvedValue(row({ celebrate_b_path: 'p/b.png', gender: 'female' }));
    const { container } = render(<CelebrationScene greeting="You did it!"><span /></CelebrationScene>);
    await waitFor(() => expect(srcOf(container, '[data-celebration-picture="b"]')).toContain('/media/p/b.png'));
    expect(srcOf(container, '[data-celebration-picture="default"]')).toContain('/images/princess.webp');
  });

  it('nothing uploaded: one built-in character on the left, a prince for a boy, and no right-hand picture', async () => {
    h.childId.mockReturnValue(CHILD);
    h.maybeSingle.mockResolvedValue(row({ gender: 'male' }));
    const { container } = render(<CelebrationScene greeting="You did it!"><span /></CelebrationScene>);
    await waitFor(() => expect(h.maybeSingle).toHaveBeenCalled());
    await waitFor(() => expect(srcOf(container, '[data-celebration-picture="default"]')).toContain('/images/prince.webp'));
    expect(container.querySelectorAll('[data-celebration-picture]')).toHaveLength(1);
    expect(screen.getByRole('heading').textContent).toBe('You did it!');
  });

  it('no child chosen: the princess alone, and the request is never made', async () => {
    h.childId.mockReturnValue(null);
    const { container } = render(<CelebrationScene greeting="Hi"><span /></CelebrationScene>);
    await waitFor(() => expect(srcOf(container, '[data-celebration-picture="default"]')).toContain('/images/princess.webp'));
    expect(container.querySelectorAll('[data-celebration-picture]')).toHaveLength(1);
    expect(h.maybeSingle).not.toHaveBeenCalled();
  });
});
