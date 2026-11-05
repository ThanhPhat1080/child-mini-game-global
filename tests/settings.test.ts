import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  getSession: vi.fn(),
  maybeSingle: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  from: vi.fn(),
  activeId: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({ auth: { getSession: h.getSession }, from: h.from }),
}));
vi.mock('@/lib/childSession', () => ({ getActiveChildId: () => h.activeId() }));

import { getChildSettings, getMyChildSettings, updateChildSettings } from '@/lib/settings';

const row = { child_id: 'c1', music_volume: 30 };
const kid = { display_name: 'Mia', avatar_path: 'img/a.png' };

beforeEach(() => {
  vi.resetAllMocks();
  h.from.mockReturnValue({ select: h.select, update: h.update });
  h.select.mockReturnValue({ eq: h.eq });
  h.eq.mockReturnValue({ maybeSingle: h.maybeSingle });
  h.activeId.mockReturnValue('c1');
  h.maybeSingle.mockImplementation(() => Promise.resolve({ data: h.from.mock.calls.at(-1)?.[0] === 'children' ? kid : row, error: null }));
});

describe('child settings (U4)', () => {
  it('getMyChildSettings merges display_name and avatar_path from children', async () => {
    await expect(getMyChildSettings()).resolves.toEqual({ ...row, child_name: 'Mia', avatar_path: 'img/a.png' });
    expect(h.from).toHaveBeenCalledWith('child_settings');
    expect(h.from).toHaveBeenCalledWith('children');
    expect(h.eq).toHaveBeenCalledWith('child_id', 'c1');
    expect(h.eq).toHaveBeenCalledWith('id', 'c1');
  });

  it('getMyChildSettings returns null without an active child', async () => {
    h.activeId.mockReturnValue(null);
    await expect(getMyChildSettings()).resolves.toBeNull();
    expect(h.from).not.toHaveBeenCalled();
  });

  it('getMyChildSettings returns null when the child row is not visible', async () => {
    h.maybeSingle.mockImplementation(() => Promise.resolve({ data: null, error: null }));
    await expect(getMyChildSettings()).resolves.toBeNull();
  });

  it('getChildSettings reads the given child and returns null for no row', async () => {
    h.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(getChildSettings('c9')).resolves.toBeNull();
    expect(h.eq).toHaveBeenCalledWith('child_id', 'c9');
  });

  it('throws on a query error', async () => {
    h.maybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(getChildSettings('c1')).rejects.toThrow('boom');
  });

  it('updateChildSettings updates by child id and never sends child_id in the patch', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    h.update.mockReturnValue({ eq });
    await updateChildSettings('c1', { music_volume: 7, child_id: 'zzz', child_name: 'Lan' } as never);
    expect(h.update).toHaveBeenCalledWith({ music_volume: 7 });
    expect(eq).toHaveBeenCalledWith('child_id', 'c1');
  });

  it('updateChildSettings throws on error', async () => {
    h.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: { message: 'denied' } }) });
    await expect(updateChildSettings('c1', { music_volume: 5 })).rejects.toThrow('denied');
  });
});
