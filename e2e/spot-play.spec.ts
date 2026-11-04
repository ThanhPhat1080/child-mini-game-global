import { expect, test, type Page } from '@playwright/test';
import { makeSpotLevels, reset } from './support/fixtures';

const LEVEL = makeSpotLevels(1)[0];
const URL = `/games/spot/${LEVEL.id}`;

let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(`${m.text()} @ ${m.location().url}`);
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await reset({ spot_levels: [LEVEL] });
});
test.afterEach(() => {
  expect(errors).toEqual([]);
});

/** Clicks the picture area (inside the frame) at a fraction of its CURRENT bounding box. */
async function tapAt(page: Page, side: 'a' | 'b', x: number, y: number) {
  const box = await page.locator(`[data-spot-pic="${side}"] [data-spot-area]`).boundingBox();
  if (!box) throw new Error('picture not visible');
  await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
}
const open = async (page: Page) => {
  await page.goto(URL);
  await expect(page.locator('[data-spot-pic="a"]')).toBeVisible();
  await expect(page.locator('[data-spot-dot]')).toHaveCount(3);
};
const lit = (page: Page) => page.locator('[data-spot-dot][data-lit]');

test('three known points light three dots and show the celebration', async ({ page }) => {
  await open(page);
  await tapAt(page, 'a', 0.25, 0.3);
  await expect(lit(page)).toHaveCount(1);
  await tapAt(page, 'b', 0.5, 0.6);
  await expect(lit(page)).toHaveCount(2);
  await tapAt(page, 'a', 0.75, 0.4);
  await expect(lit(page)).toHaveCount(3);
  await expect(page.locator('[data-spot-done]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play again' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Choose level' })).toBeVisible();
});

test('a tap on empty space ripples without penalty, then a correct tap still works', async ({ page }) => {
  await open(page);
  await tapAt(page, 'a', 0.9, 0.9);
  await expect(page.locator('[data-spot-ripple]')).toHaveCount(1);
  await expect(lit(page)).toHaveCount(0);
  await tapAt(page, 'a', 0.25, 0.3);
  await expect(lit(page)).toHaveCount(1);
});

test('rings appear on both pictures and a repeated tap changes nothing', async ({ page }) => {
  await open(page);
  await tapAt(page, 'a', 0.25, 0.3);
  await expect(page.locator('[data-spot-found]')).toHaveCount(2);
  await tapAt(page, 'a', 0.25, 0.3);
  await tapAt(page, 'b', 0.25, 0.3);
  await expect(lit(page)).toHaveCount(1);
  await expect(page.locator('[data-spot-found]')).toHaveCount(2);
  await expect(page.locator('[data-spot-ripple]')).toHaveCount(0);
});

test('a tap just inside the radius counts', async ({ page }) => {
  await open(page);
  // 0.05 of the width to the right of the first point (r is 0.06)
  await tapAt(page, 'a', 0.25 + 0.05, 0.3);
  await expect(lit(page)).toHaveCount(1);
});

test('Esc returns to the level grid', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/games\/spot$/);
});

test('an unknown level id shows the friendly status', async ({ page }) => {
  await page.goto('/games/spot/00000000-0000-4000-a000-0000000000ff');
  await expect(page.getByRole('status', { name: 'This picture is not available' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/games\/spot$/);
});

test('with reduced motion a level still completes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await tapAt(page, 'a', 0.25, 0.3);
  await tapAt(page, 'b', 0.5, 0.6);
  await tapAt(page, 'a', 0.75, 0.4);
  await expect(page.locator('[data-spot-done]')).toBeVisible();
});
