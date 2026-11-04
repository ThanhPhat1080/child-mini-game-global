import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  listMyChildren: vi.fn(),
  getChildSettings: vi.fn(),
  updateChildSettings: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock('@/lib/settings', () => ({
  listMyChildren: h.listMyChildren,
  getChildSettings: h.getChildSettings,
  updateChildSettings: h.updateChildSettings,
}));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null | undefined) => (p ? `/media/${p}` : null), removeMedia: vi.fn().mockResolvedValue(false) }));
vi.mock('@/lib/sfx', () => ({ applause: vi.fn(), ohOh: vi.fn(), speakKid: vi.fn(), yay: vi.fn() }));
vi.mock('@/lib/media/renames', () => ({ useMediaRenamed: () => undefined }));
// The library dialog is tested on its own; here a button stands in for "pick this file".
vi.mock('@/components/admin/LibraryButton', () => ({
  LibraryButton: ({ kind, label, onChoose }: { kind: string; label: string; onChoose: (p: string) => void }) => (
    <button type="button" onClick={() => onChoose(kind === 'image' ? 'img/new.png' : 'snd/new.mp3')}>Choose {label}</button>
  ),
}));

import ChildrenPage from '@/app/admin/(panel)/children/page';

const kid = (n: number) => ({ child_id: `c${n}`, child_name: `Kid ${n}`, avatar_path: null });
const settings = {
  child_id: 'c1', child_name: 'Kid 1', greeting_path: null, music_path: null, music_volume: 30,
  avatar_path: null, hooray_path: null, ohoh_path: null, complete_path: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  h.listMyChildren.mockResolvedValue([kid(1), kid(2)]);
  h.getChildSettings.mockResolvedValue(settings);
  h.updateChildSettings.mockResolvedValue(undefined);
  vi.stubGlobal('fetch', h.fetch);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const addButton = () => screen.getByRole('button', { name: 'Add child' }) as HTMLButtonElement;

describe('Children dashboard (N2, U8)', () => {
  it("lists the parent's children and keeps Add enabled below 5", async () => {
    render(<ChildrenPage />);
    expect(await screen.findByText('Kid 1')).toBeTruthy();
    expect(screen.getByText('Kid 2')).toBeTruthy();
    expect(addButton().disabled).toBe(false);
  });

  it('disables Add at 5 children', async () => {
    h.listMyChildren.mockResolvedValue([1, 2, 3, 4, 5].map(kid));
    render(<ChildrenPage />);
    await screen.findByText('Kid 5');
    expect(addButton().disabled).toBe(true);
    expect(screen.getByText(/reached the limit/)).toBeTruthy();
  });

  it('add child posts to /api/children, then reloads the list', async () => {
    h.fetch.mockResolvedValue({ ok: true, json: async () => ({ childId: 'c3' }) });
    render(<ChildrenPage />);
    await screen.findByText('Kid 1');
    fireEvent.click(addButton());
    fireEvent.change(screen.getByLabelText(/Child's name/), { target: { value: 'Lan' } });
    fireEvent.change(screen.getByLabelText(/Email for the child/), { target: { value: 'lan@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create child' }));
    await waitFor(() => expect(h.fetch).toHaveBeenCalled());
    const [url, init] = h.fetch.mock.calls[0];
    expect(url).toBe('/api/children');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ email: 'lan@example.com', password: 'secret123', displayName: 'Lan' });
    await waitFor(() => expect(h.listMyChildren).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Child added.')).toBeTruthy();
  });

  it('shows a 409 error as a toast and keeps the form', async () => {
    h.fetch.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'email_taken' }) });
    render(<ChildrenPage />);
    await screen.findByText('Kid 1');
    fireEvent.click(addButton());
    fireEvent.change(screen.getByLabelText(/Child's name/), { target: { value: 'Lan' } });
    fireEvent.change(screen.getByLabelText(/Email for the child/), { target: { value: 'lan@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create child' }));
    expect(await screen.findByText('That email is already used.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create child' })).toBeTruthy();
    expect(h.listMyChildren).toHaveBeenCalledTimes(1);
  });

  it('shows the child limit message for a 409 child_limit', async () => {
    h.fetch.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'child_limit' }) });
    render(<ChildrenPage />);
    await screen.findByText('Kid 1');
    fireEvent.click(addButton());
    fireEvent.change(screen.getByLabelText(/Child's name/), { target: { value: 'Lan' } });
    fireEvent.change(screen.getByLabelText(/Email for the child/), { target: { value: 'lan@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create child' }));
    expect(await screen.findByText('You already have 5 children.')).toBeTruthy();
  });

  it('edit saves name, avatar and sounds via updateChildSettings', async () => {
    render(<ChildrenPage />);
    await screen.findByText('Kid 1');
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    const name = (await screen.findByLabelText(/Child's name/)) as HTMLInputElement;
    await waitFor(() => expect(name.value).toBe('Kid 1'));
    fireEvent.change(name, { target: { value: 'Mia' } });
    fireEvent.click(screen.getByRole('button', { name: 'Choose avatar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose Hooray sound' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(h.updateChildSettings).toHaveBeenCalled());
    expect(h.updateChildSettings).toHaveBeenCalledWith('c1', {
      child_name: 'Mia',
      music_volume: 30,
      avatar_path: 'img/new.png',
      hooray_path: 'snd/new.mp3',
    });
    expect(h.getChildSettings).toHaveBeenCalledWith('c1');
    // the list row follows the saved name
    await waitFor(() => expect(screen.getByText('Mia', { selector: '[class*=rowTitle]' })).toBeTruthy());
  });

  it('shows an error toast when the save fails and keeps the edit', async () => {
    h.updateChildSettings.mockRejectedValue(new Error('denied'));
    render(<ChildrenPage />);
    await screen.findByText('Kid 1');
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    const name = (await screen.findByLabelText(/Child's name/)) as HTMLInputElement;
    await waitFor(() => expect(name.value).toBe('Kid 1'));
    fireEvent.change(name, { target: { value: 'Mia' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('denied')).toBeTruthy();
    expect(name.value).toBe('Mia');
  });
});
