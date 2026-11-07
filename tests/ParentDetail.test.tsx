import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  listPeople: vi.fn(), listMyChildren: vi.fn(), storageUsedBy: vi.fn(), listContent: vi.fn(),
  banParent: vi.fn(), unbanParent: vi.fn(), setQuota: vi.fn(), removeChild: vi.fn(),
  createChild: vi.fn(), updateChild: vi.fn(), getChildSettings: vi.fn(),
}));
vi.mock('@/lib/superAdmin', async (orig) => ({ ...(await orig<typeof import('@/lib/superAdmin')>()), ...h }));
vi.mock('@/lib/children', async (orig) => ({ ...(await orig<typeof import('@/lib/children')>()), listMyChildren: h.listMyChildren, createChild: h.createChild, updateChild: h.updateChild }));
vi.mock('@/lib/settings', () => ({ getChildSettings: h.getChildSettings, updateChildSettings: vi.fn() }));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null) => (p ? `/media/${p}` : null), removeMedia: vi.fn().mockResolvedValue(false) }));
vi.mock('@/lib/media/renames', () => ({ useMediaRenamed: () => undefined }));
vi.mock('@/lib/sfx', () => ({ applause: vi.fn(), ohOh: vi.fn(), speakKid: vi.fn(), yay: vi.fn() }));

import ParentDetail from '@/components/admin/ParentDetail';

const MB = 1024 * 1024;
const LAN = { userId: 'p1', role: 'parent', name: 'Lan Nguyen', banned: false, banReasonCode: null, banNote: null, bannedAt: null, quotaBytes: 50 * MB, createdAt: '2026-11-01T00:00:00Z' };
const kid = (over: Record<string, unknown> = {}) => ({
  id: 'c1', parent_id: 'p1', child_name: 'mia', display_name: 'Mia', avatar_path: null, gender: 'female', age_band: '2-5', pin: 'ab12', ...over,
});
const levels = [
  { table: 'quiz_sets', id: 's1', ownerId: 'p1', visibility: 'global', title: 'Animals', images: [], sounds: [] },
  { table: 'memory_cards', id: 'm1', ownerId: 'p1', visibility: 'private', title: 'cat', images: ['p1/cat.png'], sounds: ['p1/cat.mp3'] },
  { table: 'spot_levels', id: 'sp1', ownerId: 'p1', visibility: 'private', title: 'Spot the differences', images: ['p1/a.png', 'p1/b.png'], sounds: [], differences: [] },
  { table: 'find_levels', id: 'f1', ownerId: 'p1', visibility: 'pending', title: 'dog, cat', images: ['p1/find.png'], sounds: [] },
];

beforeEach(() => {
  vi.resetAllMocks();
  h.listPeople.mockResolvedValue([LAN]);
  h.listMyChildren.mockResolvedValue([kid()]);
  h.storageUsedBy.mockResolvedValue({ p1: 12 * MB });
  h.listContent.mockResolvedValue(levels);
  h.banParent.mockResolvedValue(undefined);
  h.unbanParent.mockResolvedValue(undefined);
  h.setQuota.mockResolvedValue(undefined);
  h.removeChild.mockResolvedValue(undefined);
  h.createChild.mockResolvedValue({ ok: true, child: kid({ id: 'c9', display_name: 'Bao' }) });
  h.getChildSettings.mockResolvedValue(null);
});
afterEach(cleanup);

describe('Parent detail: header and ban (N14, U15)', () => {
  it('shows the name, initials and storage bar', async () => {
    render(<ParentDetail id="p1" />);
    expect(await screen.findByRole('heading', { name: 'Lan Nguyen' })).toBeTruthy();
    expect(screen.getByText('LN')).toBeTruthy();
    expect(screen.getByText('12 / 50 MB')).toBeTruthy();
  });

  it('Ban asks for a reason, then shows the Unban button and the Ban tag at once', async () => {
    render(<ParentDetail id="p1" />);
    await screen.findByRole('heading', { name: 'Lan Nguyen' });
    fireEvent.click(screen.getByRole('button', { name: 'Ban' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'violent_scary' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ban' }));
    await waitFor(() => expect(h.banParent).toHaveBeenCalledWith('p1', 'violent_scary', ''));
    expect(screen.getByRole('button', { name: 'Unban' })).toBeTruthy();
    expect(screen.getByText('Ban', { selector: 'span' })).toBeTruthy();
  });

  it('a failed ban puts the Ban button back and shows the error', async () => {
    h.banParent.mockRejectedValue(new Error('Only a Super Admin can ban.'));
    render(<ParentDetail id="p1" />);
    await screen.findByRole('heading', { name: 'Lan Nguyen' });
    fireEvent.click(screen.getByRole('button', { name: 'Ban' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'violent_scary' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ban' }));
    expect(await screen.findByText('Only a Super Admin can ban.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ban' })).toBeTruthy();
  });

  it('a banned parent can be unbanned, and the Ban tag goes', async () => {
    h.listPeople.mockResolvedValue([{ ...LAN, banned: true, banReasonCode: 'hate', banNote: 'rude' }]);
    render(<ParentDetail id="p1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Unban' }));
    await waitFor(() => expect(h.unbanParent).toHaveBeenCalledWith('p1'));
    expect(screen.getByRole('button', { name: 'Ban' })).toBeTruthy();
  });
});

describe('Parent detail: quota (N14)', () => {
  it('saves a new quota in bytes and shows the new bar at once', async () => {
    render(<ParentDetail id="p1" />);
    await screen.findByRole('heading', { name: 'Lan Nguyen' });
    fireEvent.change(screen.getByLabelText('Quota (MB)'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('12 / 100 MB')).toBeTruthy();
    await waitFor(() => expect(h.setQuota).toHaveBeenCalledWith('p1', 100 * MB));
  });

  it('a failed quota change goes back to the old value and says why', async () => {
    h.setQuota.mockRejectedValue(new Error('Quota too small.'));
    render(<ParentDetail id="p1" />);
    await screen.findByRole('heading', { name: 'Lan Nguyen' });
    fireEvent.change(screen.getByLabelText('Quota (MB)'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Quota too small.')).toBeTruthy();
    expect(screen.getByText('12 / 50 MB')).toBeTruthy();
  });
});

describe('Parent detail: children (N14, N16)', () => {
  it('shows the children as cards and the Add tile', async () => {
    render(<ParentDetail id="p1" />);
    expect(await screen.findByText('Mia')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit Mia' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add child/ }).hasAttribute('disabled')).toBe(false);
  });

  it('the Add tile is off at 5 children', async () => {
    h.listMyChildren.mockResolvedValue([kid(), kid({ id: 'c2' }), kid({ id: 'c3' }), kid({ id: 'c4' }), kid({ id: 'c5' })]);
    render(<ParentDetail id="p1" />);
    await screen.findAllByText('Mia');
    expect((screen.getByRole('button', { name: /Add child/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Add child in Super Admin mode has no media fields and passes the parent id', async () => {
    render(<ParentDetail id="p1" />);
    await screen.findByText('Mia');
    fireEvent.click(screen.getByRole('button', { name: /Add child/ }));
    const dialog = screen.getByRole('dialog');
    for (const text of ['Avatar', 'Celebration pictures', 'Welcome sound', 'More sounds']) {
      expect(within(dialog).queryByText(text)).toBeNull();
    }
    fireEvent.click(within(dialog).getByRole('button', { name: 'Boy' }));
    fireEvent.change(within(dialog).getByLabelText('Display name'), { target: { value: 'Bao' } });
    fireEvent.change(within(dialog).getByLabelText('Login name'), { target: { value: 'bao' } });
    fireEvent.change(within(dialog).getByLabelText('PIN'), { target: { value: 'ab12' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(h.createChild).toHaveBeenCalled());
    expect(h.createChild.mock.calls[0][2]).toBe('p1');
    expect(h.createChild.mock.calls[0][0]).toMatchObject({ child_name: 'bao', display_name: 'Bao', avatar_path: null });
  });

  it('Remove asks first, then deletes the child', async () => {
    render(<ParentDetail id="p1" />);
    await screen.findByText('Mia');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Mia' }));
    expect(h.removeChild).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(h.removeChild).toHaveBeenCalledWith('c1'));
  });
});

describe('Parent detail: levels (N14)', () => {
  it('lists the parent levels by game, view only', async () => {
    render(<ParentDetail id="p1" />);
    const region = await screen.findByRole('region', { name: 'Levels' });
    expect(within(region).getByRole('link', { name: /Animals/ }).getAttribute('href')).toBe('/admin/sets/s1');
    expect(within(region).getByText('cat')).toBeTruthy();
    expect(within(region).getByText('Under review')).toBeTruthy();
    expect(within(region).queryByRole('button', { name: /Delete|Unpublish/ })).toBeNull();
    expect(h.listContent).toHaveBeenCalledWith(undefined, { ownerId: 'p1' });
  });

  it('a card opens read-only with its picture and sound', async () => {
    render(<ParentDetail id="p1" />);
    const region = await screen.findByRole('region', { name: 'Levels' });
    fireEvent.click(within(region).getByRole('button', { name: 'View card cat' }));
    const dialog = screen.getByRole('dialog', { name: 'cat' });
    expect(within(dialog).getByRole('img', { name: 'cat picture 1' }).getAttribute('src')).toBe('/media/p1/cat.png');
    expect(within(dialog).getByLabelText('cat sound 1').getAttribute('src')).toBe('/media/p1/cat.mp3');
  });

  it('a spot level opens the read-only spot view', async () => {
    render(<ParentDetail id="p1" />);
    const region = await screen.findByRole('region', { name: 'Levels' });
    fireEvent.click(within(region).getByRole('button', { name: /View spot level/ }));
    expect(screen.getByRole('dialog', { name: 'Spot the differences level' })).toBeTruthy();
  });
});
