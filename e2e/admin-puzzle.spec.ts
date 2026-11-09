import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { ACCOUNTS, getState, reset, signInAsAdmin, signInAsSuper, STANDIN } from './support/fixtures';

// Puzzle Pairs pictures (A32, A33): the Super Admin's page. The parent gets the no-permission screen.

const STAR_FILE = 'star-9j2k4m1a7b3cx.svg';
/** The Super Admin's library folder: the picker lists the signed-in user's own files. */
const STAR_PATH = `${ACCOUNTS.super.id}/library/${STAR_FILE}`;

/** Puts a file straight into the stand-in bucket (as if an earlier upload had happened). */
async function putFile(path: string, body: string): Promise<void> {
  const fd = new FormData();
  fd.append('', new File([body], path.split('/').pop() ?? 'file.svg', { type: 'image/svg+xml' }));
  const res = await fetch(`${STANDIN}/storage/v1/object/media/${path}`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
}

const save = (page: Page) => page.getByRole('button', { name: 'Save', exact: true });
const chip = (page: Page, text: string) => page.getByRole('status').filter({ hasText: text });

test.beforeEach(async () => {
  await reset();
  await putFile(STAR_PATH, readFileSync('public/seed/star.svg', 'utf8'));
});

test('the Super Admin adds a library picture "star", saves it; then turns "fish" off and saves; the game deals only the saved pictures', async ({ page, browser }) => {
  await signInAsSuper(page);
  await page.getByRole('link', { name: 'Puzzle', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/puzzle$/);
  await expect(page.getByRole('heading', { name: 'Puzzle Pairs pictures' })).toBeVisible();

  // the four seed pictures, in the order the game uses, and the chip says the game is ready
  await expect(page.getByLabel('Word for picture 1', { exact: true })).toHaveValue('fish');
  await expect(page.getByLabel('Word for picture 4', { exact: true })).toHaveValue('apple');
  await expect(chip(page, '4 on · ready')).toBeVisible();

  // add the library picture: a new row at the end, with no word yet, so Save waits
  await page.getByRole('button', { name: 'Add from Image Library', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Image Library' });
  await library.getByRole('button', { name: `Choose ${STAR_FILE}` }).click();
  await library.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.getByLabel('Word for picture 5', { exact: true })).toHaveValue('');
  await expect(save(page)).toBeDisabled();

  await page.getByLabel('Word for picture 5', { exact: true }).fill('star');
  await expect(chip(page, '5 on · ready')).toBeVisible();
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  await expect(page.getByText('All changes saved.', { exact: true })).toBeVisible();
  await expect(page.getByText('Saved.', { exact: true })).toBeVisible();

  const star = (await getState()).puzzle_pictures.find((r) => r.word === 'star');
  expect(star).toMatchObject({ word: 'star', image_path: STAR_PATH, active: true, owner_id: ACCOUNTS.super.id });

  // turn "fish" off and save: its row goes inactive, the others stay
  await page.getByRole('switch', { name: 'Use picture 1', exact: true }).click();
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  await expect(page.getByText('All changes saved.', { exact: true })).toBeVisible();
  await expect.poll(async () => (await getState()).puzzle_pictures.find((r) => r.id === 'pp-fish')?.active).toBe(false);
  await expect(chip(page, '4 on · ready')).toBeVisible();
  expect((await getState()).puzzle_pictures.filter((r) => r.active).map((r) => r.word).sort()).toEqual(['apple', 'house', 'star', 'triangle']);

  // the saved pool reaches the game: a child's board deals exactly the halves of the active rows (star in, fish out)
  const rows = (await getState()).puzzle_pictures;
  const active = rows.filter((r) => r.active);
  const starId = rows.find((r) => r.word === 'star')!.id;
  const child = await browser.newContext({ storageState: 'e2e/.auth/child.json', baseURL: test.info().project.use.baseURL as string });
  try {
    const game = await child.newPage();
    await game.goto('/games/pairs');
    await expect(game.locator('[data-pairs-play]')).toHaveAttribute('data-phase', 'play');
    await expect(game.locator('[data-piece]')).toHaveCount(8);
    const ids = await game.locator('[data-piece]').evaluateAll((els) => els.map((e) => e.getAttribute('data-piece') ?? ''));
    expect([...ids].sort()).toEqual(active.flatMap((r) => [`${r.id}:L`, `${r.id}:R`]).sort());
    expect(ids).toContain(`${starId}:L`);
    expect(ids.some((id) => id.startsWith('pp-fish:'))).toBe(false);
  } finally {
    await child.close();
  }
});

test('a parent who opens /admin/puzzle gets the no-permission screen', async ({ page }) => {
  await signInAsAdmin(page);
  await page.goto('/admin/puzzle');
  await expect(page.getByRole('heading', { name: "You don't have permission" })).toBeVisible();
  await expect(page.getByText('This page is only for the Super Admin.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add from Image Library', exact: true })).toHaveCount(0);
});
