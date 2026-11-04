import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { getState, reset, signInAsAdmin, type FindLevelRow , ACCOUNTS } from './support/fixtures';

const PICTURE = 'public/seed/spot/garden-a.svg';

/** Pastes the picture's SVG code into one level's "Or paste SVG code" box and uses it (a local preview until Save). */
async function pasteFindPicture(page: Page, n: number) {
  const level = page.getByRole('article', { name: `Level ${n}`, exact: true });
  await level.locator('summary').first().click();
  await level.getByLabel(`SVG code for level ${n}`, { exact: true }).fill(readFileSync(PICTURE, 'utf8'));
  await level.getByRole('button', { name: `Use SVG for level ${n}`, exact: true }).click();
}

type ObjectRow = { x: number; y: number; r: number; word: string; audio_path: string | null };
type LevelRow = FindLevelRow & { objects: ObjectRow[] };
const levelsOf = async () => (await getState()).find_levels as unknown as LevelRow[];
const storage = async () => ((await getState()) as unknown as { storage: string[] }).storage;
const save = (page: Page) => page.getByRole('button', { name: 'Save' });
const saved = (page: Page) => page.getByRole('status').filter({ hasText: /^Saved$/ });
const article = (page: Page, n: number) => page.getByRole('article', { name: `Level ${n}` });
const picture = (page: Page, n: number) => article(page, n).getByRole('img', { name: 'Picture', exact: true });
const basename = (p: string) => p.split('/').pop() ?? p;

async function openFind(page: Page): Promise<void> {
  await page.goto('/admin/find');
  await expect(page.getByRole('button', { name: 'Add level' })).toBeVisible();
}

/** Clicks the picture of level `n` at fractions of its current box (wrapper click, as a real tap). */
async function clickPicture(page: Page, n: number, fx: number, fy: number): Promise<void> {
  const img = picture(page, n);
  await img.scrollIntoViewIfNeeded();
  await expect.poll(async () => (await img.boundingBox())?.width ?? 0).toBeGreaterThan(200); // wait for the picture to load
  const box = (await img.boundingBox())!;
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

/** Taps the child's picture area at fractions of its current box. */
async function tapPlay(page: Page, fx: number, fy: number): Promise<void> {
  const box = await page.locator('[data-find-area]').boundingBox();
  if (!box) throw new Error('picture not visible');
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

test.beforeEach(async ({ page }) => {
  await reset({ find_levels: [] });
  await signInAsAdmin(page);
});

test('(a) the admin nav links to the Find It page', async ({ page }) => {
  await page.getByRole('link', { name: 'Find', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/find$/);
  await expect(page.getByRole('link', { name: 'Find', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('(b) build a level: nothing is stored before Save, then the objects keep click order and words', async ({ page }) => {
  await openFind(page);
  await page.getByRole('button', { name: 'Add level' }).click();
  await expect(save(page)).toBeDisabled();
  await pasteFindPicture(page, 1);
  await expect(picture(page, 1)).toBeVisible();

  await clickPicture(page, 1, 0.25, 0.3);
  await clickPicture(page, 1, 0.5, 0.6);
  await expect(save(page)).toBeDisabled(); // objects have no words yet
  await page.getByLabel('Word for object 1', { exact: true }).fill('apple');
  await page.getByLabel('Word for object 2', { exact: true }).fill('ball');
  await expect(save(page)).toBeEnabled();
  expect(await storage()).toEqual([]); // picking and placing only change the page
  expect(await levelsOf()).toHaveLength(0);

  await save(page).click();
  await expect(saved(page)).toBeVisible();
  const rows = await levelsOf();
  expect(rows).toHaveLength(1);
  expect(rows[0].image_path).toMatch(/^[0-9a-f-]{36}\/find\/.+\.svg$/);
  expect(rows[0].objects).toHaveLength(2);
  expect(rows[0].objects[0]).toMatchObject({ word: 'apple', audio_path: null });
  expect(rows[0].objects[0].x).toBeCloseTo(0.25, 2);
  expect(rows[0].objects[0].y).toBeCloseTo(0.3, 2);
  expect(rows[0].objects[1]).toMatchObject({ word: 'ball', audio_path: null });
  expect(rows[0].objects[1].x).toBeCloseTo(0.5, 2);
  expect(rows[0].objects[1].y).toBeCloseTo(0.6, 2);
  expect(rows[0].objects[0].r).toBe(0.06);
  expect(await storage()).toEqual([rows[0].image_path]);

  await page.reload();
  await expect(article(page, 1)).toBeVisible();
  await article(page, 1).getByRole('button', { name: 'Expand level 1' }).click(); // a saved level starts collapsed
  await expect(page.getByLabel('Word for object 1', { exact: true })).toHaveValue('apple');
  await expect(page.getByLabel('Word for object 2', { exact: true })).toHaveValue('ball');
  await expect(picture(page, 1)).toHaveAttribute('src', /\/storage\/v1\/object\/public\/media\/[0-9a-f-]{36}\/find\/.+\.svg$/);
});

test('(c) a picture shared by two levels survives deleting one, and is removed when the last user is deleted', async ({ page }) => {
  await openFind(page);
  // level 1: upload the picture and one object
  await page.getByRole('button', { name: 'Add level' }).click();
  await pasteFindPicture(page, 1);
  await clickPicture(page, 1, 0.3, 0.4);
  await clickPicture(page, 1, 0.6, 0.5);
  await page.getByLabel('Word for object 1', { exact: true }).fill('apple');
  await page.getByLabel('Word for object 2', { exact: true }).fill('ball');
  await save(page).click();
  await expect(saved(page)).toBeVisible();
  const [first] = await levelsOf();
  const shared = first.image_path;
  expect(await storage()).toEqual([shared]);

  // a new level is added last: this one is level 2, the apple level stays level 1
  // choose the same picture from the library
  await page.getByRole('button', { name: 'Add level' }).click();
  await article(page, 2).getByRole('button', { name: '+ Choose images', exact: true }).click();
  await page.getByRole('dialog', { name: 'Image Library' }).getByRole('button', { name: `Choose ${basename(shared)}` }).click();
  await page.getByRole('dialog', { name: basename(shared) }).getByRole('button', { name: 'Close picture' }).click(); // choosing also opens the zoom view
  await page.getByRole('dialog', { name: 'Image Library' }).getByRole('button', { name: 'OK', exact: true }).click();
  await expect(picture(page, 2)).toBeVisible();
  await clickPicture(page, 2, 0.6, 0.5);
  await clickPicture(page, 2, 0.4, 0.7);
  await article(page, 2).getByLabel('Word for object 1', { exact: true }).fill('cat');
  await article(page, 2).getByLabel('Word for object 2', { exact: true }).fill('duck');
  await save(page).click();
  await expect(saved(page)).toBeVisible();
  const levels = await levelsOf();
  expect(levels).toHaveLength(2);
  const second = levels.find((l) => l.objects[0]?.word === 'cat')!; // the new level (its picture is the same as the apple level's)

  // delete the apple level (level 1): the cat level still uses the picture, so the file stays
  await page.getByRole('button', { name: 'Delete level 1' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete level' }).click();
  await save(page).click();
  await expect(saved(page)).toBeVisible();
  expect(await levelsOf()).toHaveLength(1);
  expect(await storage()).toEqual([shared]);

  await page.goto(`/games/find/${second.id}`);
  await expect(page.locator('[data-find-area] img')).toBeVisible();
  await expect.poll(() => page.locator('[data-find-area] img').evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

  // delete level 2 (now the only one): the file is no longer used and is removed
  await openFind(page);
  await page.getByRole('button', { name: 'Delete level 1' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete level' }).click();
  await save(page).click();
  await expect(saved(page)).toBeVisible();
  expect(await levelsOf()).toHaveLength(0);
  await expect.poll(storage).toEqual([]);
});

test('(d) choosing a sound from the library stores its path on that object', async ({ page }) => {
  await reset({ find_levels: [], storage: [`${ACCOUNTS.parent.id}/audio/x.mp3`] });
  await openFind(page);
  await page.getByRole('button', { name: 'Add level' }).click();
  await pasteFindPicture(page, 1);
  await clickPicture(page, 1, 0.4, 0.4);
  await clickPicture(page, 1, 0.7, 0.6);
  await page.getByLabel('Word for object 1', { exact: true }).fill('cat');
  await page.getByLabel('Word for object 2', { exact: true }).fill('duck');
  await page.getByRole('button', { name: 'Choose sound for object 1', exact: true }).click();
  await page.getByRole('dialog', { name: 'Sound Library' }).getByRole('button', { name: 'Choose x.mp3' }).click();
  await page.getByRole('dialog', { name: 'Sound Library' }).getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Sound Library' })).toHaveCount(0);
  await expect(page.getByText('x.mp3', { exact: true })).toBeVisible();
  await save(page).click();
  await expect(saved(page)).toBeVisible();
  const [row] = await levelsOf();
  expect(row.objects[0]).toMatchObject({ word: 'cat', audio_path: `${ACCOUNTS.parent.id}/audio/x.mp3` });
});

test('(e) the child plays the objects in the admin numbering after a move', async ({ page }) => {
  await openFind(page);
  await page.getByRole('button', { name: 'Add level' }).click();
  await pasteFindPicture(page, 1);
  await clickPicture(page, 1, 0.2, 0.3);
  await clickPicture(page, 1, 0.5, 0.5);
  await clickPicture(page, 1, 0.8, 0.7);
  await page.getByLabel('Word for object 1', { exact: true }).fill('apple');
  await page.getByLabel('Word for object 2', { exact: true }).fill('ball');
  await page.getByLabel('Word for object 3', { exact: true }).fill('cat');
  // move object 3 to the front: the numbers now read cat, apple, ball
  await page.getByRole('button', { name: 'Move object 3 up', exact: true }).click();
  await page.getByRole('button', { name: 'Move object 2 up', exact: true }).click();
  await expect(page.getByLabel('Word for object 1', { exact: true })).toHaveValue('cat');
  await save(page).click();
  await expect(saved(page)).toBeVisible();
  const [row] = await levelsOf();
  expect(row.objects.map((o) => o.word)).toEqual(['cat', 'apple', 'ball']);

  await page.goto('/games/find');
  await page.getByRole('link', { name: /^Play level/ }).click();
  await expect(page.locator('[data-find-area]')).toBeVisible();
  await expect(page.locator('[data-current="true"]')).toHaveAttribute('aria-label', 'Object 1: cat');
  await tapPlay(page, row.objects[0].x, row.objects[0].y);
  await expect(page.locator('[data-current="true"]')).toHaveAttribute('aria-label', 'Object 2: apple', { timeout: 5000 });
});
