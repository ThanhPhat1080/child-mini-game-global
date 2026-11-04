import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ getMyProfile: vi.fn(), insert: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({ from: () => ({ insert: h.insert }), auth: { signOut: vi.fn() } }),
}));
vi.mock('@/lib/auth/roles', () => ({ getMyProfile: h.getMyProfile }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import SuspendedPage from '@/app/admin/suspended/page';

beforeEach(() => {
  h.getMyProfile.mockReset().mockResolvedValue({
    role: 'parent', banned: true, ban_reason_code: 'sexual', ban_note: 'Adult photo on card 4', banned_at: '2026-11-03T08:00:00Z',
  });
  h.insert.mockReset().mockResolvedValue({ error: null });
});
afterEach(cleanup);

describe('suspended page (U15, U17)', () => {
  it('shows the reason label, the note and the date', async () => {
    render(<SuspendedPage />);
    expect(await screen.findByText('Nội dung tình dục hoặc người lớn')).toBeTruthy();
    expect(screen.getByText(/Adult photo on card 4/)).toBeTruthy();
    expect(screen.getByText(/3 November 2026/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
  });

  it('sends a message to the Super Admin and clears the box', async () => {
    render(<SuspendedPage />);
    await screen.findByText(/Adult photo/);
    const box = screen.getByLabelText('Contact the Super Admin') as HTMLTextAreaElement;
    const send = screen.getByRole('button', { name: 'Send message' }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(box, { target: { value: '  I removed it, please unban  ' } });
    fireEvent.click(send);
    await waitFor(() => expect(h.insert).toHaveBeenCalledWith({ body: 'I removed it, please unban' }));
    expect((await screen.findByRole('status')).textContent).toMatch(/Message sent/);
    expect(box.value).toBe('');
  });

  it('turns the form off after the database says 5 a day were sent', async () => {
    h.insert.mockResolvedValue({ error: { message: 'rate_limited: at most 5 messages per day' } });
    render(<SuspendedPage />);
    await screen.findByText(/Adult photo/);
    const box = screen.getByLabelText('Contact the Super Admin') as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: 'again' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/5 messages a day/);
    expect(box.disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Send message' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a generic error for other failures and keeps the form on', async () => {
    h.insert.mockResolvedValue({ error: { message: 'network' } });
    render(<SuspendedPage />);
    await screen.findByText(/Adult photo/);
    const box = screen.getByLabelText('Contact the Super Admin') as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Could not send/);
    expect(box.disabled).toBe(false);
    expect(box.value).toBe('hello');
  });
});
