import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  move: vi.fn(),
  failTable: '' as string,
}));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    from: (table: string) => ({
      select: () => Promise.resolve({ data: db.rows[table] ?? [], error: null }),
      update: (patch: Record<string, unknown>) => ({
        eq: (col: string, val: unknown) => {
          if (db.failTable === table) return Object.assign(Promise.resolve({ data: null, error: { message: 'db down' } }), { select: () => Promise.resolve({ data: null, error: { message: 'db down' } }) });
          const hit = (db.rows[table] ?? []).filter((r) => r[col] === val);
          for (const r of hit) Object.assign(r, patch);
          const done = { data: hit, error: null };
          return Object.assign(Promise.resolve(done), { select: () => Promise.resolve(done) });
        },
      }),
    }),
    storage: { from: () => ({ move: db.move }) },
  }),
}));

import { renameMedia } from '@/lib/media/rename';
import { announceRename, useMediaRenamed } from '@/lib/media/renames';
import { renderHook } from '@testing-library/react';

const FROM = 'library/oh-ring-9j2k4m1a7b3cx.mp3';
const TO = 'library/Bell-9j2k4m1a7b3cx.mp3';

beforeEach(() => {
  db.rows = { settings: [{ greeting_path: FROM }], memory_cards: [{ audio_path: FROM }, { audio_path: 'x.mp3' }], find_levels: [{ id: '1', objects: [{ audio_path: FROM }] }] };
  db.failTable = '';
  db.move.mockReset().mockResolvedValue({ error: null });
});

describe('renameMedia', () => {
  it('moves the file and points every record at the new path', async () => {
    const seen = vi.fn();
    renderHook(() => useMediaRenamed(seen));
    await expect(renameMedia(FROM, 'Bell')).resolves.toBe(TO);
    expect(db.move).toHaveBeenCalledWith(FROM, TO);
    expect(db.rows.settings[0].greeting_path).toBe(TO);
    expect(db.rows.memory_cards.map((r) => r.audio_path)).toEqual([TO, 'x.mp3']);
    expect(db.rows.find_levels[0].objects).toEqual([{ audio_path: TO }]);
    expect(seen).toHaveBeenCalledWith(FROM, TO);
  });

  it('puts everything back and reports the error when a record cannot be updated', async () => {
    db.failTable = 'memory_cards';
    await expect(renameMedia(FROM, 'Bell')).rejects.toThrow('db down');
    expect(db.move).toHaveBeenLastCalledWith(TO, FROM);
    expect(db.rows.settings[0].greeting_path).toBe(FROM);
  });

  it('says so when the name is taken', async () => {
    db.move.mockResolvedValue({ error: { message: 'The resource already exists' } });
    await expect(renameMedia(FROM, 'Bell')).rejects.toThrow('A file with that name already exists.');
  });

  it('does nothing when the name did not change', async () => {
    await expect(renameMedia(FROM, 'oh-ring')).resolves.toBe(FROM);
    expect(db.move).not.toHaveBeenCalled();
  });
});

void announceRename;
