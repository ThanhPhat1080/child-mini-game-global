import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ rpc: vi.fn(), update: vi.fn(), eq: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({ rpc: h.rpc, from: () => ({ update: h.update }) }),
}));

import { approveItem, banParent, createAccount, deleteItem, markMessage, rejectItem, setQuota, unbanParent, unpublishItem } from '@/lib/superAdmin';

beforeEach(() => {
  h.rpc.mockReset().mockResolvedValue({ error: null });
  h.eq.mockReset().mockResolvedValue({ error: null });
  h.update.mockReset().mockReturnValue({ eq: h.eq });
});

describe('Super Admin database calls', () => {
  it('calls the review functions with the right names and arguments', async () => {
    await approveItem('quiz_sets', 'a');
    await rejectItem('memory_cards', 'b', 'blurry');
    await unpublishItem('spot_levels', 'c');
    await deleteItem('find_levels', 'd');
    expect(h.rpc.mock.calls).toEqual([
      ['review_approve', { p_table: 'quiz_sets', p_id: 'a' }],
      ['review_reject', { p_table: 'memory_cards', p_id: 'b', p_note: 'blurry' }],
      ['unpublish_item', { p_table: 'spot_levels', p_id: 'c' }],
      ['delete_item', { p_table: 'find_levels', p_id: 'd' }],
    ]);
  });

  it('calls ban_parent, unban_parent and set_quota', async () => {
    await banParent('u1', 'sexual', 'note');
    await banParent('u1', 'other', '');
    await unbanParent('u1');
    await setQuota('u1', 1000);
    expect(h.rpc.mock.calls).toEqual([
      ['ban_parent', { p_user: 'u1', p_code: 'sexual', p_note: 'note' }],
      ['ban_parent', { p_user: 'u1', p_code: 'other', p_note: null }],
      ['unban_parent', { p_user: 'u1' }],
      ['set_quota', { p_user: 'u1', p_bytes: 1000 }],
    ]);
  });

  it('throws the database message', async () => {
    h.rpc.mockResolvedValue({ error: { message: 'note_required: a rejection needs a reason' } });
    await expect(rejectItem('quiz_sets', 'a', ' ')).rejects.toThrow('note_required');
  });

  it('markMessage sets read_at, and resolving also reads', async () => {
    await markMessage('m1', { read: true });
    expect(h.update.mock.calls[0][0]).toEqual({ read_at: expect.any(String) });
    await markMessage('m1', { resolved: true });
    expect(h.update.mock.calls[1][0]).toEqual({ resolved_at: expect.any(String), read_at: expect.any(String) });
    await markMessage('m1', { resolved: false });
    expect(h.update.mock.calls[2][0]).toEqual({ resolved_at: null });
    expect(h.eq).toHaveBeenCalledWith('id', 'm1');
  });

  it('createAccount posts to /api/users and maps errors to readable text', async () => {
    const ok = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ userId: 'u9' }) });
    await expect(createAccount({ role: 'parent', email: 'a@b.co', password: 'secret123', displayName: 'A' }, ok as unknown as typeof fetch)).resolves.toBe('u9');
    expect(ok).toHaveBeenCalledWith('/api/users', expect.objectContaining({ method: 'POST' }));
    const bad = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'email_taken' }) });
    await expect(createAccount({ role: 'parent', email: 'a@b.co', password: 'secret123', displayName: 'A' }, bad as unknown as typeof fetch)).rejects.toThrow('That email is already used.');
  });
});
