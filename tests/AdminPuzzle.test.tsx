import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EPicture } from '@/lib/pairs/adminPictures';

const h = vi.hoisted(() => ({
  loadPictures: vi.fn(),
  savePictures: vi.fn(),
  sayWord: vi.fn(),
  listLibrary: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    from: () => { throw new Error('the page must not touch the database directly'); },
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

  it('a failed load shows the error', async () => {
    h.loadPictures.mockRejectedValue(new Error('offline'));
    render(<PuzzlePage />);
    expect((await screen.findByRole('alert')).textContent).toBe('offline');
  });
});
