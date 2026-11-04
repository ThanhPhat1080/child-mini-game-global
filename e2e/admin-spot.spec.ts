import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { getState, makeSpotLevels, reset, signInAsAdmin } from './support/fixtures';

const A = 'public/seed/spot/garden-a.svg';
const B = 'public/seed/spot/garden-b.svg';

type LevelRow = { id: string; image_a_path: string; image_b_path: string; differences: { x: number; y: number; r: number }[]; active: boolean; sort_order: number };
const levelsOf = async () => (await getState()).spot_levels as LevelRow[];
const storage = async () => ((await getState()) as unknown as { storage: string[] }).storage;
const save = (page: Page) => page.getByRole('button', { name: 'Save' });

async function openSpot(page: Page): Promise<void> {
  await page.goto('/admin/spot');
  await expect(page.getByRole('button', { name: 'Add level' })).toBeVisible();
  // saved levels start collapsed to their header
  for (const b of await page.getByRole('button', { name: /^Expand level/ }).all()) await b.click();
}

/** Pastes an SVG file into picture A or B of level `n` ("Or paste SVG code"), a local preview until Save. */
async function pasteSpotPicture(page: Page, n: number, side: 'A' | 'B', file: string): Promise<void> {
  const level = page.getByRole('article', { name: `Level ${n}`, exact: true });
  await level.locator('summary').nth(side === 'A' ? 0 : 1).click();
  await level.getByLabel(`SVG code for picture ${side} of level ${n}`, { exact: true }).fill(readFileSync(file, 'utf8'));
  await level.getByRole('button', { name: `Use SVG for picture ${side} of level ${n}`, exact: true }).click();
}

/** Clicks picture A of the first level at fractions of its box. */
async function clickA(page: Page, fx: number, fy: number): Promise<void> {
  const img = page.getByRole('article', { name: 'Level 1' }).getByRole('img', { name: 'Picture A', exact: true });
  await img.scrollIntoViewIfNeeded();
  await expect.poll(async () => (await img.boundingBox())?.width ?? 0).toBeGreaterThan(200); // wait for the picture to load
  const box = (await img.boundingBox())!;
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

/** Taps a picture's inner area (inside the frame) at fractions of its CURRENT box. */
async function tapPlay(page: Page, side: 'a' | 'b', fx: number, fy: number): Promise<void> {
  const box = await page.locator(`[data-spot-pic="${side}"] [data-spot-area]`).boundingBox();
  if (!box) throw new Error('picture not visible');
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

test.beforeEach(async ({ page }) => {
  await reset({ spot_levels: [] });
  await signInAsAdmin(page);
});

test('the admin nav links to the Spot page', async ({ page }) => {
  await page.getByRole('link', { name: 'Spot', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/spot$/);
  await expect(page.getByRole('link', { name: 'Spot', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('build a level, save it, play it, delete it', async ({ page }) => {
  await openSpot(page);
  await page.getByRole('button', { name: 'Add level' }).click();
  await expect(save(page)).toBeDisabled();
  await pasteSpotPicture(page, 1, 'A', A);
  await pasteSpotPicture(page, 1, 'B', B);
  await expect(page.getByText(/different shapes/i)).toHaveCount(0);

  await clickA(page, 0.25, 0.3);
  await clickA(page, 0.5, 0.6);
  await expect(save(page)).toBeDisabled(); // 2 spots
  await clickA(page, 0.75, 0.4);
  await expect(save(page)).toBeEnabled();
  expect(await storage()).toEqual([]); // nothing is uploaded before Save
  expect(await levelsOf()).toHaveLength(0);

  await save(page).click();
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible();
  const rows = await levelsOf();
  expect(rows).toHaveLength(1);
  expect(rows[0].differences).toHaveLength(3);
  const clicked = [{ x: 0.25, y: 0.3 }, { x: 0.5, y: 0.6 }, { x: 0.75, y: 0.4 }];
  rows[0].differences.forEach((d, i) => {
    expect(d.x).toBeCloseTo(clicked[i].x, 2);
    expect(d.y).toBeCloseTo(clicked[i].y, 2);
    expect(d.r).toBe(0.06);
  });
  expect(rows[0].image_a_path).toMatch(/^spot\/.+\.svg$/);
  expect(rows[0].image_b_path).toMatch(/^spot\/.+\.svg$/);
  expect([...(await storage())].sort()).toEqual([rows[0].image_a_path, rows[0].image_b_path].sort());

  await page.goto('/games/spot');
  await expect(page.getByRole('link', { name: /^Play level/ })).toHaveCount(1);
  await page.getByRole('link', { name: /^Play level/ }).click();
  await expect(page).toHaveURL(new RegExp(`/games/spot/${rows[0].id}$`));
  await expect(page.locator('[data-spot-pic="a"]')).toBeVisible();
  await expect(page.locator('[data-spot-dot]')).toHaveCount(3);
  await tapPlay(page, 'a', rows[0].differences[0].x, rows[0].differences[0].y);
  await expect(page.locator('[data-spot-dot][data-lit]')).toHaveCount(1);
  await tapPlay(page, 'b', rows[0].differences[1].x, rows[0].differences[1].y);
  await expect(page.locator('[data-spot-dot][data-lit]')).toHaveCount(2);
  await tapPlay(page, 'a', rows[0].differences[2].x, rows[0].differences[2].y);
  await expect(page.locator('[data-spot-done]')).toBeVisible();

  await openSpot(page);
  await page.getByRole('button', { name: 'Delete level 1' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete level' }).click();
  await save(page).click();
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible();
  expect(await levelsOf()).toHaveLength(0);
  await page.goto('/games/spot');
  await expect(page.getByRole('link', { name: /^Play level/ })).toHaveCount(0);
});

test('a draft (inactive) level can be previewed as the child while signed in', async ({ page, context }) => {
  const [draft] = makeSpotLevels(1, false);
  await reset({ spot_levels: [draft] });
  await openSpot(page);
  await expect(page.getByLabel('Level 1 on')).not.toBeChecked();
  const [popup] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: 'Preview as child' }).click()]);
  await expect(popup).toHaveURL(new RegExp(`/games/spot/${draft.id}$`));
  await expect(popup.getByRole('img').first()).toBeVisible();
});

test('Revert discards unsaved spots', async ({ page }) => {
  await reset({ spot_levels: makeSpotLevels(1) });
  await openSpot(page);
  await clickA(page, 0.9, 0.9);
  await expect(page.getByRole('button', { name: 'Spot 4' })).toBeVisible();
  await page.getByRole('button', { name: 'Revert' }).click();
  await expect(page.getByRole('button', { name: 'Spot 4' })).toHaveCount(0);
  await expect(save(page)).toBeDisabled();
});
