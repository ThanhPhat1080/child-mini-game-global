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

describe('CelebrationScene pictures (parent feedback 3)', () => {
  it('shows the two pictures the parent uploaded, swaying', async () => {
    h.childId.mockReturnValue('7b0f4f0e-3c1a-4d57-9a8e-1f2b3c4d5e6f');
    h.maybeSingle.mockResolvedValue({ data: { celebrate_a_path: 'p/a.png', celebrate_b_path: 'p/b.png' }, error: null });
    const { container } = render(<CelebrationScene greeting="You did it!"><span /></CelebrationScene>);
    await waitFor(() => expect(container.querySelector('[data-celebration-picture="a"] img')?.getAttribute('src')).toContain('/media/p/a.png'));
    expect(container.querySelector('[data-celebration-picture="b"] img')?.getAttribute('src')).toContain('/media/p/b.png');
    expect(container.querySelector('[data-celebration-picture="a"]')?.className).toContain('hm-sway');
    expect(container.querySelector('img[src*="girl.webp"]')).toBeNull();
  });

  it('keeps the built-in characters when no picture was uploaded', async () => {
    h.childId.mockReturnValue('7b0f4f0e-3c1a-4d57-9a8e-1f2b3c4d5e6f');
    h.maybeSingle.mockResolvedValue({ data: { celebrate_a_path: null, celebrate_b_path: null }, error: null });
    const { container } = render(<CelebrationScene greeting="You did it!"><span /></CelebrationScene>);
    await waitFor(() => expect(h.maybeSingle).toHaveBeenCalled());
    expect(container.querySelector('[data-celebration-picture]')).toBeNull();
    expect(container.querySelector('img[src*="girl.webp"]')).not.toBeNull();
    expect(screen.getByRole('heading').textContent).toBe('You did it!');
  });

  it('falls back quietly when the request fails or no child is chosen', async () => {
    h.childId.mockReturnValue(null);
    const { container } = render(<CelebrationScene greeting="Hi"><span /></CelebrationScene>);
    expect(container.querySelector('img[src*="girl.webp"]')).not.toBeNull();
    expect(h.maybeSingle).not.toHaveBeenCalled();
  });
});
