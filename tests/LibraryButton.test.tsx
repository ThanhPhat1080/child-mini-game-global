import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const lib = vi.hoisted(() => ({ listLibrary: vi.fn() }));
vi.mock('@/lib/media/library', () => ({ listLibrary: lib.listLibrary }));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null) => (p ? `https://cdn.test/${p}` : null) }));

import { LibraryButton } from '@/components/admin/LibraryButton';

afterEach(cleanup);

describe('LibraryButton (A24)', () => {
  it('opens the library for the named field and hands back the chosen path', async () => {
    lib.listLibrary.mockResolvedValue(['cards/c1.png']);
    const onChoose = vi.fn();
    render(<LibraryButton kind="image" label="card 3 picture" onChoose={onChoose} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Choose from library for card 3 picture' }));
    expect(lib.listLibrary).toHaveBeenCalledWith('image');
    fireEvent.click(await screen.findByRole('button', { name: 'Choose c1.png' }));
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onChoose).toHaveBeenCalledWith('cards/c1.png');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
