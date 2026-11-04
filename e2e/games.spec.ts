import { expect, test, type Page } from '@playwright/test';
import { reset } from './support/fixtures';

test.beforeEach(async () => {
  await reset();
});

test('the game list shows Quiz, Memory Match, Listen & Pick, Sort It, Spot and Find It as playable', async ({ page }) => {
  await page.goto('/games');
  await expect(page.getByRole('link', { name: 'Play Quiz' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Play Memory Match' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Play Listen & Pick' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Play Sort It' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Play Spot the Differences' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Play Find It' })).toBeVisible();
  await expect(page.getByRole('img', { name: /coming soon/ })).toHaveCount(0);
  await expect(page.getByText('Coming in Phase 2')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Go to game \d$/ })).toHaveCount(6);
});

/** The view takes focus in its mount effect, so a focused view means the page is hydrated and listens to keys. */
async function openGames(page: Page) {
  await page.goto('/games');
  await expect(page.locator('.hm-view')).toBeFocused();
}
const current = (page: Page, n: number) => expect(page.getByRole('button', { name: `Go to game ${n}` })).toHaveAttribute('aria-current', 'true');

test('ArrowRight moves to Memory Match and Enter opens it', async ({ page }) => {
  await openGames(page);
  await page.keyboard.press('ArrowRight');
  await current(page, 2);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/games\/memory$/);
});

test('ArrowRight twice reaches Listen & Pick and Enter opens it', async ({ page }) => {
  await openGames(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await current(page, 3);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/games\/listen$/);
});

test('ArrowRight three times reaches Sort It and Enter opens it', async ({ page }) => {
  await openGames(page);
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await current(page, 4);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/games\/sort$/);
});

test('Enter on the fifth game opens /games/spot', async ({ page }) => {
  await openGames(page);
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await current(page, 5);
  await expect(page.getByRole('button', { name: 'Next game' })).toBeEnabled();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/games\/spot$/);
});

test('Enter on the sixth game opens /games/find', async ({ page }) => {
  await openGames(page);
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await current(page, 6);
  await expect(page.getByRole('button', { name: 'Next game' })).toBeDisabled();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/games\/find$/);
});

test('the game list has no "?" help buttons and never shows a dialog', async ({ page }) => {
  await openGames(page);
  await expect(page.getByRole('button', { name: /What is .*Show how to play/ })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('ArrowRight');
  await current(page, 2);
  await expect(page.getByRole('button', { name: /What is .*Show how to play/ })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

for (const [id, name, url] of [['quiz', 'Quiz', /\/games\/quiz$/], ['memory', 'Memory Match', /\/games\/memory$/]] as const) {
  test(`the ${name} card shows a decorative icon; clicking its center opens the game`, async ({ page }) => {
    await openGames(page);
    if (id === 'memory') { await page.keyboard.press('ArrowRight'); await current(page, 2); }
    const icon = page.locator(`[data-game-icon="${id}"]`);
    await expect(icon).toBeVisible();
    await expect(icon).toHaveAttribute('aria-hidden', 'true');
    await expect(icon.locator('button, a, [tabindex]')).toHaveCount(0);
    // wait for the slide animation (0.7 s) to settle before clicking
    let prev = '';
    await expect.poll(async () => { const b = JSON.stringify(await icon.boundingBox()); const same = b === prev; prev = b; return same; }, { intervals: [150] }).toBe(true);
    const box = (await icon.boundingBox())!;
    expect(box.width).toBeGreaterThan(50);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page).toHaveURL(url);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}

test('Space on the focused carousel opens a ready game and no dialog appears', async ({ page }) => {
  await openGames(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Space');
  await expect(page).toHaveURL(/\/games\/quiz$/);
});

test('Tab moves from the Quiz card link through Memory Match, Listen & Pick and Sort It to Spot (no stop on any icon)', async ({ page }) => {
  await openGames(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Play Quiz' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Play Memory Match' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Play Listen & Pick' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Play Sort It' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Play Spot the Differences' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Play Find It' })).toBeFocused();
});

test('Memory Match has a sage border, Quiz a rose one, Spot a sky one, Sort It a butter one (four distinct colors)', async ({ page }) => {
  await page.goto('/games');
  const border = (loc: ReturnType<Page['locator']>) => loc.evaluate((el) => getComputedStyle(el).borderTopColor);
  const quiz = await border(page.getByRole('link', { name: 'Play Quiz' }));
  const memory = await border(page.getByRole('link', { name: 'Play Memory Match' }));
  const spot = await border(page.getByRole('link', { name: 'Play Spot the Differences' }));
  expect(memory).toBe('rgb(169, 205, 177)');
  expect(quiz).toBe('rgb(235, 183, 188)');
  const sort = await border(page.getByRole('link', { name: 'Play Sort It' }));
  expect(spot).toBe('rgb(169, 198, 222)');
  expect(sort).toBe('rgb(234, 217, 160)');
  expect(new Set([quiz, memory, spot, sort]).size).toBe(4);
  const title = await page.getByRole('link', { name: 'Play Memory Match' }).getByText('Memory Match').evaluate((el) => getComputedStyle(el).color);
  expect(title).toBe('rgb(94, 143, 105)');
});

test('the Memory icon ring matches the green Memory title; the Quiz icon stays rose', async ({ page }) => {
  await page.goto('/games');
  const title = await page.getByRole('link', { name: 'Play Memory Match' }).getByText('Memory Match').evaluate((el) => getComputedStyle(el).color);
  const ring = await page.locator('[data-game-icon="memory"] svg > circle').first().evaluate((el) => getComputedStyle(el).stroke);
  expect(ring).toBe(title);
  expect(ring).toBe('rgb(94, 143, 105)');
  await expect(page.locator('[data-game-icon="memory"] svg > circle').first()).toHaveAttribute('fill', '#EAF3EC');
  const quizRing = await page.locator('[data-game-icon="quiz"] svg').evaluate((el) => getComputedStyle(el).stroke);
  expect(quizRing).toBe('rgb(184, 115, 123)');
  await expect(page.locator('[data-game-icon="quiz"] svg')).toHaveAttribute('stroke', '#B8737B');
});
