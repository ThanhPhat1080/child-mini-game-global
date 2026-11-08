import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// SA2, SA3: the Super Admin sees a parent's email and phone next to each message, and the messages still show
// when the contact details cannot be read.

const h = vi.hoisted(() => ({ listMessages: vi.fn(), listPeople: vi.fn(), markMessage: vi.fn(), listParentContacts: vi.fn() }));
vi.mock('@/lib/superAdmin', async (orig) => ({
  ...(await orig<typeof import('@/lib/superAdmin')>()),
  listMessages: h.listMessages,
  listPeople: h.listPeople,
  markMessage: h.markMessage,
  listParentContacts: h.listParentContacts,
}));

import MessagesPage from '@/app/admin/(super)/messages/page';

const msg = { id: 'm1', fromUser: 'p1', body: 'The sound is loud', createdAt: '2026-11-07T09:00:00Z', readAt: null, resolvedAt: null };
const lan = { userId: 'p1', displayName: 'Lan', email: 'lan@test.local', phone: '+84 912 345 678' };

beforeEach(() => {
  h.listMessages.mockReset().mockResolvedValue([msg]);
  h.listPeople.mockReset().mockResolvedValue([{ userId: 'p1', role: 'parent', name: 'Lan', banned: false, banReasonCode: null, banNote: null, bannedAt: null, quotaBytes: 0, createdAt: '2026-11-01T00:00:00Z' }]);
  h.markMessage.mockReset();
  h.listParentContacts.mockReset().mockResolvedValue([lan]);
});
afterEach(cleanup);

describe('Messages contacts (SA2, SA3)', () => {
  it('shows the email as a mailto link and the phone as a tel link beside the message', async () => {
    render(<MessagesPage />);
    expect(await screen.findByText('The sound is loud')).toBeTruthy();
    const mail = await screen.findByRole('link', { name: 'lan@test.local' });
    expect(mail.getAttribute('href')).toBe('mailto:lan@test.local');
    const tel = screen.getByRole('link', { name: '+84 912 345 678' });
    expect(tel.getAttribute('href')).toBe('tel:+84 912 345 678');
  });

  it('says so when the parent has no phone number', async () => {
    h.listParentContacts.mockResolvedValue([{ ...lan, phone: null }]);
    render(<MessagesPage />);
    expect(await screen.findByText('No phone number')).toBeTruthy();
  });

  it('keeps the messages and shows a note when the contact details cannot be read', async () => {
    h.listParentContacts.mockRejectedValue(new Error('forbidden'));
    render(<MessagesPage />);
    expect(await screen.findByText('The sound is loud')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Contact details are not available right now.')).toBeTruthy());
  });
});
