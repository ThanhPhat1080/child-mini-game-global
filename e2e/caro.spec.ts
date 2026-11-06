import { expect, test, type Page } from '@playwright/test';
import { reset } from './support/fixtures';

// Caro X O (X1-X8): two players on one computer, big board.

test.beforeEach(async () => {
  await reset();
});

const square = (page: Page, n: number) => page.getByRole('button', { name: new RegExp(`^Square ${n},`) });

test('the game opens from the list and X wins the top row; Play again clears the board', async ({ page }) => {
  await page.goto('/games');
  await page.getByRole('link', { name: 'Play Caro X O' }).click();
  await expect(page).toHaveURL(/\/games\/caro$/);

  // X starts; the moves alternate X, O, X, O, X.
  await square(page, 1).click();
  await square(page, 4).click();
  await square(page, 2).click();
  await square(page, 5).click();
  await square(page, 3).click();

  await expect(square(page, 1)).toHaveAttribute('aria-label', 'Square 1, X');
  await expect(page.getByRole('button', { name: 'Play again' })).toBeVisible();
  await page.getByRole('button', { name: 'Play again' }).click();
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
