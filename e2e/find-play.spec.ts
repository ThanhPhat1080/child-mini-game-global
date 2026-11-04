import { expect, test, type Page } from '@playwright/test';
import { makeFindLevels, reset } from './support/fixtures';

const LEVEL = makeFindLevels(1, 3)[0];
const URL = `/games/find/${LEVEL.id}`;
/** Object centres from makeFindLevels(1, 3): (0.2, 0.3), (0.5, 0.5), (0.8, 0.7). */
const OBJECTS = LEVEL.objects;

let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(`${m.text()} @ ${m.location().url}`);
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await reset({ find_levels: [LEVEL] });
});
test.afterEach(() => {
  expect(errors).toEqual([]);
});

/** Clicks the picture area at a fraction of its CURRENT bounding box (page.mouse, so the real tap path runs). */
async function tapAt(page: Page, x: number, y: number) {
  const box = await page.locator('[data-find-area]').boundingBox();
  if (!box) throw new Error('picture not visible');
  await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
}
/** The highlighted row of the word list (data-current) names the object being asked. */
const currentRow = (page: Page) => page.locator('[data-current="true"]');
const expectAsked = (page: Page, i: number) =>
  expect(currentRow(page)).toHaveAttribute('aria-label', `Object ${i + 1}: ${OBJECTS[i].word}`);
const open = async (page: Page) => {
  await page.goto(URL);
  await expect(page.locator('[data-find-area]')).toBeVisible();
  await expect(page.locator('[data-find-row]')).toHaveCount(3);
  await expectAsked(page, 0);
};
const lit = (page: Page) => page.locator('[data-found="true"]');

test('clicking each object in order finds them all and shows the celebration', async ({ page }) => {
  await open(page);
  for (let i = 0; i < OBJECTS.length; i++) {
    await expectAsked(page, i);
    await tapAt(page, OBJECTS[i].x, OBJECTS[i].y);
    await expect(lit(page)).toHaveCount(i + 1);
  }
  await expect(page.locator('[data-find-done]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play again' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Choose level' })).toBeVisible();
});

test('play again restarts from the first object', async ({ page }) => {
  await open(page);
  for (const o of OBJECTS) {
    await expectAsked(page, OBJECTS.indexOf(o));
    await tapAt(page, o.x, o.y);
  }
  await expect(page.locator('[data-find-done]')).toBeVisible();
  await page.getByRole('button', { name: 'Play again' }).click();
  await expectAsked(page, 0);
  await expect(lit(page)).toHaveCount(0);
});

test('a wrong click ripples and leaves the level unfinished', async ({ page }) => {
  await open(page);
  await tapAt(page, OBJECTS[2].x, OBJECTS[2].y); // the third object is not the current one
  await expect(page.locator('[data-find-ripple]')).toHaveCount(1);
  await expect(lit(page)).toHaveCount(0);
  await expectAsked(page, 0);
  await expect(page.locator('[data-find-done]')).toHaveCount(0);
});

test('Esc returns to the level grid', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/games\/find$/);
});

test('an unknown level id shows the friendly status', async ({ page }) => {
  await page.goto('/games/find/00000000-0000-4000-a000-0000000000ff');
  await expect(page.getByRole('status', { name: 'This picture is not available' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/games\/find$/);
});
