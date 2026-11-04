import { expect, test, type Locator, type Page } from '@playwright/test';
import { makeCards, reset } from './support/fixtures';

const COLS = 4; // level 12 is a 4x3 grid

let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('console', (m) => {
    // the app has no favicon yet (not part of this screen); every other console error fails the test
    if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(`${m.text()} @ ${m.location().url}`);
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await reset({ memory_cards: makeCards(6) });
});
test.afterEach(() => {
  expect(errors).toEqual([]);
});

/** Opens the 12-card board, waits for hydration (first tile focused) and reads the card id of every tile. */
async function openBoard(page: Page): Promise<{ tiles: Locator; ids: string[]; pairs: [number, number][] }> {
  await page.goto('/games/memory/12');
  const tiles = page.locator('[data-tile]');
  await expect(tiles.first()).toBeFocused();
  await expect(tiles).toHaveCount(12);
  const ids = await tiles.evaluateAll((els) => els.map((e) => e.getAttribute('data-card-id') ?? ''));
  const byId = new Map<string, number[]>();
  ids.forEach((id, i) => byId.set(id, [...(byId.get(id) ?? []), i]));
  const pairs = [...byId.values()].map(([a, b]) => [a, b] as [number, number]);
  expect(pairs).toHaveLength(6);
  return { tiles, ids, pairs };
}

const faceUps = (tiles: Locator) => tiles.evaluateAll((els) => els.map((e) => e.getAttribute('data-face-up')));

async function expectNoWords(page: Page) {
  await expect(page.getByText(/word\d+/)).toHaveCount(0);
  const html = await page.locator('[data-tile]').evaluateAll((els) => els.map((e) => e.outerHTML).join(''));
  expect(html).not.toMatch(/word\d+/);
}

test('a matching pair stays face-up', async ({ page }) => {
  const { tiles, pairs } = await openBoard(page);
  const [a, b] = pairs[0];
  await tiles.nth(a).click();
  await tiles.nth(b).click();
  await expect(tiles.nth(a)).toHaveAttribute('data-matched', 'true');
  await expect(tiles.nth(b)).toHaveAttribute('data-matched', 'true');
  await expect(tiles.nth(a)).toHaveAttribute('data-face-up', 'true');
  await expect(tiles.nth(b)).toHaveAttribute('data-face-up', 'true');
  await expectNoWords(page);
});

test('a mismatching pair flips back after the pause', async ({ page }) => {
  const { tiles, ids } = await openBoard(page);
  const other = ids.findIndex((id) => id !== ids[0]);
  await tiles.nth(0).click();
  await tiles.nth(other).click();
  await expect(tiles.nth(0)).toHaveAttribute('data-face-up', 'true');
  await expect(tiles.nth(other)).toHaveAttribute('data-face-up', 'true');
  await expect(tiles.nth(0)).toHaveAttribute('data-face-up', 'false', { timeout: 3000 });
  await expect(tiles.nth(other)).toHaveAttribute('data-face-up', 'false');
});

test('clicking a matched tile again does not change the board', async ({ page }) => {
  const { tiles, pairs } = await openBoard(page);
  const [a, b] = pairs[0];
  await tiles.nth(a).click();
  await tiles.nth(b).click();
  await expect(tiles.nth(b)).toHaveAttribute('data-matched', 'true');
  const before = await faceUps(tiles);
  await tiles.nth(a).click();
  expect(await faceUps(tiles)).toEqual(before);
  await expect(page.locator('[data-memory-play]')).toHaveAttribute('data-won', 'false');
});

test('keyboard only: arrows + Space finish the whole game', async ({ page }) => {
  const { tiles, pairs } = await openBoard(page);
  let at = 0;
  const goTo = async (target: number) => {
    const dr = Math.floor(target / COLS) - Math.floor(at / COLS);
    const dc = (target % COLS) - (at % COLS);
    for (let i = 0; i < Math.abs(dr); i++) await page.keyboard.press(dr > 0 ? 'ArrowDown' : 'ArrowUp');
    for (let i = 0; i < Math.abs(dc); i++) await page.keyboard.press(dc > 0 ? 'ArrowRight' : 'ArrowLeft');
    await expect(tiles.nth(target)).toBeFocused();
    at = target;
  };
  for (const [a, b] of pairs) {
    await goTo(a);
    await page.keyboard.press('Space');
    await expect(tiles.nth(a)).toHaveAttribute('data-face-up', 'true');
    await goTo(b);
    await page.keyboard.press('Space');
    await expect(tiles.nth(b)).toHaveAttribute('data-matched', 'true');
  }
  await expect(page.locator('[data-memory-play]')).toHaveAttribute('data-won', 'true');
  await expectNoWords(page);
});

const root = (page: Page) => page.locator('[data-memory-play]');

async function solve(tiles: Locator, pairs: [number, number][]) {
  for (const [a, b] of pairs) {
    await tiles.nth(a).click();
    await tiles.nth(b).click();
    await expect(tiles.nth(b)).toHaveAttribute('data-matched', 'true');
  }
}

test('no mistakes: the completion screen shows 12 flips', async ({ page }) => {
  const { tiles, pairs } = await openBoard(page);
  await solve(tiles, pairs);
  await expect(page.getByText('Total 12 times')).toBeVisible();
  await expect(page.locator('[data-total] [data-flips]')).toHaveText('12');
  await expect(page.getByRole('img', { name: '3 stars earned' })).toBeVisible();
  await expect(page.locator('[data-memory-done] img[src$="girl.webp"]')).toBeVisible();
  await expect(page.locator('[data-memory-done] img[src$="girl-beret.webp"]')).toBeVisible();
  await expect(root(page)).toHaveAttribute('data-won', 'true');
  await expect(page.locator('[data-memory-done] :is(button, a[href])')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Play again' })).toBeFocused();
});

test('one deliberate mismatch: 14 flips', async ({ page }) => {
  const { tiles, ids, pairs } = await openBoard(page);
  const other = ids.findIndex((id) => id !== ids[0]);
  await tiles.nth(0).click();
  await tiles.nth(other).click();
  await expect(tiles.nth(0)).toHaveAttribute('data-face-up', 'false', { timeout: 3000 });
  await solve(tiles, pairs);
  await expect(page.getByText('Total 14 times')).toBeVisible();
  await expect(page.locator('[data-total] [data-flips]')).toHaveText('14');
});

test('Play again starts a new game at 0 flips', async ({ page }) => {
  const { tiles, pairs } = await openBoard(page);
  await solve(tiles, pairs);
  await page.getByRole('button', { name: 'Play again' }).click();
  await expect(tiles.first()).toBeFocused();
  await expect(tiles).toHaveCount(12);
  await expect(page.locator('[data-total] [data-flips]')).toHaveCount(0);
  await expect(root(page)).toHaveAttribute('data-won', 'false');
  expect(await faceUps(tiles)).toEqual(Array(12).fill('false'));
  const ids = await tiles.evaluateAll((els) => els.map((e) => e.getAttribute('data-card-id') ?? ''));
  const byId = new Map<string, number[]>();
  ids.forEach((id, i) => byId.set(id, [...(byId.get(id) ?? []), i]));
  await solve(tiles, [...byId.values()].map(([a, b]) => [a, b] as [number, number]));
  await expect(page.getByText('Total 12 times')).toBeVisible();
});

test('Choose level returns to the level screen', async ({ page }) => {
  const { tiles, pairs } = await openBoard(page);
  await solve(tiles, pairs);
  await page.getByRole('link', { name: 'Choose level' }).click();
  await expect(page).toHaveURL(/\/games\/memory$/);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the game still completes', async ({ page }) => {
    const { tiles, pairs } = await openBoard(page);
    await expect(page.locator('[data-memory-play]')).toHaveClass(/hm-reduced/);
    for (const [a, b] of pairs) {
      await tiles.nth(a).click();
      await tiles.nth(b).click();
      await expect(tiles.nth(b)).toHaveAttribute('data-matched', 'true');
    }
    await expect(page.locator('[data-memory-play]')).toHaveAttribute('data-won', 'true');
    await expectNoWords(page);
  });
});

test.describe('the focus ring fits on the stage', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  for (const level of [16, 20, 24, 30]) {
    test(`level ${level}: the last tile plus its ring ends inside the 1080 px stage`, async ({ page }) => {
      await reset({ memory_cards: makeCards(15) });
      await page.goto(`/games/memory/${level}`);
      const tiles = page.locator('[data-tile]');
      await expect(tiles.first()).toBeFocused();
      await expect(tiles).toHaveCount(level);
      const stage = (await root(page).boundingBox())!;
      const last = (await tiles.last().boundingBox())!;
      const scale = stage.height / 1080;
      const bottom = (last.y + last.height - stage.y) / scale;
      expect(Math.abs(last.width - last.height)).toBeLessThan(1); // tiles stay square
      expect(bottom + 14).toBeLessThanOrEqual(1080); // 6 px ring + 8 px offset
      const first = (await tiles.first().boundingBox())!;
      expect((first.y - stage.y) / scale).toBeGreaterThanOrEqual(190); // under the header band
      expect((first.x - stage.x) / scale).toBeGreaterThanOrEqual(0);
      expect((last.x + last.width - stage.x) / scale).toBeLessThanOrEqual(1920); // inside the stage horizontally
    });
  }
});

test.describe('level 16 keyboard game', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('keyboard only: a game with no mistakes reaches the completion screen with 16 flips', async ({ page }) => {
    await reset({ memory_cards: makeCards(8) });
    await page.goto('/games/memory/16');
    const tiles = page.locator('[data-tile]');
    await expect(tiles.first()).toBeFocused();
    await expect(tiles).toHaveCount(16);
    const ids = await tiles.evaluateAll((els) => els.map((e) => e.getAttribute('data-card-id') ?? ''));
    const byId = new Map<string, number[]>();
    ids.forEach((id, i) => byId.set(id, [...(byId.get(id) ?? []), i]));
    const cols = 4;
    let at = 0;
    const goTo = async (target: number) => {
      const dr = Math.floor(target / cols) - Math.floor(at / cols);
      const dc = (target % cols) - (at % cols);
      for (let i = 0; i < Math.abs(dr); i++) await page.keyboard.press(dr > 0 ? 'ArrowDown' : 'ArrowUp');
      for (let i = 0; i < Math.abs(dc); i++) await page.keyboard.press(dc > 0 ? 'ArrowRight' : 'ArrowLeft');
      await expect(tiles.nth(target)).toBeFocused();
      at = target;
    };
    expect(byId.size).toBe(8);
    for (const [a, b] of byId.values()) {
      await goTo(a);
      await page.keyboard.press('Space');
      await expect(tiles.nth(a)).toHaveAttribute('data-face-up', 'true');
      await goTo(b);
      await page.keyboard.press('Space');
      await expect(tiles.nth(b)).toHaveAttribute('data-matched', 'true');
    }
    await expect(page.getByText('Total 16 times')).toBeVisible();
    await expect(page.locator('[data-memory-play]')).toHaveAttribute('data-won', 'true');
  });
});
