import { expect, test, type Page } from '@playwright/test';
import { reset } from './support/fixtures';

// Caro X O (X1-X8): two players on one computer, big board.

test.beforeEach(async () => {
  await reset();
});

// Direct locator by DOM order: a role query computes the name of every cell and is very slow.
const square = (page: Page, n: number) => page.locator('.caro-cell').nth(n - 1);

test('the game opens from the list and X wins with five in the top row; Play again clears the board', async ({ page }) => {
  await page.goto('/games');
  await page.getByRole('link', { name: 'Play Caro X O' }).click();
  await expect(page).toHaveURL(/\/games\/caro$/);

  // X starts; the moves alternate X, O, X, O, X, O, X, O, X. X makes five in the top row (cells 1-5).
  for (const [x, o] of [[1, 21], [2, 22], [3, 23], [4, 24]]) {
    await square(page, x).click();
    await square(page, o).click();
  }
  await square(page, 5).click();

  await expect(square(page, 1)).toHaveAttribute('aria-label', 'Square 1, X');
  await expect(page.locator('[aria-label="Play again"]')).toBeVisible();
  await page.locator('[aria-label="Play again"]').click();
  await expect(square(page, 1)).toHaveAttribute('aria-label', 'Square 1, empty');
});

test('the game list reaches Caro X O with the arrow keys and Enter opens it', async ({ page }) => {
  await page.goto('/games');
  await expect(page.locator('.hm-view')).toBeFocused();
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Go to game 7' })).toHaveAttribute('aria-current', 'true');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/games\/caro$/);
});
