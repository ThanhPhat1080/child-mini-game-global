import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ listLibrary: vi.fn(), rename: vi.fn(), inUse: vi.fn(), del: vi.fn(), role: 'parent' as string | null, me: 'me-id' }));

vi.mock('@/lib/review', () => ({ useMyRole: () => h.role, getMyUserId: async () => h.me }));

vi.mock('@/lib/media/library', () => ({ listLibrary: h.listLibrary }));
vi.mock('@/lib/media/rename', () => ({ renameMedia: h.rename }));
vi.mock('@/lib/audio', () => ({ playOnce: vi.fn() }));
vi.mock('@/lib/media', () => ({
  mediaUrl: (p: string | null) => (p ? `https://cdn.test/${p}` : null),
  uploadToLibrary: vi.fn(),
  isMediaInUse: h.inUse,
  deleteMedia: h.del,
  MAX_IMAGE_BYTES: 2 * 1024 * 1024,
}));
vi.mock('@/lib/crop/render', () => ({ cropToSquare: vi.fn() }));

import MediaPage from '@/app/admin/(panel)/media/page';

beforeEach(() => {
  for (const f of [h.listLibrary, h.rename, h.inUse, h.del]) f.mockReset();
  h.role = 'parent';
  h.me = 'me-id';
  h.listLibrary.mockImplementation(async (kind: string) => (kind === 'image' ? ['library/a-9j2k4m1a7b3cx.png'] : ['library/s-9j2k4m1a7b3dx.mp3']));
});
afterEach(cleanup);

describe('Admin Media page', () => {
  it('has Image library and Sound library tabs and lists every bucket file of the tab', async () => {
    render(<MediaPage />);
    expect(screen.getByRole('tab', { name: 'Image library' }).getAttribute('aria-selected')).toBe('true');
    expect(await screen.findByRole('button', { name: 'View a-9j2k4m1a7b3cx.png' })).toBeTruthy();
    expect(h.listLibrary).toHaveBeenCalledWith('image');
    fireEvent.click(screen.getByRole('tab', { name: 'Sound library' }));
    expect(await screen.findByRole('button', { name: 'Play s-9j2k4m1a7b3dx.mp3' })).toBeTruthy();
    expect(h.listLibrary).toHaveBeenCalledWith('audio');
    expect(screen.queryByRole('button', { name: 'OK' })).toBeNull(); // nothing to choose here
  });

  it('renames, sorts and deletes like the pop-up does', async () => {
    h.rename.mockResolvedValue('library/b-9j2k4m1a7b3cx.png');
    h.inUse.mockResolvedValue(true);
    render(<MediaPage />);
    fireEvent.doubleClick(await screen.findByText('a-9j2k4m1a7b3cx.png'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'b' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(await screen.findByText('Renamed to b-9j2k4m1a7b3cx.png')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete b-9j2k4m1a7b3cx.png' }));
    await waitFor(() => expect(screen.getByText('b-9j2k4m1a7b3cx.png is used somewhere else, so it was not deleted.')).toBeTruthy());
  });

  it('a Super Admin sees every owner\'s files, and can only rename or delete their own', async () => {
    h.role = 'super_admin';
    h.me = 'me-id';
    h.listLibrary.mockImplementation(async (kind: string, scope?: string) => (kind === 'image' && scope === 'all' ? ['me-id/mine-9j2k4m1a7b3cx.png', 'parent-id/theirs-9j2k4m1a7b3dx.png'] : []));
    render(<MediaPage />);
    expect(await screen.findByRole('button', { name: 'View theirs-9j2k4m1a7b3dx.png' })).toBeTruthy();
    expect(h.listLibrary).toHaveBeenCalledWith('image', 'all');
    // their file: no delete button, and a double click does not start a rename
    expect(screen.queryByRole('button', { name: 'Delete theirs-9j2k4m1a7b3dx.png' })).toBeNull();
    fireEvent.doubleClick(screen.getByText('theirs-9j2k4m1a7b3dx.png'));
    expect(screen.queryByRole('textbox')).toBeNull();
    // their own file keeps its actions
    expect(screen.getByRole('button', { name: 'Delete mine-9j2k4m1a7b3cx.png' })).toBeTruthy();
  });
});
