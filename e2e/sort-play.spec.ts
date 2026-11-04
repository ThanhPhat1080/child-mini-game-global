import { expect, test, type Locator, type Page } from '@playwright/test';
import { makeGroupedCards, reset } from './support/fixtures';

const CARDS = makeGroupedCards({ animals: 5, food: 5, school: 4 });
const groupOf = new Map(CARDS.map((c) => [c.id, c.group_id!]));

let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('console', (m) => {
    // the app has no favicon yet (not part of this screen); every other console error fails the test
    if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(`${m.text()} @ ${m.location().url}`);
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await reset({ memory_cards: CARDS });
});
test.afterEach(() => {
  expect(errors).toEqual([]);
});

const root = (page: Page) => page.locator('[data-sort-play]');
const objects = (page: Page) => page.locator('[data-object]');
const obj = (page: Page, id: string) => page.locator(`[data-object][data-card-id="${id}"]`);
const basketOf = (page: Page, id: string) => page.locator(`[data-group="${groupOf.get(id)}"] [data-basket]`);
const otherBasket = (page: Page, id: string) => page.locator(`[data-group]:not([data-group="${groupOf.get(id)}"]) [data-basket]`);

async function open(page: Page) {
  await page.goto('/games/sort');
  await expect(objects(page)).toHaveCount(6);
  await expect(page.locator('[data-basket]')).toHaveCount(2);
}

const ids = (page: Page) => objects(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-card-id')!));

async function center(l: Locator) {
  const b = await l.boundingBox();
  expect(b).not.toBeNull();
  return { x: b!.x + b!.width / 2, y: b!.y + b!.height / 2 };
}

/** Real mouse drag: press on the object, move in steps, release at `to` (client pixels). */
async function dragTo(page: Page, from: Locator, to: { x: number; y: number }) {
  const a = await center(from);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 20, a.y - 20, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

test('a full round by real mouse reaches the done state', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  await expect(root(page)).toHaveAttribute('data-done', 'false');
  for (const id of await ids(page)) {
    // retries while a press is still ignored during the previous drop's settle (WORD_AFTER_CHIME_MS)
    await dropRight(page, id);
    await expect(basketOf(page, id).locator(`[data-placed="${id}"]`)).toHaveCount(1);
  }
  await expect(root(page)).toHaveAttribute('data-done', 'true', { timeout: 8000 });
  await expect(root(page)).toHaveAttribute('data-wrong-count', '0');
  await expect(objects(page)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Back to games' })).toBeVisible();
});

test('a wrong drop shows the popup and returns the object; the right drop then fills the basket', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  const id = (await ids(page))[0];
  await dragTo(page, obj(page, id), await center(otherBasket(page, id)));
  await expect(page.locator('[data-feedback="wrong"]')).toBeVisible();
  await expect(root(page)).toHaveAttribute('data-wrong-count', '1');
  await expect(obj(page, id)).toHaveAttribute('data-state', 'idle');
  await expect(otherBasket(page, id).locator('[data-placed]')).toHaveCount(0);
  await expect(page.locator('[data-feedback="wrong"]')).toHaveCount(0, { timeout: 3000 });
  await dragTo(page, obj(page, id), await center(basketOf(page, id)));
  await expect(basketOf(page, id).locator(`[data-placed="${id}"]`)).toHaveCount(1);
  await expect(obj(page, id)).toHaveAttribute('data-state', 'hidden');
});

test('a drop on empty space plays nothing and leaves the object in place', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page);
  const id = (await ids(page))[0];
  const before = await obj(page, id).boundingBox();
  await dragTo(page, obj(page, id), { x: 960, y: 450 }); // between the two baskets
  await expect(page.locator('[data-feedback="wrong"]')).toHaveCount(0);
  await expect(obj(page, id)).toHaveAttribute('data-state', 'idle');
  await expect(root(page)).toHaveAttribute('data-wrong-count', '0');
  await expect(page.locator('[data-placed]')).toHaveCount(0);
  // the CSS slide back (SLIDE_BACK_MS) ends where the object started
  await expect.poll(() => obj(page, id).boundingBox()).toEqual(before);
});

test('a tap leaves the object in place', async ({ page }) => {
  await open(page);
  const id = (await ids(page))[0];
  await obj(page, id).click();
  await expect(obj(page, id)).toHaveAttribute('data-state', 'idle');
  await expect(page.locator('[data-placed]')).toHaveCount(0);
  await expect(page.locator('[data-feedback="wrong"]')).toHaveCount(0);
});

test('the right drop works on a scaled stage (1280x720)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page);
  const id = (await ids(page))[0];
  await dragTo(page, obj(page, id), await center(basketOf(page, id)));
  await expect(basketOf(page, id).locator(`[data-placed="${id}"]`)).toHaveCount(1);
  await expect(obj(page, id)).toHaveAttribute('data-state', 'hidden');
  await expect(root(page)).toHaveAttribute('data-wrong-count', '0');
});

test('only one usable group shows the friendly screen', async ({ page }) => {
  await reset({ memory_cards: makeGroupedCards({ animals: 6 }) });
  await page.goto('/games/sort');
  await expect(page.getByRole('status', { name: 'New cards are coming soon' })).toBeVisible();
  await expect(objects(page)).toHaveCount(0);
});

test('Esc returns to the game list', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Escape');
  await page.waitForURL('**/games');
});

/** Drops `id` into its right basket, retrying while a settle or slide-back ignores the press, until it is placed. */
async function dropRight(page: Page, id: string) {
  await expect(async () => {
    await dragTo(page, obj(page, id), await center(basketOf(page, id)));
    await expect(obj(page, id)).toHaveAttribute('data-state', 'hidden', { timeout: 1000 });
  }).toPass({ timeout: 10_000 });
}

/** One round: `wrongDrops` wrong drops of the first object, then every object into its right basket. */
async function playRound(page: Page, wrongDrops = 0) {
  const all = await ids(page);
  for (let n = 1; n <= wrongDrops; n++) {
    await dragTo(page, obj(page, all[0]), await center(otherBasket(page, all[0])));
    await expect(root(page)).toHaveAttribute('data-wrong-count', String(n));
    await expect(obj(page, all[0])).toHaveAttribute('data-state', 'idle');
  }
  for (const id of all) await dropRight(page, id);
}

const doneRoot = (page: Page) => page.locator('[data-sort-done][data-keys="ready"]');
const wrongLine = (page: Page) => page.locator('[data-wrong-line]');

test.describe('finish screen (R7)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('one wrong drop ends with "Wrong 1 times" and the two buttons', async ({ page }) => {
    test.setTimeout(60_000);
    await open(page);
    await playRound(page, 1);
    await expect(doneRoot(page)).toBeVisible({ timeout: 10_000 });
    await expect(wrongLine(page)).toHaveText('Wrong 1 times');
    await expect(page.locator('[data-wrong-total]')).toHaveText('1');
    await expect(page.getByRole('button', { name: 'Play again' })).toBeFocused();
    await expect(page.getByRole('link', { name: 'Back to games' })).toHaveCount(1);
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('link', { name: 'Back to games' })).toBeFocused();
  });

  test('a perfect round shows "Wrong 0 times"', async ({ page }) => {
    test.setTimeout(60_000);
    await open(page);
    await playRound(page);
    await expect(doneRoot(page)).toBeVisible({ timeout: 10_000 });
    await expect(wrongLine(page)).toHaveText('Wrong 0 times');
  });

  test('Play again starts a fresh round and the next finish starts from 0', async ({ page }) => {
    test.setTimeout(90_000);
    await open(page);
    await playRound(page, 1);
    await expect(doneRoot(page)).toBeVisible({ timeout: 10_000 });
    await expect(wrongLine(page)).toHaveText('Wrong 1 times');
    await page.getByRole('button', { name: 'Play again' }).click();
    await expect(page.locator('[data-sort-done]')).toHaveCount(0);
    await expect(objects(page)).toHaveCount(6);
    await expect(root(page)).toHaveAttribute('data-done', 'false');
    await expect(root(page)).toHaveAttribute('data-wrong-count', '0');
    await expect(page.locator('[data-placed]')).toHaveCount(0);
    await playRound(page);
    await expect(doneRoot(page)).toBeVisible({ timeout: 10_000 });
    await expect(wrongLine(page)).toHaveText('Wrong 0 times');
  });

  test('Esc on the finish goes to the game list', async ({ page }) => {
    test.setTimeout(60_000);
    await open(page);
    await playRound(page);
    await expect(doneRoot(page)).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape');
    await page.waitForURL('**/games');
  });
});
