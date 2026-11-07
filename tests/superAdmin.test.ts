import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ rpc: vi.fn(), update: vi.fn(), eq: vi.fn(), from: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({ rpc: h.rpc, from: (t: string) => (h.from(t) ?? { update: h.update }) }),
}));

import { approveItem, banParent, createAccount, deleteItem, listAllChildren, listContent, listPeople, markMessage, pendingMessageCount, pendingSenders, removeChild, rejectItem, setQuota, unbanParent, unpublishItem } from '@/lib/superAdmin';

beforeEach(() => {
  h.rpc.mockReset().mockResolvedValue({ error: null });
  h.eq.mockReset().mockResolvedValue({ error: null });
  h.update.mockReset().mockReturnValue({ eq: h.eq });
  h.from.mockReset().mockReturnValue(undefined);
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

describe('Super Admin children (K13)', () => {
  const kids = [
    { id: 'c1', display_name: 'Mia', child_name: 'mia', parent_id: 'p1', gender: 'female', age_band: '2-5', pin: 'ab12', avatar_path: null, created_at: '2026-11-01T00:00:00Z' },
    { id: 'c2', display_name: 'Bao', child_name: 'bao', parent_id: 'p2', gender: 'male', age_band: '5-10', pin: 'cd34', avatar_path: null, created_at: '2026-11-02T00:00:00Z' },
    { id: 'c3', display_name: 'Nam', child_name: 'nam', parent_id: 'p1', gender: 'male', age_band: '2-5', pin: 'ef56', avatar_path: null, created_at: '2026-11-03T00:00:00Z' },
  ];
  function childrenThenProfiles(profiles: { data: unknown; error: unknown }) {
    const inFn = vi.fn().mockResolvedValue(profiles);
    const order = vi.fn().mockResolvedValue({ data: kids, error: null });
    h.from.mockImplementation((t: string) =>
      t === 'children' ? { select: () => ({ order }) } : { select: () => ({ in: inFn }) },
    );
    return { inFn };
  }

  it('listAllChildren reads children, then the distinct parents, and joins the names and ban state', async () => {
    const { inFn } = childrenThenProfiles({ data: [{ user_id: 'p1', display_name: 'Lan', banned: true }], error: null });
    const list = await listAllChildren();
    expect(inFn).toHaveBeenCalledWith('user_id', ['p1', 'p2']);
    expect(list.map((c) => [c.id, c.parent_name, c.parent_banned])).toEqual([
      ['c1', 'Lan', true],
      ['c2', null, false],
      ['c3', 'Lan', true],
    ]);
    expect(list[0]).toMatchObject({ display_name: 'Mia', child_name: 'mia', parent_id: 'p1', gender: 'female', pin: 'ab12', created_at: '2026-11-01T00:00:00Z' });
  });

  it('listAllChildren keeps the list when the parent names fail to load', async () => {
    childrenThenProfiles({ data: null, error: { message: 'boom' } });
    const list = await listAllChildren();
    expect(list).toHaveLength(3);
    expect(list.every((c) => c.parent_name === null && c.parent_banned === false)).toBe(true);
  });

  it('listAllChildren throws when the children read fails', async () => {
    h.from.mockReturnValue({ select: () => ({ order: vi.fn().mockResolvedValue({ data: null, error: { message: 'raw db text' } }) }) });
    await expect(listAllChildren()).rejects.toThrow();
  });

  it('removeChild deletes by id, and hides raw database text on failure', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    h.from.mockReturnValue({ delete: () => ({ eq }) });
    await removeChild('c1');
    expect(h.from).toHaveBeenCalledWith('children');
    expect(eq).toHaveBeenCalledWith('id', 'c1');
    eq.mockResolvedValue({ error: { message: 'permission denied for table children' } });
    await expect(removeChild('c1')).rejects.toThrow(/Could not remove/);
    await expect(removeChild('c1')).rejects.not.toThrow(/permission denied/);
  });
});


describe('Super Admin people reads (N10, N11, N17)', () => {
  it('listPeople returns createdAt for each person', async () => {
    h.from.mockReturnValue({
      select: () => ({ eq: () => ({ order: async () => ({ data: [{ user_id: 'p1', role: 'parent', display_name: 'Lan', banned: false, ban_reason_code: null, ban_note: null, banned_at: null, quota_bytes: 0, created_at: '2026-11-01T00:00:00Z' }], error: null }) }) }),
    });
    const [p] = await listPeople('parent');
    expect(p.createdAt).toBe('2026-11-01T00:00:00Z');
  });

  it('listContent filters by owner when asked, and by visibility too', async () => {
    const eq = vi.fn();
    const chain = { eq, order: vi.fn().mockResolvedValue({ data: [], error: null }) };
    eq.mockReturnValue(chain);
    h.from.mockReturnValue({ select: () => chain });
    await listContent(undefined, { ownerId: 'p1' });
    expect(eq).toHaveBeenCalledWith('owner_id', 'p1');
    eq.mockClear();
    await listContent('pending', { ownerId: 'p1' });
    expect(eq.mock.calls.slice(0, 2)).toEqual([['visibility', 'pending'], ['owner_id', 'p1']]); // first table
  });

  it('listContent without an owner does not filter by owner', async () => {
    const eq = vi.fn();
    const chain = { eq, order: vi.fn().mockResolvedValue({ data: [], error: null }) };
    h.from.mockReturnValue({ select: () => chain });
    await listContent();
    expect(eq).not.toHaveBeenCalled();
  });

  it('pendingMessageCount counts unresolved messages with a head count', async () => {
    const is = vi.fn().mockResolvedValue({ count: 3, error: null });
    const select = vi.fn(() => ({ is }));
    h.from.mockReturnValue({ select });
    expect(await pendingMessageCount()).toBe(3);
    expect(h.from).toHaveBeenCalledWith('support_messages');
    expect(select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(is).toHaveBeenCalledWith('resolved_at', null);
  });

  it('pendingSenders returns the set of parents with an unresolved message', async () => {
    const is = vi.fn().mockResolvedValue({ data: [{ from_user: 'p1' }, { from_user: 'p1' }, { from_user: 'p2' }], error: null });
    h.from.mockReturnValue({ select: () => ({ is }) });
    expect([...(await pendingSenders())].sort()).toEqual(['p1', 'p2']);
    expect(is).toHaveBeenCalledWith('resolved_at', null);
  });
});
