import { describe, expect, it, vi } from 'vitest';
import { listMyMessages, messageStatus, sentToday } from '@/lib/inbox';

describe('messageStatus (IN6)', () => {
  it('resolved wins over read, read over sent', () => {
    expect(messageStatus({ readAt: 'x', resolvedAt: 'y' })).toBe('resolved');
    expect(messageStatus({ readAt: 'x', resolvedAt: null })).toBe('read');
    expect(messageStatus({ readAt: null, resolvedAt: null })).toBe('sent');
  });
});

describe('sentToday (IN4)', () => {
  it('counts messages in the last 24 hours', () => {
    const now = new Date('2026-11-07T12:00:00Z');
    expect(sentToday([{ createdAt: '2026-11-07T11:00:00Z' }, { createdAt: '2026-11-05T11:00:00Z' }], now)).toBe(1);
  });
});

describe('listMyMessages (IN8)', () => {
  it('asks the database for newest first and maps the rows', async () => {
    const rows = [
      { id: 'b', body: 'New', created_at: '2026-11-07T09:00:00Z', read_at: '2026-11-07T10:00:00Z', resolved_at: null },
      { id: 'a', body: 'Old', created_at: '2026-11-05T09:00:00Z', read_at: null, resolved_at: null },
    ];
    const order = vi.fn(async () => ({ data: rows, error: null }));
    const client = {
      from: () => ({ select: () => ({ order }) }),
    } as never;
    const list = await listMyMessages(client);
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(list.map((m) => m.id)).toEqual(['b', 'a']);
    expect(list[0]).toEqual({ id: 'b', body: 'New', createdAt: '2026-11-07T09:00:00Z', readAt: '2026-11-07T10:00:00Z', resolvedAt: null });
  });
});
