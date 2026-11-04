import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  getSession: vi.fn(),
  maybeSingle: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({ auth: { getSession: h.getSession }, from: h.from }),
}));

import { getChildSettings, getMyChildSettings, updateChildSettings } from '@/lib/settings';

const row = { child_id: 'c1', child_name: 'Mia', music_volume: 30 };

beforeEach(() => {
  vi.resetAllMocks();
  h.from.mockReturnValue({ select: h.select, update: h.update });
  h.select.mockReturnValue({ eq: h.eq });
  h.eq.mockReturnValue({ maybeSingle: h.maybeSingle });
  h.getSession.mockResolvedValue({ data: { session: { user: { id: 'c1' } } } });
  h.maybeSingle.mockResolvedValue({ data: row, error: null });
});

describe('child settings (U4)', () => {
  it('getMyChildSettings returns the row for the signed-in child', async () => {
    await expect(getMyChildSettings()).resolves.toEqual(row);
    expect(h.from).toHaveBeenCalledWith('child_settings');
    expect(h.eq).toHaveBeenCalledWith('child_id', 'c1');
  });

  it('getMyChildSettings returns null when nobody is signed in', async () => {
    h.getSession.mockResolvedValue({ data: { session: null } });
    await expect(getMyChildSettings()).resolves.toBeNull();
    expect(h.from).not.toHaveBeenCalled();
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
    await updateChildSettings('c1', { child_name: 'Lan', child_id: 'zzz' });
    expect(h.update).toHaveBeenCalledWith({ child_name: 'Lan' });
    expect(eq).toHaveBeenCalledWith('child_id', 'c1');
  });

  it('updateChildSettings throws on error', async () => {
    h.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: { message: 'denied' } }) });
    await expect(updateChildSettings('c1', { music_volume: 5 })).rejects.toThrow('denied');
  });
});
