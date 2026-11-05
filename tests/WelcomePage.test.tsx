import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/settings', () => ({ getMyChildSettings: h.get }));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null) => (p ? `/media/${p}` : null) }));
vi.mock('@/lib/audio', () => ({ playOnce: vi.fn(), startMusic: vi.fn() }));
vi.mock('@/components/MusicButton', () => ({ MusicButton: () => null }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

import Welcome from '@/app/page';

const base = { child_name: 'Bi', greeting_path: null, music_path: null, music_volume: 30, avatar_path: null };
const enter = () => screen.queryByRole('button', { name: 'Tap to enter' });

afterEach(cleanup);

describe('Welcome by gender (FP9, FP1)', () => {
  it('shows no hero and no enter button until the child is known', () => {
    h.get.mockReturnValue(new Promise(() => undefined));
    render(<Welcome />);
    expect(enter()).toBeNull();
    expect(screen.queryByAltText(/chibi/i)).toBeNull();
  });
  it('a boy gets the prince and the blue variables', async () => {
    h.get.mockResolvedValue({ ...base, gender: 'male' });
    const { container } = render(<Welcome />);
    expect(await screen.findByAltText('Chibi prince with a crown and cape')).toBeTruthy();
    const scene = container.querySelector('[data-welcome-scene]') as HTMLElement;
    expect(scene.style.getPropertyValue('--w-enter')).toBe('#A9C6DE');
  });
  it('a girl keeps the princess and sets no variables', async () => {
    h.get.mockResolvedValue({ ...base, gender: 'female' });
    const { container } = render(<Welcome />);
    expect(await screen.findByAltText('Chibi princess with a magic wand')).toBeTruthy();
    const scene = container.querySelector('[data-welcome-scene]') as HTMLElement;
    expect(scene.style.getPropertyValue('--w-enter')).toBe('');
  });
  it('a failed load shows the princess and still lets the child enter', async () => {
    h.get.mockRejectedValue(new Error('x'));
    render(<Welcome />);
    await waitFor(() => expect(enter()).toBeTruthy());
    expect(screen.getByAltText('Chibi princess with a magic wand')).toBeTruthy();
  });
});
