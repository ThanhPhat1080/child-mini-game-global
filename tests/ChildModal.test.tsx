import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  createChild: vi.fn(), updateChild: vi.fn(), updateChildSettings: vi.fn(), getChildSettings: vi.fn(), removeMedia: vi.fn(),
}));
vi.mock('@/lib/children', async (orig) => ({ ...(await orig<typeof import('@/lib/children')>()), createChild: h.createChild, updateChild: h.updateChild }));
vi.mock('@/lib/settings', () => ({ getChildSettings: h.getChildSettings, updateChildSettings: h.updateChildSettings }));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null | undefined) => (p ? `/media/${p}` : null), removeMedia: h.removeMedia }));
vi.mock('@/lib/sfx', () => ({ applause: vi.fn(), ohOh: vi.fn(), speakKid: vi.fn(), yay: vi.fn() }));
vi.mock('@/lib/media/renames', () => ({ useMediaRenamed: () => undefined }));
vi.mock('@/components/admin/LibraryButton', () => ({
  LibraryButton: ({ kind, label, onChoose }: { kind: string; label: string; onChoose: (p: string) => void }) => (
    <button type="button" onClick={() => onChoose(kind === 'image' ? 'img/new.png' : 'snd/new.mp3')}>Choose {label}</button>
  ),
}));

import { ChildModal } from '@/components/admin/ChildModal';
import type { Child } from '@/lib/children';

const kid: Child = { id: 'c1', parent_id: 'p', child_name: 'mia01', display_name: 'Mia', avatar_path: 'img/old.png', gender: 'female', age_band: '5-10', pin: 'ab12' };
const saved: Child = { ...kid, id: 'c9', child_name: 'lan', display_name: 'Lan', gender: 'male', age_band: '2-5', avatar_path: null };

beforeEach(() => {
  vi.resetAllMocks();
  h.removeMedia.mockResolvedValue(false);
  h.updateChildSettings.mockResolvedValue(undefined);
  h.updateChild.mockResolvedValue({ ok: true });
  h.getChildSettings.mockResolvedValue({ child_id: 'c1', greeting_path: 'snd/old.mp3', music_path: null, music_volume: 30, hooray_path: null, ohoh_path: null, complete_path: null });
});
afterEach(cleanup);

const fill = () => {
  fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Lan' } });
  fireEvent.change(screen.getByLabelText('Login name'), { target: { value: 'lan' } });
  fireEvent.change(screen.getByLabelText('PIN'), { target: { value: 'ab12' } });
};

describe('ChildModal (KU3-KU8)', () => {
  it('create mode has an editable login name; edit mode shows it read-only', async () => {
    const { unmount } = render(<ChildModal mode="create" onClose={() => {}} onSaved={() => {}} />);
    expect((screen.getByLabelText('Login name') as HTMLInputElement).readOnly).toBe(false);
    unmount();
    render(<ChildModal mode="edit" child={kid} onClose={() => {}} onSaved={() => {}} />);
    expect(screen.queryByLabelText('Login name')).toBeNull();
    expect(screen.getByText('mia01')).toBeTruthy();
    expect(screen.getByLabelText('Login name locked')).toBeTruthy();
    await waitFor(() => expect(h.getChildSettings).toHaveBeenCalled());
  });

  it('Girl then Boy changes colors immediately and aria-pressed', () => {
    render(<ChildModal mode="create" onClose={() => {}} onSaved={() => {}} />);
    const dlg = screen.getByRole('dialog');
    const title = screen.getByRole('heading');
    expect(screen.getByRole('button', { name: 'Boy' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Girl' }));
    expect(dlg.getAttribute('style')).toContain('rgb(248, 220, 223)');
    expect(title.getAttribute('style')).toContain('rgb(154, 69, 80)');
    expect(screen.getByRole('button', { name: 'Girl' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Boy' }));
    expect(dlg.getAttribute('style')).toContain('rgb(220, 232, 241)');
    expect(title.getAttribute('style')).toContain('rgb(63, 98, 133)');
    expect(screen.getByRole('button', { name: 'Girl' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('an invalid PIN shows a field error and does not create', () => {
    render(<ChildModal mode="create" onClose={() => {}} onSaved={() => {}} />);
    fill();
    fireEvent.change(screen.getByLabelText('PIN'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('The PIN must be exactly 4 letters or digits.')).toBeTruthy();
    expect(h.createChild).not.toHaveBeenCalled();
  });

  it('name_taken shows the message and keeps the modal open', async () => {
    h.createChild.mockResolvedValue({ ok: false, error: 'name_taken' });
    const onClose = vi.fn();
    render(<ChildModal mode="create" onClose={onClose} onSaved={() => {}} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('That name is already used. Choose another.')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('success calls onSaved and closes, writing the welcome sound after the insert', async () => {
    h.createChild.mockResolvedValue({ ok: true, child: saved });
    const onClose = vi.fn(); const onSaved = vi.fn();
    render(<ChildModal mode="create" onClose={onClose} onSaved={onSaved} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Choose avatar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose welcome sound' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(h.createChild).toHaveBeenCalledWith({ child_name: 'lan', display_name: 'Lan', avatar_path: 'img/new.png', gender: 'male', age_band: '2-5', pin: 'ab12' });
    expect(h.updateChildSettings).toHaveBeenCalledWith('c9', { greeting_path: 'snd/new.mp3' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes as created with a warning when the welcome sound write fails', async () => {
    h.createChild.mockResolvedValue({ ok: true, child: saved });
    h.updateChildSettings.mockRejectedValue(new Error('x'));
    const onClose = vi.fn(); const onSaved = vi.fn();
    render(<ChildModal mode="create" onClose={onClose} onSaved={onSaved} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Choose welcome sound' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSaved).toHaveBeenCalled();
  });

  it('edit saves fields, welcome sound, and frees the replaced avatar', async () => {
    const onSaved = vi.fn(); const onClose = vi.fn();
    render(<ChildModal mode="edit" child={kid} onClose={onClose} onSaved={onSaved} />);
    await waitFor(() => expect(h.getChildSettings).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Mimi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Choose avatar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose welcome sound' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(h.updateChild).toHaveBeenCalledWith('c1', { display_name: 'Mimi', avatar_path: 'img/new.png', gender: 'female', age_band: '5-10', pin: 'ab12' });
    expect(h.updateChildSettings).toHaveBeenCalledWith('c1', { greeting_path: 'snd/new.mp3' });
    expect(h.removeMedia).toHaveBeenCalledWith(['img/old.png', 'snd/old.mp3']);
    expect(onClose).toHaveBeenCalled();
  });

  it('edit mode has a collapsed More sounds block; create mode has none', async () => {
    const { unmount } = render(<ChildModal mode="create" onClose={() => {}} onSaved={() => {}} />);
    expect(screen.queryByRole('button', { name: /More sounds/ })).toBeNull();
    unmount();
    render(<ChildModal mode="edit" child={kid} onClose={() => {}} onSaved={() => {}} />);
    const btn = screen.getByRole('button', { name: /More sounds/ });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(await screen.findByText('Background music')).toBeTruthy();
  });

  it('Esc closes; Esc and backdrop do nothing while saving', async () => {
    const onClose = vi.fn();
    const { unmount } = render(<ChildModal mode="create" onClose={onClose} onSaved={() => {}} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    let resolve: (v: unknown) => void = () => {};
    h.createChild.mockReturnValue(new Promise((r) => { resolve = r; }));
    const close2 = vi.fn();
    render(<ChildModal mode="create" onClose={close2} onSaved={() => {}} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(close2).not.toHaveBeenCalled();
    await act(async () => { resolve({ ok: false, error: 'failed' }); });
  });
});
