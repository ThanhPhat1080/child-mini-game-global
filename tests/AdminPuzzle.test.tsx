import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EPicture } from '@/lib/pairs/adminPictures';

const h = vi.hoisted(() => ({
  loadPictures: vi.fn(),
  savePictures: vi.fn(),
  sayWord: vi.fn(),
  listLibrary: vi.fn(),
  /** the table client used by the real helpers in the partial-failure tests; throws by default */
  from: vi.fn(),
  /** the rows of the fake table, and whether its updates fail */
  rows: [] as Record<string, unknown>[],
  failUpdate: false,
}));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    from: (table: string) => h.from(table),
    storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn.test/${p}` } }) }) },
  }),
}));
vi.mock('@/lib/pairs/adminPictures', async (orig) => ({
  ...(await orig<typeof import('@/lib/pairs/adminPictures')>()),
  loadPictures: h.loadPictures,
  savePictures: h.savePictures,
}));
vi.mock('@/lib/memory/cards', () => ({ sayWord: h.sayWord }));
vi.mock('@/lib/media/library', () => ({ listLibrary: h.listLibrary }));
vi.mock('@/lib/media', async (orig) => ({
  ...(await orig<typeof import('@/lib/media')>()),
  mediaUrl: (p: string | null) => (p ? `/media/${p}` : null),
}));

import PuzzlePage from '@/app/admin/(super)/puzzle/page';

const pic = (n: number, o: Partial<EPicture> = {}): EPicture => ({ id: `p${n}`, isNew: false, word: ['fish', 'house', 'triangle', 'apple'][n - 1] ?? `word${n}`, image: `seed/${n}.svg`, audio: null, active: true, ...o });
const SEEDS = [pic(1), pic(2), pic(3), pic(4)];

const word = (n: number) => screen.getByLabelText(`Word for picture ${n}`) as HTMLInputElement;
const wordOf = (n: number) => screen.queryByLabelText(`Word for picture ${n}`) as HTMLInputElement | null;
const sw = (n: number) => screen.getByRole('switch', { name: `Use picture ${n}` });
const saveBtn = () => screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
const chip = () => screen.getByText(/ on · /).textContent;

async function renderWith(list: EPicture[]) {
  h.loadPictures.mockResolvedValue(list);
  render(<PuzzlePage />);
  await screen.findByRole('button', { name: 'Add from Image Library' });
  await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull());
}

beforeEach(() => {
  h.loadPictures.mockReset();
  h.from.mockReset().mockImplementation(() => { throw new Error('the page must not touch the database directly'); });
  h.failUpdate = false;
  h.rows = [];
  h.savePictures.mockReset().mockResolvedValue({ error: null });
  h.sayWord.mockReset();
  h.listLibrary.mockReset().mockResolvedValue(['library/star.png', 'library/moon.png']);
});
afterEach(cleanup);

describe('Super Admin puzzle page (A32, A33)', () => {
  it('shows the heading, one row per picture with its picture, word, sound, On switch and Remove', async () => {
    await renderWith([pic(1), pic(2, { audio: 'library/meow.mp3', active: false })]);
    expect(screen.getByRole('heading', { name: 'Puzzle Pairs pictures' })).toBeTruthy();
    expect(word(1).value).toBe('fish');
    expect(word(2).value).toBe('house');
    expect(screen.getByText('Kid voice reads the word')).toBeTruthy();
    expect(screen.getByText('meow.mp3')).toBeTruthy();
    expect(sw(1).getAttribute('aria-checked')).toBe('true');
    expect(sw(2).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('button', { name: 'Remove picture 2' })).toBeTruthy();
  });

  it('a switch and Remove change the draft only: nothing is saved until Save', async () => {
    await renderWith(SEEDS);
    fireEvent.click(sw(2));
    expect(sw(2).getAttribute('aria-checked')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Remove picture 3' }));
    expect(word(3).value).toBe('apple'); // the row after the removed one moves up
    expect(wordOf(4)).toBeNull();
    expect(saveBtn().disabled).toBe(false);
    expect(h.savePictures).not.toHaveBeenCalled();
  });

  it('Add from Image Library adds one row per chosen picture with an empty word; Save waits for the word', async () => {
    await renderWith(SEEDS);
    fireEvent.click(screen.getByRole('button', { name: 'Add from Image Library' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Choose star.png' }));
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'OK' })).toBeNull());
    expect(word(5).value).toBe('');
    expect(saveBtn().disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Add from Image Library' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Choose moon.png' }));
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'OK' })).toBeNull());
    expect(word(6).value).toBe('');

    fireEvent.change(word(5), { target: { value: 'star' } });
    expect(saveBtn().disabled).toBe(true); // a row still has no word
    fireEvent.change(word(6), { target: { value: 'moon' } });
    expect(saveBtn().disabled).toBe(false);
  });

  it('the status chip reads "4 on · ready", then "3 on · needs at least 4" after a switch', async () => {
    await renderWith(SEEDS);
    expect(chip()).toBe('4 on · ready');
    fireEvent.click(sw(1));
    expect(chip()).toBe('3 on · needs at least 4');
  });

  it('a word used twice gets the duplicate warning on both rows, and Save is still allowed', async () => {
    await renderWith([pic(1), pic(2, { word: 'Fish ' })]);
    expect(screen.getAllByText('Another picture has the same word.')).toHaveLength(2);
    expect(saveBtn().disabled).toBe(true); // nothing changed yet
    fireEvent.change(word(2), { target: { value: 'Fish x' } });
    expect(screen.queryByText('Another picture has the same word.')).toBeNull();
    expect(saveBtn().disabled).toBe(false);
  });

  it('Save calls savePictures with the saved and the draft lists and shows "Saved."', async () => {
    await renderWith(SEEDS);
    fireEvent.click(sw(1));
    fireEvent.click(saveBtn());
    await screen.findByText('Saved.');
    expect(h.savePictures).toHaveBeenCalledTimes(1);
    const [saved, draft] = h.savePictures.mock.calls[0] as [EPicture[], EPicture[]];
    expect(saved[0].active).toBe(true);
    expect(draft[0]).toMatchObject({ id: 'p1', active: false });
    expect(saveBtn().disabled).toBe(true);
  });

  it('a save error shows the error message and keeps the draft', async () => {
    h.savePictures.mockResolvedValue({ error: 'Could not save: boom' });
    await renderWith(SEEDS);
    fireEvent.click(sw(1));
    fireEvent.click(saveBtn());
    expect((await screen.findByRole('alert')).textContent).toBe('Could not save: boom');
    expect(sw(1).getAttribute('aria-checked')).toBe('false');
    expect(saveBtn().disabled).toBe(false);
  });

  it('when the read-back after a failed save also fails, the draft and the error stay as they were', async () => {
    h.savePictures.mockResolvedValue({ error: 'Could not save: boom' });
    h.loadPictures.mockResolvedValueOnce(SEEDS).mockRejectedValueOnce(new Error('offline'));
    render(<PuzzlePage />);
    await screen.findByRole('button', { name: 'Add from Image Library' });
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull());
    fireEvent.click(sw(1));
    fireEvent.click(saveBtn());
    expect((await screen.findByRole('alert')).textContent).toBe('Could not save: boom');
    expect(sw(1).getAttribute('aria-checked')).toBe('false');
    expect(saveBtn().disabled).toBe(false);
  });

  it('a failed load shows the error', async () => {
    h.loadPictures.mockRejectedValue(new Error('offline'));
    render(<PuzzlePage />);
    expect((await screen.findByRole('alert')).textContent).toBe('offline');
  });
});

/** Stands in for the table: upserts by id, per-row updates (failing when `h.failUpdate`), deletes by id, reads in order. */
function useFakeTable(seed: EPicture[]) {
  h.rows = seed.map((p, i) => ({ id: p.id, word: p.word, image_path: p.image, audio_path: p.audio, active: p.active, sort_order: i, created_at: `2026-11-0${i + 1}` }));
  const ok = { error: null };
  h.from.mockImplementation((table: string) => {
    if (table !== 'puzzle_pictures') throw new Error(`unexpected table ${table}`);
    return {
      select: () => ({ order: () => ({ order: () => Promise.resolve({ data: h.rows.map((r) => ({ ...r })), error: null }) }) }),
      upsert: (rows: Record<string, unknown>[]) => {
        for (const r of rows) {
          const i = h.rows.findIndex((x) => x.id === r.id);
          if (i >= 0) h.rows[i] = { ...h.rows[i], ...r };
          else h.rows.push({ ...r, created_at: '2026-11-09' });
        }
        return Promise.resolve(ok);
      },
      update: (patch: Record<string, unknown>) => ({
        eq: (_col: string, id: string) => {
          if (h.failUpdate) return Promise.resolve({ error: { message: 'update failed' } });
          const i = h.rows.findIndex((x) => x.id === id);
          h.rows[i] = { ...h.rows[i], ...patch };
          return Promise.resolve(ok);
        },
      }),
      delete: () => ({ in: (_col: string, ids: string[]) => { h.rows = h.rows.filter((r) => !ids.includes(r.id as string)); return Promise.resolve(ok); } }),
    };
  });
}

/**
 * Starts from the four seeds, adds the star picture, switches fish off and removes apple, then Save fails on the
 * fish update. The insert and the delete have already happened in the table by then.
 */
async function failedSave() {
  const actual = await vi.importActual<typeof import('@/lib/pairs/adminPictures')>('@/lib/pairs/adminPictures');
  h.loadPictures.mockImplementation(actual.loadPictures);
  h.savePictures.mockImplementation(actual.savePictures);
  useFakeTable(SEEDS);
  render(<PuzzlePage />);
  await screen.findByRole('button', { name: 'Add from Image Library' });
  await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull());

  fireEvent.click(screen.getByRole('button', { name: 'Add from Image Library' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Choose star.png' }));
  fireEvent.click(screen.getByRole('button', { name: 'OK' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'OK' })).toBeNull());
  fireEvent.change(word(5), { target: { value: 'star' } });
  fireEvent.click(sw(1));
  fireEvent.click(screen.getByRole('button', { name: 'Remove picture 4' }));

  h.failUpdate = true;
  fireEvent.click(saveBtn());
  expect((await screen.findByRole('alert')).textContent).toBe('update failed');
  h.failUpdate = false;
}

describe('a save that fails part way (A32)', () => {
  it('insert OK, update fails, then Save again: the retry saves once, with no duplicate-row error', async () => {
    await failedSave();
    // the table already holds the star row and no longer holds apple; fish is still on
    expect(h.rows.map((r) => r.word)).toEqual(['fish', 'house', 'triangle', 'star']);
    expect(h.rows.find((r) => r.word === 'fish')?.active).toBe(true);

    // the draft (fish off) is still there, so Save is enabled and the retry writes it
    expect(saveBtn().disabled).toBe(false);
    fireEvent.click(saveBtn());
    await screen.findByText('Saved.');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(h.rows.map((r) => r.word)).toEqual(['fish', 'house', 'triangle', 'star']);
    expect(h.rows.find((r) => r.word === 'fish')?.active).toBe(false);
    expect(h.rows.filter((r) => r.word === 'star')).toHaveLength(1);
    expect(saveBtn().disabled).toBe(true);
  });

  it('after the failed save, Revert restores the rows the database holds (apple stays gone, star is saved)', async () => {
    await failedSave();
    fireEvent.click(screen.getByRole('button', { name: 'Revert' }));
    expect(word(4).value).toBe('star');
    expect(screen.queryByLabelText('Word for picture 5')).toBeNull();
    expect(screen.queryByDisplayValue('apple')).toBeNull();
    expect(sw(1).getAttribute('aria-checked')).toBe('true');
    expect((screen.getByRole('button', { name: 'Revert' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

