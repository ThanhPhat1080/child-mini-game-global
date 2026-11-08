import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ getChildSettings: vi.fn(), updateChildSettings: vi.fn(), removeMedia: vi.fn() }));
vi.mock('@/lib/settings', () => ({ getChildSettings: h.getChildSettings, updateChildSettings: h.updateChildSettings }));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null | undefined) => (p ? `/media/${p}` : null), removeMedia: h.removeMedia }));
vi.mock('@/lib/sfx', () => ({ applause: vi.fn((_s?: number, speak?: () => void) => { speak?.(); return undefined as unknown; }), ohOh: vi.fn(), speakKid: vi.fn(), yay: vi.fn() }));
vi.mock('@/lib/media/renames', () => ({ useMediaRenamed: () => undefined }));
vi.mock('@/components/admin/LibraryButton', () => ({
  LibraryButton: ({ label, onChoose }: { label: string; onChoose: (p: string) => void }) => (
    <button type="button" onClick={() => onChoose('snd/new.mp3')}>Choose {label}</button>
  ),
}));

import { ChildSounds } from '@/components/admin/ChildSounds';

const row = { child_id: 'c1', greeting_path: null, music_path: 'snd/old.mp3', music_volume: 30, hooray_path: null, ohoh_path: null, complete_path: null };

beforeEach(() => {
  vi.resetAllMocks();
  h.getChildSettings.mockResolvedValue(row);
  h.updateChildSettings.mockResolvedValue(undefined);
  h.removeMedia.mockResolvedValue(false);
});
afterEach(cleanup);

describe('ChildSounds (N2, A25, A26)', () => {
  it('Save is off until something changes, then saves sounds and volume only', async () => {
    render(<ChildSounds childId="c1" />);
    await screen.findByText('old.mp3');
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Choose Hooray sound' }));
    fireEvent.change(screen.getByLabelText('Music volume'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(h.updateChildSettings).toHaveBeenCalledWith('c1', { music_volume: 50, hooray_path: 'snd/new.mp3' }));
    expect(await screen.findByText('Saved')).toBeTruthy();
  });

  it('frees a replaced music file after saving', async () => {
    render(<ChildSounds childId="c1" />);
    await screen.findByText('old.mp3');
    fireEvent.click(screen.getByRole('button', { name: 'Choose background music' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(h.removeMedia).toHaveBeenCalledWith(['snd/old.mp3']));
  });

  it('Revert drops the draft', async () => {
    render(<ChildSounds childId="c1" />);
    await screen.findByText('old.mp3');
    fireEvent.click(screen.getByRole('button', { name: 'Choose background music' }));
    expect(screen.getByText('new.mp3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Revert' }));
    expect(screen.getByText('old.mp3')).toBeTruthy();
  });

  it('shows an error toast when the save fails', async () => {
    h.updateChildSettings.mockRejectedValue(new Error('denied'));
    render(<ChildSounds childId="c1" />);
    await screen.findByText('old.mp3');
    fireEvent.click(screen.getByRole('button', { name: 'Choose Oh-oh sound' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('denied')).toBeTruthy();
  });
});
