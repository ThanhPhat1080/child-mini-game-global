import { expect, test } from '@playwright/test';
import { makeCards, reset } from './support/fixtures';

const level = (page: import('@playwright/test').Page, n: number) => page.getByLabel(`${n} cards`);

test('6 active cards: only the 12-card level can be chosen', async ({ page }) => {
  await reset({ memory_cards: makeCards(6) });
  await page.goto('/games/memory');
  await expect(page.getByRole('link', { name: '12 cards' })).toBeVisible();
  for (const n of [16, 20, 24, 30]) await expect(page.getByRole('button', { name: `${n} cards` })).toBeDisabled();
  await expect(page.getByRole('link', { name: /^(16|20|24|30) cards$/ })).toHaveCount(0);
});

test('8 active cards: the 12 and 16-card levels can be chosen', async ({ page }) => {
  await reset({ memory_cards: makeCards(8) });
  await page.goto('/games/memory');
  await expect(page.getByRole('link', { name: '12 cards' })).toBeVisible();
  await expect(page.getByRole('link', { name: '16 cards' })).toHaveAttribute('href', '/games/memory/16');
  for (const n of [20, 24, 30]) await expect(page.getByRole('button', { name: `${n} cards` })).toBeDisabled();
  await expect(page.getByRole('link', { name: /^(20|24|30) cards$/ })).toHaveCount(0);
});

test('15 active cards: all five levels can be chosen', async ({ page }) => {
  await reset({ memory_cards: makeCards(15) });
  await page.goto('/games/memory');
  for (const n of [12, 16, 20, 24, 30]) {
    await expect(page.getByRole('link', { name: `${n} cards` })).toHaveAttribute('href', `/games/memory/${n}`);
    await expect(page.getByText(`${n} cards`, { exact: true })).toBeVisible();
  }
});

test.describe('the five buttons fit the stage in one row', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('one row, inside the stage, below the header and clear of the hills edge', async ({ page }) => {
    await reset({ memory_cards: makeCards(15) });
    await page.goto('/games/memory');
    await expect(page.getByRole('link', { name: '12 cards' })).toBeFocused();
    const boxes = [];
    for (const n of [12, 16, 20, 24, 30]) boxes.push((await page.getByRole('link', { name: `${n} cards` }).boundingBox())!);
    for (const b of boxes) {
      expect(Math.abs(b.width - b.height)).toBeLessThan(1);
      expect(Math.abs(b.y - boxes[0].y)).toBeLessThan(2);
      expect(b.x).toBeGreaterThanOrEqual(50);
      expect(b.x + b.width).toBeLessThanOrEqual(1920 - 50);
      expect(b.y).toBeGreaterThan(200); // below the Back button and the badge
      expect(b.y + b.height + 100).toBeLessThanOrEqual(1080);
    }
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].x).toBeGreaterThan(boxes[i - 1].x + boxes[i - 1].width);
  });
});

test('no cards: a friendly picture screen, no level buttons', async ({ page }) => {
  await reset({ memory_cards: [] });
  await page.goto('/games/memory');
  await expect(page.getByRole('status')).toBeVisible();
  await expect(page.locator('[role="alert"]:not(next-route-announcer *)')).toHaveCount(0);
  await expect(level(page, 12)).toHaveCount(0);
});

test('keyboard only: Right x3 then Enter reaches the 24-card level', async ({ page }) => {
  await reset({ memory_cards: makeCards(15) });
  await page.goto('/games/memory');
  // the page focuses the first level once it has loaded; waiting for it means keys are not lost before hydration
  await expect(page.getByRole('link', { name: '12 cards' })).toBeFocused();
  for (const n of [16, 20, 24]) {
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('link', { name: `${n} cards` })).toBeFocused();
  }
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/games\/memory\/24$/);
});

test('keyboard only: Right stops at the last enabled level (10 cards: 20)', async ({ page }) => {
  await reset({ memory_cards: makeCards(10) });
  await page.goto('/games/memory');
  await expect(page.getByRole('link', { name: '12 cards' })).toBeFocused();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('link', { name: '20 cards' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/games\/memory\/20$/);
});

test('keyboard only: Enter on the first level reaches /games/memory/12', async ({ page }) => {
  await reset({ memory_cards: makeCards(15) });
  await page.goto('/games/memory');
  await expect(page.getByRole('link', { name: '12 cards' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/games\/memory\/12$/);
});

test('the "? Memory Match" badge opens the tutorial; Play only closes it; Esc closes without leaving', async ({ page }) => {
  await reset({ memory_cards: makeCards(15) });
  await page.goto('/games/memory');
  await expect(page.getByRole('link', { name: '12 cards' })).toBeFocused();
  const badge = page.getByRole('button', { name: 'What is Memory Match? Show how to play' });
  const dialog = page.getByRole('dialog', { name: 'How to play Memory Match' });

  await badge.click();
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Go to step 4' }).click();
  await page.getByRole('button', { name: 'Play Memory Match' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(badge).toBeFocused();
  await expect(page).toHaveURL(/\/games\/memory$/);

  await badge.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(badge).toBeFocused();
  await expect(page).toHaveURL(/\/games\/memory$/);
});
