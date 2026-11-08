import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  listPeople: vi.fn(), listAllChildren: vi.fn(), storageUsedBy: vi.fn(), pendingSenders: vi.fn(), createAccount: vi.fn(), push: vi.fn(),
}));
vi.mock('@/lib/superAdmin', async (orig) => ({ ...(await orig<typeof import('@/lib/superAdmin')>()), ...h }));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null) => (p ? `/media/${p}` : null) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push, refresh: vi.fn() }) }));

import ParentsPage from '@/app/admin/(super)/parents/page';

const MB = 1024 * 1024;
const parent = (over: Record<string, unknown> = {}) => ({
  userId: 'p1', role: 'parent', name: 'Lan Nguyen', banned: false, banReasonCode: null, banNote: null, bannedAt: null,
  quotaBytes: 50 * MB, createdAt: '2026-11-01T00:00:00Z', ...over,
});
const kid = (over: Record<string, unknown> = {}) => ({
  id: 'c1', parent_id: 'p1', child_name: 'mia', display_name: 'Mia', avatar_path: null, gender: 'female', age_band: '2-5', pin: 'ab12',
  created_at: '2026-11-01T00:00:00Z', parent_name: 'Lan Nguyen', parent_banned: false, ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  h.listPeople.mockResolvedValue([
    parent(),
    parent({ userId: 'p2', name: 'Bao Tran', banned: true, createdAt: '2026-11-03T00:00:00Z', quotaBytes: 10 * MB }),
    parent({ userId: 'p3', name: 'An Le', createdAt: '2026-11-02T00:00:00Z' }),
  ]);
  h.listAllChildren.mockResolvedValue([
    kid(),
    kid({ id: 'c2', parent_id: 'p2', child_name: 'nam', display_name: 'Nam', gender: 'male', parent_name: 'Bao Tran', parent_banned: true }),
  ]);
  h.storageUsedBy.mockResolvedValue({ p1: 12 * MB, p2: 9 * MB, p3: 0 });
  h.pendingSenders.mockResolvedValue(new Set(['p2']));
  h.createAccount.mockResolvedValue('p9');
});
afterEach(cleanup);

const rows = () => screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/admin/parents/')).map((a) => a.textContent);

describe('Parents page (N10)', () => {
  it('lists each parent with initials, storage bar and child count', async () => {
    render(<ParentsPage />);
    expect(await screen.findByText('Lan Nguyen')).toBeTruthy();
    expect(screen.getByText('LN')).toBeTruthy();
    expect(screen.getByText('12 / 50 MB')).toBeTruthy();
    expect(screen.getAllByText('Children: 1')).toHaveLength(2); // Lan and Bao
    expect(screen.getByText('Children: 0')).toBeTruthy(); // An Le
  });

  it('sorts newest first by default and A to Z on request', async () => {
    render(<ParentsPage />);
    await screen.findByText('Lan Nguyen');
    expect(rows()).toEqual(['Bao Tran', 'An Le', 'Lan Nguyen']);
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort' }), { target: { value: 'az' } });
    expect(rows()).toEqual(['An Le', 'Bao Tran', 'Lan Nguyen']);
  });

  it('searches by parent name and by a child name, accents ignored', async () => {
    render(<ParentsPage />);
    await screen.findByText('Lan Nguyen');
    const search = screen.getByRole('searchbox');
    fireEvent.change(search, { target: { value: 'an le' } });
    expect(rows()).toEqual(['An Le']);
    fireEvent.change(search, { target: { value: 'NAM' } });
    expect(rows()).toEqual(['Bao Tran']);
    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(screen.getByText('No parents match.')).toBeTruthy();
  });

  it('a banned parent shows a red Ban tag', async () => {
    render(<ParentsPage />);
    const bao = (await screen.findByText('Bao Tran')).closest('div')!.parentElement!;
    expect(within(bao).getByText('Ban')).toBeTruthy();
    expect(within(screen.getByText('Lan Nguyen').closest('div')!.parentElement!).queryByText('Ban')).toBeNull();
  });
});

describe('Parents page messages (N12)', () => {
  it('shows a red dot on parents with pending messages, and the toggle filters to them', async () => {
    render(<ParentsPage />);
    await screen.findByText('Lan Nguyen');
    expect(screen.getByText('Pending messages')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Messages' }));
    expect(rows()).toEqual(['Bao Tran']);
    expect(screen.getByRole('button', { name: 'Messages' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Messages' }));
    expect(rows()).toHaveLength(3);
  });
});

describe('Parents page expand (N11)', () => {
  it('Expand all shows each parent children as read-only cards, Collapse all hides them', async () => {
    render(<ParentsPage />);
    await screen.findByText('Lan Nguyen');
    expect(screen.queryByText('Mia')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.getByText('Mia')).toBeTruthy();
    expect(screen.getByText('Nam')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit Mia' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(screen.queryByText('Mia')).toBeNull();
  });

  it('a single chevron expands one parent and sets aria-expanded', async () => {
    render(<ParentsPage />);
    await screen.findByText('Lan Nguyen');
    const chev = screen.getByRole('button', { name: 'Expand Lan Nguyen' });
    expect(chev.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(chev);
    expect(screen.getByRole('button', { name: 'Collapse Lan Nguyen' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Mia')).toBeTruthy();
    expect(screen.queryByText('Nam')).toBeNull();
  });
});

describe('Parents page create (N13)', () => {
  it('creates a parent in a dialog and opens the new parent detail', async () => {
    render(<ParentsPage />);
    await screen.findByText('Lan Nguyen');
    fireEvent.click(screen.getByRole('button', { name: 'Create parent' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Mai' } });
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'mai@test.local' } });
    fireEvent.change(within(dialog).getByLabelText(/Password/), { target: { value: 'secret123' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create parent' }));
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/admin/parents/p9'));
    expect(h.createAccount).toHaveBeenCalledWith({ role: 'parent', email: 'mai@test.local', password: 'secret123', displayName: 'Mai' });
  });

  it('shows the server message and stays open when creation fails', async () => {
    h.createAccount.mockRejectedValue(new Error('That email is already used.'));
    render(<ParentsPage />);
    await screen.findByText('Lan Nguyen');
    fireEvent.click(screen.getByRole('button', { name: 'Create parent' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Mai' } });
    fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'mai@test.local' } });
    fireEvent.change(within(dialog).getByLabelText(/Password/), { target: { value: 'secret123' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create parent' }));
    expect(await within(dialog).findByText('That email is already used.')).toBeTruthy();
    expect(h.push).not.toHaveBeenCalled();
  });
});
