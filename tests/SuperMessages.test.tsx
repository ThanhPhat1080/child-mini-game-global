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

import MessagesPage from '@/app/admin/(super)/messages/page';

const parent = (over: Record<string, unknown> = {}) => ({
  userId: 'p1', role: 'parent', name: 'Lan', banned: false, banReasonCode: null, banNote: null, bannedAt: null, quotaBytes: 50 * 1024 * 1024, ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  for (const f of [h.unpublishItem, h.deleteItem, h.banParent, h.unbanParent, h.setQuota, h.markMessage]) f.mockResolvedValue(undefined);
  h.listContent.mockResolvedValue([]);
  h.listPeople.mockResolvedValue([parent()]);
  h.storageUsedBy.mockResolvedValue({ p1: 12 * 1024 * 1024 });
  h.listMessages.mockResolvedValue([]);
});
afterEach(cleanup);

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
