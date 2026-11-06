import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ listPeople: vi.fn(), createAccount: vi.fn() }));
vi.mock('@/lib/superAdmin', async (orig) => ({ ...(await orig<typeof import('@/lib/superAdmin')>()), ...h }));

import SuperAdminsPage from '@/app/admin/(super)/super/page';

const admin = (over: Record<string, unknown> = {}) => ({
  userId: 'sa1', role: 'super_admin', name: 'Phat', banned: false, banReasonCode: null, banNote: null, bannedAt: null,
  quotaBytes: 0, createdAt: '2026-11-01T10:00:00.000Z', ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  h.listPeople.mockResolvedValue([admin()]);
  h.createAccount.mockResolvedValue('new-id');
});
afterEach(cleanup);

describe('Super Admins page (hidden, view only except add)', () => {
  it('lists Super Admins with their creation date and no edit, ban or remove controls', async () => {
    render(<SuperAdminsPage />);
    const row = await screen.findByRole('listitem', { name: 'Super Admin Phat' });
    expect(within(row).getByText(/Added 01\/11\/2026/)).toBeTruthy();
    expect(within(row).queryByRole('button')).toBeNull();
    expect(h.listPeople).toHaveBeenCalledWith('super_admin');
  });

  it('adds a Super Admin with role super_admin and reloads the list', async () => {
    render(<SuperAdminsPage />);
    await screen.findByRole('listitem', { name: 'Super Admin Phat' });
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Second' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'second@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'longenough1' } });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    await waitFor(() => expect(h.createAccount).toHaveBeenCalledWith({
      role: 'super_admin', email: 'second@example.com', password: 'longenough1', displayName: 'Second',
    }));
    await waitFor(() => expect(h.listPeople).toHaveBeenCalledTimes(2));
  });

  it('shows an empty note when there are no Super Admins', async () => {
    h.listPeople.mockResolvedValue([]);
    render(<SuperAdminsPage />);
    expect(await screen.findByText('No Super Admins yet.')).toBeTruthy();
  });
});
