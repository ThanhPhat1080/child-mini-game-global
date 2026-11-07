import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MessageList } from '@/components/admin/MessageList';

afterEach(cleanup);

const base = { id: '1', createdAt: '2026-11-07T09:00:00Z' };

describe('MessageList (IN6, IN7)', () => {
  it('shows the empty text when there are no messages', () => {
    render(<MessageList messages={[]} />);
    expect(screen.getByText('No messages yet. Write to the Super Admin above whenever you need help.')).toBeTruthy();
  });

  it('shows one status label per message', () => {
    render(
      <MessageList
        messages={[
          { ...base, id: 'a', body: 'Sent one', readAt: null, resolvedAt: null },
          { ...base, id: 'b', body: 'Read one', readAt: '2026-11-07T10:00:00Z', resolvedAt: null },
          { ...base, id: 'c', body: 'Done one', readAt: '2026-11-07T10:00:00Z', resolvedAt: '2026-11-07T11:00:00Z' },
        ].map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt, readAt: m.readAt, resolvedAt: m.resolvedAt }))}
      />,
    );
    expect(screen.getByText('Sent one').closest('li')?.textContent).toContain('Sent');
    expect(screen.getByText('Read one').closest('li')?.textContent).toContain('Read');
    expect(screen.getByText('Done one').closest('li')?.textContent).toContain('Resolved');
  });

  it('shows the heading "Your messages"', () => {
    render(<MessageList messages={[]} />);
    expect(screen.getByRole('heading', { name: 'Your messages' })).toBeTruthy();
  });
});
