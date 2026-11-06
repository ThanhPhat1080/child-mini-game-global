import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ listMessages: vi.fn(), listPeople: vi.fn(), markMessage: vi.fn() }));
vi.mock('@/lib/superAdmin', async (orig) => ({ ...(await orig<typeof import('@/lib/superAdmin')>()), ...h }));

import MessagesPage from '@/app/admin/(super)/messages/page';

const parent = (userId: string, name: string) => ({
  userId, role: 'parent', name, banned: false, banReasonCode: null, banNote: null, bannedAt: null, quotaBytes: 0, createdAt: '2026-11-01T00:00:00Z',
});
const msg = (over: Record<string, unknown>) => ({ id: 'm', fromUser: 'p1', body: 'x', createdAt: '2026-11-04T10:00:00Z', readAt: null, resolvedAt: null, ...over });

const MESSAGES = [
  msg({ id: 'm1', fromUser: 'p1', body: 'Please unban me', createdAt: '2026-11-04T10:00:00Z' }),
  msg({ id: 'm2', fromUser: 'p2', body: 'My son cannot log in', createdAt: '2026-11-05T10:00:00Z' }),
  msg({ id: 'm3', fromUser: 'p1', body: 'Thank you again', createdAt: '2026-11-06T10:00:00Z', readAt: '2026-11-06T11:00:00Z' }),
  msg({ id: 'm4', fromUser: 'p2', body: 'All fixed now', createdAt: '2026-11-03T10:00:00Z', readAt: '2026-11-03T11:00:00Z', resolvedAt: '2026-11-03T12:00:00Z' }),
];

beforeEach(() => {
  vi.resetAllMocks();
  h.listMessages.mockResolvedValue(MESSAGES);
  h.listPeople.mockResolvedValue([parent('p1', 'Lan Nguyen'), parent('p2', 'Bao Tran')]);
  h.markMessage.mockResolvedValue(undefined);
});
afterEach(cleanup);

/** The bodies in the order they are listed. */
const bodies = () => screen.getAllByText(/Please|cannot|Thank|All fixed/).map((n) => n.textContent);

describe('Messages page tabs (N17)', () => {
  it('Pending lists the unresolved messages; History lists the resolved ones', async () => {
    render(<MessagesPage />);
    await screen.findByText('Please unban me');
    expect(bodies().sort()).toEqual(['Please unban me', 'My son cannot log in', 'Thank you again'].sort());
    expect(screen.queryByText('All fixed now')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'History' }));
    expect(bodies()).toEqual(['All fixed now']);
    expect(screen.getByRole('tab', { name: 'History' }).getAttribute('aria-selected')).toBe('true');
  });

  it('shows the empty note for a tab with nothing in it', async () => {
    h.listMessages.mockResolvedValue([MESSAGES[3]]);
    render(<MessagesPage />);
    expect(await screen.findByText('No pending messages.')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'History' }));
    expect(screen.getByText('All fixed now')).toBeTruthy();
  });
});

describe('Messages page search and sort (N17)', () => {
  it('searches by parent name', async () => {
    render(<MessagesPage />);
    await screen.findByText('Please unban me');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'bao' } });
    expect(bodies()).toEqual(['My son cannot log in']);
  });

  it('sorts newest first, and by parent A to Z on request', async () => {
    render(<MessagesPage />);
    await screen.findByText('Please unban me');
    expect(bodies()).toEqual(['Thank you again', 'My son cannot log in', 'Please unban me']);
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort' }), { target: { value: 'az' } });
    expect(bodies()).toEqual(['My son cannot log in', 'Thank you again', 'Please unban me']);
  });

  it('each message starts with its parent row, linked to the parent detail', async () => {
    render(<MessagesPage />);
    await screen.findByText('Please unban me');
    const item = screen.getByText('My son cannot log in').closest('li')!;
    expect(item.getAttribute('aria-label')).toBe('Message from Bao Tran');
    expect(within(item).getByRole('link', { name: 'Bao Tran' }).getAttribute('href')).toBe('/admin/parents/p2');
  });
});

describe('Messages page actions (U17)', () => {
  it('Mark read, then Mark resolved; the change is announced to the nav', async () => {
    const seen = vi.fn();
    window.addEventListener('cp:messages-changed', seen);
    render(<MessagesPage />);
    await screen.findByText('Please unban me');
    const item = screen.getByText('Please unban me').closest('li')!;
    fireEvent.click(within(item).getByRole('button', { name: 'Mark read' }));
    await waitFor(() => expect(h.markMessage).toHaveBeenCalledWith('m1', { read: true }));
    await waitFor(() => expect(seen).toHaveBeenCalled());
    fireEvent.click(within(item).getByRole('button', { name: 'Mark resolved' }));
    await waitFor(() => expect(h.markMessage).toHaveBeenCalledWith('m1', { resolved: true }));
    window.removeEventListener('cp:messages-changed', seen);
  });

  it('Reopen in History sends the message back to Pending', async () => {
    render(<MessagesPage />);
    await screen.findByText('Please unban me');
    fireEvent.click(screen.getByRole('tab', { name: 'History' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
    await waitFor(() => expect(h.markMessage).toHaveBeenCalledWith('m4', { resolved: false }));
  });
});
