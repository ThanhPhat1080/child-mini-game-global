import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  listPending: vi.fn(), approveItem: vi.fn(), rejectItem: vi.fn(),
  listContent: vi.fn(), listPeople: vi.fn(), unpublishItem: vi.fn(), deleteItem: vi.fn(),
  storageUsedBy: vi.fn(), banParent: vi.fn(), unbanParent: vi.fn(), setQuota: vi.fn(),
  listMessages: vi.fn(), markMessage: vi.fn(), createAccount: vi.fn(),
}));
vi.mock('@/lib/superAdmin', async (orig) => ({ ...(await orig<typeof import('@/lib/superAdmin')>()), ...h }));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null) => (p ? `/media/${p}` : null) }));

import QueuePage from '@/app/admin/(super)/queue/page';
import ParentsPage from '@/app/admin/(super)/parents/page';
import ContentPage from '@/app/admin/(super)/content/page';
import MessagesPage from '@/app/admin/(super)/messages/page';

const pending = {
  table: 'quiz_sets', id: 's1', ownerId: 'p1', visibility: 'pending', title: 'Animals',
  images: ['p1/covers/cover.png', 'p1/answers/a.png'], sounds: ['p1/voices/v.mp3'],
};
const parent = (over: Record<string, unknown> = {}) => ({
  userId: 'p1', role: 'parent', parentId: null, name: 'Lan', banned: false, banReasonCode: null, banNote: null, bannedAt: null, quotaBytes: 50 * 1024 * 1024, ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  for (const f of [h.approveItem, h.rejectItem, h.unpublishItem, h.deleteItem, h.banParent, h.unbanParent, h.setQuota, h.markMessage]) f.mockResolvedValue(undefined);
  h.listPending.mockResolvedValue([pending]);
  h.listContent.mockResolvedValue([]);
  h.listPeople.mockResolvedValue([parent()]);
  h.storageUsedBy.mockResolvedValue({ p1: 12 * 1024 * 1024 });
  h.listMessages.mockResolvedValue([]);
});
afterEach(cleanup);

describe('review queue (V3)', () => {
  it('lists pending items and Approve calls review_approve for that row', async () => {
    render(<QueuePage />);
    expect(await screen.findByText('Animals')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(h.approveItem).toHaveBeenCalledWith('quiz_sets', 's1'));
    await waitFor(() => expect(h.listPending).toHaveBeenCalledTimes(2));
  });

  it('shows the item images and sounds for the reviewer', async () => {
    render(<QueuePage />);
    await screen.findByText('Animals');
    expect(screen.getAllByRole('img').map((i) => i.getAttribute('src'))).toEqual(['/media/p1/covers/cover.png', '/media/p1/answers/a.png']);
    expect(screen.getByLabelText('Animals sound 1').getAttribute('src')).toBe('/media/p1/voices/v.mp3');
  });

  it('Reject requires a note, then sends it', async () => {
    render(<QueuePage />);
    await screen.findByText('Animals');
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    const send = screen.getByRole('button', { name: 'Send back' }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Reason for the parent'), { target: { value: '   ' } });
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Reason for the parent'), { target: { value: 'Blurry picture' } });
    fireEvent.click(send);
    await waitFor(() => expect(h.rejectItem).toHaveBeenCalledWith('quiz_sets', 's1', 'Blurry picture'));
  });

  it('shows the database error as a toast and keeps the item', async () => {
    h.approveItem.mockRejectedValue(new Error('not_pending'));
    render(<QueuePage />);
    await screen.findByText('Animals');
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('not_pending')).toBeTruthy();
    expect(screen.getByText('Animals')).toBeTruthy();
  });
});

describe('parents page (N5, U15, Q4)', () => {
  it('Ban opens the dialog and ban_parent gets the code and note', async () => {
    render(<ParentsPage />);
    await screen.findByText('Lan');
    fireEvent.click(screen.getByRole('button', { name: 'Ban' }));
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'violent_scary' } });
    fireEvent.change(screen.getByLabelText(/Note for the parent/), { target: { value: 'scary photo' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Ban' }).at(-1)!);
    await waitFor(() => expect(h.banParent).toHaveBeenCalledWith('p1', 'violent_scary', 'scary photo'));
  });

  it('a banned parent shows the reason and Unban', async () => {
    h.listPeople.mockResolvedValue([parent({ banned: true, banReasonCode: 'hate', banNote: 'rude' })]);
    render(<ParentsPage />);
    await screen.findByText(/Banned:/);
    expect(screen.getByText(/Hateful|thù ghét/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Unban' }));
    await waitFor(() => expect(h.unbanParent).toHaveBeenCalledWith('p1'));
  });

  it('changes the quota via set_quota in bytes and shows the meter', async () => {
    render(<ParentsPage />);
    await screen.findByText('Lan');
    expect(screen.getByText('Storage: 12 / 50 MB')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Quota (MB)'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save quota' }));
    await waitFor(() => expect(h.setQuota).toHaveBeenCalledWith('p1', 100 * 1024 * 1024));
  });
});

describe('content browser (V5)', () => {
  it('unpublishes a global item and deletes any item after confirming', async () => {
    h.listContent.mockResolvedValue([
      { table: 'memory_cards', id: 'c1', ownerId: 'p1', visibility: 'global', title: 'cat', images: [], sounds: [] },
      { table: 'memory_cards', id: 'c2', ownerId: 'p1', visibility: 'private', title: 'dog', images: [], sounds: [] },
    ]);
    render(<ContentPage />);
    await screen.findByText('cat');
    expect(screen.getAllByRole('button', { name: 'Unpublish' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
    await waitFor(() => expect(h.unpublishItem).toHaveBeenCalledWith('memory_cards', 'c1'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete dog' }));
    expect(h.deleteItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(h.deleteItem).toHaveBeenCalledWith('memory_cards', 'c2'));
  });
});

describe('messages page (U17)', () => {
  it('marks a message read and resolved', async () => {
    h.listMessages.mockResolvedValue([{ id: 'm1', fromUser: 'p1', body: 'Please unban me', createdAt: '2026-11-04T10:00:00Z', readAt: null, resolvedAt: null }]);
    render(<MessagesPage />);
    expect(await screen.findByText('Please unban me')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mark read' }));
    await waitFor(() => expect(h.markMessage).toHaveBeenCalledWith('m1', { read: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark resolved' }));
    await waitFor(() => expect(h.markMessage).toHaveBeenCalledWith('m1', { resolved: true }));
  });
});
