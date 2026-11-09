// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';

// GT4 / GU12: in visitor mode the play hooks use a synthetic child and never touch the database.
const h = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    from: (...args: unknown[]) => {
      h.from(...args);
      throw new Error('database must not be used by a visitor');
    },
  }),
}));

import { saveVisitor, clearVisitor, VISITOR_HEAD } from '@/lib/visitor';
import { getMyChildSettings } from '@/lib/settings';
import { fetchCelebrationPictures } from '@/lib/celebration';
import { playerId } from '@/lib/review';
import { useActiveChild } from '@/lib/useActiveChild';

beforeEach(() => {
  h.from.mockClear();
  localStorage.clear();
  clearVisitor();
  saveVisitor({ name: 'Mai', gender: 'female', ageBand: '2-5' });
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  clearVisitor();
});

describe('visitor plays as the active child (GU12)', () => {
  it('getMyChildSettings returns a synthetic child with the visitor name and gender, no database call', async () => {
    const s = await getMyChildSettings();
    expect(s).toMatchObject({
      child_id: 'visitor',
      greeting_path: null,
      music_path: null,
      music_volume: 30,
      hooray_path: null,
      ohoh_path: null,
      complete_path: null,
      child_name: 'Mai',
      avatar_path: null,
      gender: 'female',
    });
    expect(h.from).not.toHaveBeenCalled();
  });

  it('useActiveChild is ready with the head picture of the visitor gender', async () => {
    const { result } = renderHook(() => useActiveChild());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ name: 'Mai', avatarUrl: VISITOR_HEAD.female, gender: 'female' });
    expect(h.from).not.toHaveBeenCalled();
  });

  it('fetchCelebrationPictures gives no uploads and the visitor gender', async () => {
    await expect(fetchCelebrationPictures()).resolves.toEqual({ a: null, b: null, gender: 'female' });
    expect(h.from).not.toHaveBeenCalled();
  });

  it('playerId is null so only global rows are listed', async () => {
    await expect(playerId()).resolves.toBeNull();
    expect(h.from).not.toHaveBeenCalled();
  });

  it('a boy visitor gets the prince head', async () => {
    clearVisitor();
    saveVisitor({ name: 'Leo', gender: 'male', ageBand: '5-10' });
    const { result } = renderHook(() => useActiveChild());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ name: 'Leo', avatarUrl: VISITOR_HEAD.male, gender: 'male' });
  });
});
