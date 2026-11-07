import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// IN1-IN4, IN6: the parent's Inbox page and its highlight.

const h = vi.hoisted(() => ({ loadMyProfile: vi.fn(), listMyMessages: vi.fn() }));
vi.mock('@/lib/profile', () => ({ loadMyProfile: h.loadMyProfile }));
vi.mock('@/lib/inbox', async (orig) => ({ ...(await orig<typeof import('@/lib/inbox')>()), listMyMessages: h.listMyMessages }));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({ from: () => ({ insert: vi.fn() }) }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import InboxPage from '@/app/admin/(panel)/inbox/page';
import { InboxHighlight } from '@/components/admin/InboxHighlight';

const profile = (phone: string | null) => ({
  userId: 'p1', role: 'parent', displayName: 'Lan', phone, avatarPath: null, email: 'lan@test.local',
});
const msg = (id: string, minutesAgo: number, extra: Record<string, unknown> = {}) => ({
  id, body: `Message ${id}`, createdAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(), readAt: null, resolvedAt: null, ...extra,
});

beforeEach(() => {
  h.loadMyProfile.mockReset().mockResolvedValue(profile('+84 912 345 678'));
  h.listMyMessages.mockReset().mockResolvedValue([msg('a', 5), msg('b', 10), msg('c', 20), msg('d', 30, { readAt: '2026-11-07T00:00:00Z' })]);
});
afterEach(cleanup);

describe('InboxHighlight (IN2, IN3)', () => {
  it('explains that this is the feedback mailbox and that replies come by email or phone', () => {
    render(<InboxHighlight phone="+84 912 345 678" email="lan@test.local" />);
    expect(screen.getByText(/This is your feedback mailbox\. Tell the Super Admin about any problem or idea, big or small\./)).toBeTruthy();
    expect(screen.getByText(/by email or by phone\./)).toBeTruthy();
  });

  it('names the email and phone the Super Admin will use', () => {
    render(<InboxHighlight phone="+84 912 345 678" email="lan@test.local" />);
    expect(screen.getByText('Replies go to your email lan@test.local and your phone +84 912 345 678.')).toBeTruthy();
  });

  it('asks for a phone number, with a link to Profile, when there is none', () => {
    render(<InboxHighlight phone={null} email="lan@test.local" />);
    const link = screen.getByRole('link', { name: 'Add your phone number in Profile' });
    expect(link.getAttribute('href')).toBe('/admin/profile');
  });
});

describe('Inbox page (IN1, IN4, IN6)', () => {
  it('shows the highlight, the form and the statuses of the parent\'s messages', async () => {
    render(<InboxPage />);
    expect(await screen.findByRole('heading', { name: 'Inbox' })).toBeTruthy();
    expect(await screen.findByText('Message a')).toBeTruthy();
    expect(screen.getByText('Message d').closest('li')?.textContent).toContain('Read');
    expect(screen.getByRole('button', { name: 'Send message' })).toBeTruthy();
  });

  it('counts the messages of the last 24 hours: 4 of 5 today', async () => {
    render(<InboxPage />);
    expect(await screen.findByText('You have sent 4 of 5 messages today.')).toBeTruthy();
  });

  it('turns the form off when the day\'s 5 messages are used', async () => {
    h.listMyMessages.mockResolvedValue([msg('a', 1), msg('b', 2), msg('c', 3), msg('d', 4), msg('e', 5)]);
    render(<InboxPage />);
    await waitFor(() => expect((screen.getByLabelText('Contact the Super Admin') as HTMLTextAreaElement).disabled).toBe(true));
  });
});
