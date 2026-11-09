import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  LibraryButton: function MockLib({ kind, label, onChoose, aspect }: { kind: string; label: string; onChoose: (p: string) => void; aspect?: number }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" data-aspect={aspect === undefined ? '' : String(aspect)} onClick={() => onChoose(kind === 'image' ? 'img/new.png' : 'snd/new.mp3')}>Choose {label}</button>
        <button type="button" onClick={() => setOpen(true)}>Open library {label}</button>
        {open && <div role="dialog" aria-label={`Library ${label}`}><button type="button">Lib first</button><button type="button">Lib last</button></div>}
      </>
    );
  },
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
  it('Gender and Age share one row (FA3)', () => {
    render(<ChildModal mode="create" onClose={() => {}} onSaved={() => {}} />);
    const gender = screen.getByRole('group', { name: 'Gender' });
    const age = screen.getByRole('group', { name: 'Age band' });
    expect(gender.parentElement).toBe(age.parentElement);
    // both sit in a row of their own, not directly in the dialog column
    expect(gender.parentElement).not.toBe(screen.getByRole('dialog'));
  });

  it('Close calls onClose (FA4, FA5)', () => {
    const onClose = vi.fn();
    render(<ChildModal mode="create" onClose={onClose} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

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
    expect(dlg.getAttribute('style')).toContain('rgb(255, 252, 242)'); // pale yellow stays
    expect(dlg.getAttribute('style')).toContain('rgb(229, 154, 161)'); // pink border
    expect(title.getAttribute('style')).toContain('rgb(154, 69, 80)');
    expect(screen.getByRole('button', { name: 'Girl' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Boy' }));
    expect(dlg.getAttribute('style')).toContain('rgb(255, 252, 242)'); // pale yellow stays
    expect(dlg.getAttribute('style')).toContain('rgb(143, 179, 209)'); // blue border
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

  it('success saves, writes the welcome sound, and keeps the modal open on the new child with More sounds pulsing', async () => {
    h.createChild.mockResolvedValue({ ok: true, child: saved });
    const onClose = vi.fn(); const onSaved = vi.fn();
    render(<ChildModal mode="create" onClose={onClose} onSaved={onSaved} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Choose avatar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose welcome sound' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(h.createChild).toHaveBeenCalledWith({ child_name: 'lan', display_name: 'Lan', avatar_path: 'img/new.png', celebrate_a_path: null, celebrate_b_path: null, gender: 'male', age_band: '2-5', pin: 'ab12' });
    expect(h.updateChildSettings).toHaveBeenCalledWith('c9', { greeting_path: 'snd/new.mp3' });
    // The modal stays open: it is now an edit of the new child, and More sounds is ready to open.
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Edit child' })).toBeTruthy();
    const more = screen.getByRole('button', { name: /More sounds/ });
    expect(more.className).toContain('morePulse');
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(more);
  });

  it('after the warning case, the modal stays open with the warning and More sounds', async () => {
    h.createChild.mockResolvedValue({ ok: true, child: saved });
    h.updateChildSettings.mockRejectedValue(new Error('x'));
    const onClose = vi.fn(); const onSaved = vi.fn(); const onNotice = vi.fn();
    render(<ChildModal mode="create" onClose={onClose} onSaved={onSaved} onNotice={onNotice} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Choose welcome sound' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onNotice).toHaveBeenCalledWith('warning', expect.stringContaining('welcome sound'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /More sounds/ }).className).toContain('morePulse');
  });

  it('edit saves the two celebration pictures and frees the ones they replace', async () => {
    const onSaved = vi.fn(); const onClose = vi.fn();
    const withPics: Child = { ...kid, celebrate_a_path: 'img/cel-a-old.png', celebrate_b_path: 'img/cel-b-old.png' };
    render(<ChildModal mode="edit" child={withPics} onClose={onClose} onSaved={onSaved} />);
    await waitFor(() => expect(h.getChildSettings).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Choose celebration picture A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose celebration picture B' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(h.updateChild).toHaveBeenCalledWith('c1', expect.objectContaining({ celebrate_a_path: 'img/new.png', celebrate_b_path: 'img/new.png' }));
    expect(h.removeMedia).toHaveBeenCalledWith(['img/cel-a-old.png', 'img/cel-b-old.png']);
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
    expect(h.updateChild).toHaveBeenCalledWith('c1', { display_name: 'Mimi', avatar_path: 'img/new.png', celebrate_a_path: null, celebrate_b_path: null, gender: 'female', age_band: '5-10', pin: 'ab12' });
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
    expect(await screen.findByText('Feedback sounds')).toBeTruthy();
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
    fireEvent.mouseDown(screen.getByTestId('modal-backdrop'));
    expect(close2).not.toHaveBeenCalled();
    await act(async () => { resolve({ ok: false, error: 'failed' }); });
  });

  it('an idle backdrop mouse-down closes the modal', () => {
    const onClose = vi.fn();
    render(<ChildModal mode="create" onClose={onClose} onSaved={() => {}} />);
    fireEvent.mouseDown(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Tab and Shift+Tab wrap inside the modal', () => {
    render(<ChildModal mode="create" onClose={() => {}} onSaved={() => {}} />);
    const dlg = screen.getByRole('dialog');
    const items = Array.from(dlg.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'));
    const first = items[0]; const last = items[items.length - 1];
    last.focus();
    expect(fireEvent.keyDown(last, { key: 'Tab' })).toBe(false);
    expect(document.activeElement).toBe(first);
    expect(fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })).toBe(false);
    expect(document.activeElement).toBe(last);
  });

  it('focus moves into the dialog on open and returns to the opener on close', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = render(<ChildModal mode="create" onClose={() => {}} onSaved={() => {}} />);
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('edit Save is disabled until the settings load', async () => {
    let resolve: (v: unknown) => void = () => {};
    h.getChildSettings.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<ChildModal mode="edit" child={kid} onClose={() => {}} onSaved={() => {}} />);
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { resolve({ child_id: 'c1', greeting_path: null }); });
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('when the settings fail to load, the other fields still save and the welcome sound is unavailable', async () => {
    h.getChildSettings.mockRejectedValue(new Error('boom'));
    const onSaved = vi.fn(); const onClose = vi.fn();
    render(<ChildModal mode="edit" child={kid} onClose={onClose} onSaved={onSaved} />);
    await waitFor(() => expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByRole('button', { name: 'Choose welcome sound' })).toBeNull();
    fireEvent.change(screen.getByLabelText('PIN'), { target: { value: 'zz99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(h.updateChild).toHaveBeenCalledWith('c1', expect.objectContaining({ pin: 'zz99' }));
    expect(h.updateChildSettings).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('Esc inside an open library dialog does not close the child modal', () => {
    const onClose = vi.fn();
    render(<ChildModal mode="create" onClose={onClose} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open library avatar' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Lib first' }), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Tab inside the library dialog stays inside it', () => {
    render(<ChildModal mode="create" onClose={() => {}} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open library avatar' }));
    const first = screen.getByRole('button', { name: 'Lib first' });
    const last = screen.getByRole('button', { name: 'Lib last' });
    last.focus();
    expect(fireEvent.keyDown(last, { key: 'Tab' })).toBe(false);
    expect(document.activeElement).toBe(first);
    expect(fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })).toBe(false);
    expect(document.activeElement).toBe(last);
  });
});

// A32: the celebration pictures are cropped to the 3:5 frame, and the form has a transparency tip.
describe('ChildModal celebration pictures (A32)', () => {
  it('each celebration picture uses the 3:5 frame shape for its crop', () => {
    render(<ChildModal mode="create" onClose={() => {}} onSaved={() => {}} />);
    for (const k of ['A', 'B']) {
      expect(screen.getByRole('button', { name: `Choose celebration picture ${k}` }).getAttribute('data-aspect')).toBe(String(340 / 600));
    }
    // The avatar keeps the square crop (A24): no aspect is passed.
    expect(screen.getByRole('button', { name: 'Choose avatar' }).getAttribute('data-aspect')).toBe('');
  });

  it('the form tells the parent to use a transparent background', () => {
    render(<ChildModal mode="create" onClose={() => {}} onSaved={() => {}} />);
    expect(screen.getByText(/transparent background/)).toBeTruthy();
    expect(screen.getByText(/cropped to a tall frame \(3:5\)/)).toBeTruthy();
  });
});

describe('ChildModal in Super Admin mode (parentId, N16)', () => {
  const pass = () => render(<ChildModal mode="create" parentId="p1" onClose={() => {}} onSaved={() => {}} />);

  it('hides the avatar, celebration, welcome sound and more-sounds sections', () => {
    pass();
    const dlg = screen.getByRole('dialog');
    for (const text of ['Avatar', 'Celebration pictures', 'Welcome sound']) {
      expect(within(dlg).queryByText(text)).toBeNull();
    }
    expect(screen.queryByRole('button', { name: /More sounds/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Choose avatar/ })).toBeNull();
  });

  it('edit in this mode also hides the media and the More sounds block, and does not read settings', async () => {
    render(<ChildModal mode="edit" parentId="p1" child={kid} onClose={() => {}} onSaved={() => {}} />);
    expect(screen.queryByText('Welcome sound')).toBeNull();
    expect(screen.queryByRole('button', { name: /More sounds/ })).toBeNull();
    await new Promise((r) => setTimeout(r, 0));
    expect(h.getChildSettings).not.toHaveBeenCalled();
    // Save is enabled at once: nothing waits for the settings
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(h.updateChild).toHaveBeenCalled());
  });

  it('create passes the parent id and sends no picture fields', async () => {
    h.createChild.mockResolvedValue({ ok: true, child: saved });
    const onSaved = vi.fn();
    render(<ChildModal mode="create" parentId="p1" onClose={() => {}} onSaved={onSaved} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(h.createChild.mock.calls[0][2]).toBe('p1');
    expect(h.createChild.mock.calls[0][0]).toEqual({ child_name: 'lan', display_name: 'Lan', avatar_path: null, celebrate_a_path: null, celebrate_b_path: null, gender: 'male', age_band: '2-5', pin: 'ab12' });
  });

  it('edit saves only the non-media fields and never removes media', async () => {
    const onSaved = vi.fn();
    render(<ChildModal mode="edit" parentId="p1" child={{ ...kid, avatar_path: 'img/keep.png', celebrate_a_path: 'img/a.png' }} onClose={() => {}} onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Mia 2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const patch = h.updateChild.mock.calls[0][1];
    expect(patch).toEqual({ display_name: 'Mia 2', gender: 'female', age_band: '5-10', pin: 'ab12' });
    expect(h.updateChild.mock.calls[0][0]).toBe('c1');
    expect(h.updateChildSettings).not.toHaveBeenCalled();
    expect(h.removeMedia).not.toHaveBeenCalled();
  });

  it('a full parent says so in this mode', async () => {
    h.createChild.mockResolvedValue({ ok: false, error: 'child_limit' });
    render(<ChildModal mode="create" parentId="p1" onClose={() => {}} onSaved={() => {}} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('This parent already has 5 children.')).toBeTruthy();
  });
});
