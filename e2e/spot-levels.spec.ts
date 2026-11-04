import { expect, test } from '@playwright/test';
import { makeSpotLevels, reset } from './support/fixtures';

const tiles = (page: import('@playwright/test').Page) => page.getByRole('link', { name: /^Play level/ });

test('5 active levels: the grid shows 5 level links with picture A', async ({ page }) => {
  const levels = makeSpotLevels(5);
  await reset({ spot_levels: levels });
  await page.goto('/games/spot');
  await expect(tiles(page)).toHaveCount(5);
  await expect(tiles(page).first()).toHaveAttribute('href', `/games/spot/${levels[0].id}`);
  await expect(tiles(page).first().locator('img')).toBeVisible();
});

test('keyboard only: Right then Enter opens the second level', async ({ page }) => {
  const levels = makeSpotLevels(5);
  await reset({ spot_levels: levels });
  await page.goto('/games/spot');
  await expect(tiles(page).first()).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(tiles(page).nth(1)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/games/spot/${levels[1].id}$`));
});

test('inactive levels are not listed', async ({ page }) => {
  await reset({ spot_levels: [...makeSpotLevels(2), ...makeSpotLevels(5, false).slice(2).map((l) => ({ ...l }))] });
  await page.goto('/games/spot');
  await expect(tiles(page)).toHaveCount(2);
});

test('no levels: a friendly picture screen, no links', async ({ page }) => {
  await reset({ spot_levels: [] });
  await page.goto('/games/spot');
  await expect(page.getByRole('status', { name: 'New levels are coming soon' })).toBeVisible();
  await expect(tiles(page)).toHaveCount(0);
  await expect(page.locator('[role="alert"]:not(next-route-announcer *)')).toHaveCount(0);
});

test('Esc returns to the game list', async ({ page }) => {
  await reset({ spot_levels: makeSpotLevels(3) });
  await page.goto('/games/spot');
  await expect(tiles(page).first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/games$/);
});

test('the "? Spot the Differences" badge opens the tutorial; Esc closes it without leaving', async ({ page }) => {
  await reset({ spot_levels: makeSpotLevels(3) });
  await page.goto('/games/spot');
  await expect(tiles(page).first()).toBeFocused();
  const badge = page.getByRole('button', { name: 'What is Spot the Differences? Show how to play' });
  const dialog = page.getByRole('dialog', { name: 'How to play Spot the Differences' });
  await badge.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(badge).toBeFocused();
  await expect(page).toHaveURL(/\/games\/spot$/);
});
