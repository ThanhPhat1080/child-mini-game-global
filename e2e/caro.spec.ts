import { expect, test, type Page } from '@playwright/test';
import { reset } from './support/fixtures';

// Caro X O (X1-X12). The e2e child is a girl, so she plays O; X (the opponent) starts.

test.beforeEach(async () => {
  await reset();
});

// Direct locator by DOM order: a role query computes the name of every cell and is very slow.
const square = (page: Page, n: number) => page.locator('.caro-cell').nth(n - 1);
const playAgain = (page: Page) => page.locator('[aria-label="Play again"]');

/** Cells 1..n of the board are numbered row by row, 30 to a row. */
async function play(page: Page, cells: number[]) {
  for (const n of cells) await square(page, n).click();
}

test('Back asks "Leave now?": No stays on the board, Yes goes to the games list', async ({ page }) => {
  await page.goto('/games');
  await page.getByRole('link', { name: 'Play Caro' }).click();
  await expect(page).toHaveURL(/\/games\/caro$/);
  await page.getByRole('button', { name: /vs human/ }).click();
  await play(page, [1, 31]);

  await page.getByRole('link', { name: 'Back to games' }).click();
  const ask = page.getByRole('dialog', { name: 'Leave now?' });
  await expect(ask).toBeVisible();
  await page.screenshot({ path: process.env.LEAVE_SHOT ?? 'test-results/leave-now.png' });
  await page.getByRole('button', { name: 'No' }).click();
  await expect(ask).toHaveCount(0);
  await expect(page).toHaveURL(/\/games\/caro$/);

  await page.getByRole('link', { name: 'Back to games' }).click();
  await page.getByRole('button', { name: 'Yes' }).click();
  await expect(page).toHaveURL(/\/games$/);
});

test('after the round: Play again? is centred at the bottom, the board is off, and Back and Guide still work', async ({ page }) => {
  await page.goto('/games');
  await page.getByRole('link', { name: 'Play Caro' }).click();
  await expect(page).toHaveURL(/\/games\/caro$/);
  await page.getByRole('button', { name: /vs human/ }).click();
  await play(page, [1, 31, 2, 32, 3, 33, 50, 34, 51, 35]);

  await expect(playAgain(page)).toBeVisible({ timeout: 8000 });
  await expect(playAgain(page)).toContainText('Play again?');
  const box = await playAgain(page).boundingBox();
  const vp = page.viewportSize()!;
  expect(Math.abs(box!.x + box!.width / 2 - vp.width / 2)).toBeLessThan(4);
  expect(box!.y + box!.height).toBeGreaterThan(vp.height * 0.9);

  await expect(page.getByLabel('Caro board')).toHaveAttribute('inert', '');

  await page.getByRole('button', { name: /What is Caro/ }).click();
  await expect(page.getByRole('dialog', { name: 'How to play Caro' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog', { name: 'How to play Caro' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Back to games' }).click();
  await expect(page.getByRole('dialog', { name: 'Leave now?' })).toBeVisible();
  await page.getByRole('button', { name: 'No' }).click();

  await playAgain(page).click();
  await expect(playAgain(page)).toHaveCount(0);
});

test('the child makes five in a row and sees Hooray; after it, Play again clears the board', async ({ page }) => {
  await page.goto('/games');
  await page.getByRole('link', { name: 'Play Caro' }).click();
  await expect(page).toHaveURL(/\/games\/caro$/);
  await page.getByRole('button', { name: /vs human/ }).click();

  // X (opponent) 1, O (child) 31, ... the child makes five on row 2 (cells 31-35).
  await play(page, [1, 31, 2, 32, 3, 33, 50, 34, 51, 35]);

  await expect(page.getByText('Hooray!')).toBeVisible();
  await expect(playAgain(page)).toHaveCount(0);
  await expect(playAgain(page)).toBeVisible({ timeout: 8000 });
  await playAgain(page).click();
  await expect(square(page, 1)).toHaveAttribute('aria-label', 'Square 1, empty');
});

test('when the opponent makes five: Oh-oh, the board stays with the five lit, and a blue Play again starts over', async ({ page }) => {
  await page.goto('/games/caro');
  await page.getByRole('button', { name: /vs human/ }).click();
  await play(page, [1, 31, 2, 32, 3, 33, 4, 34, 5]); // X makes five in the top row

  await expect(page.getByText('Oh-oh… try again!')).toBeVisible({ timeout: 4000 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Oh-oh… try again!')).toHaveCount(0, { timeout: 6000 });
  // The board is still there, with X's five lit, and the blue Play again button.
  await expect(square(page, 1)).toHaveClass(/caro-win/);
  await expect(playAgain(page)).toBeVisible({ timeout: 6000 });
  await playAgain(page).click();
  await expect(square(page, 1)).toHaveAttribute('aria-label', 'Square 1, empty');
});

test('the Caro card opens from the list with arrow keys and Enter', async ({ page }) => {
  await page.goto('/games');
  await expect(page.locator('.hm-view')).toBeFocused();
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Go to game 7' })).toHaveAttribute('aria-current', 'true');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/games\/caro$/);
  await page.getByRole('button', { name: /vs human/ }).click();
});

test('vs Robot: the right side is the prince again, the robot (X) starts by itself, and the child (O) plays after it', async ({ page }) => {
  await page.goto('/games');
  await page.getByRole('link', { name: 'Play Caro' }).click();
  await expect(page).toHaveURL(/\/games\/caro$/);
  await page.screenshot({ path: 'test-results/caro-pick.png' });
  await page.getByRole('button', { name: /vs Robot/ }).click();

  // The right side is the prince (the child is a girl), not a robot face.
  await expect(page.getByLabel('Player 2').locator('img')).toHaveAttribute('src', /prince\.webp/);
  // The e2e child is a girl (O): the robot plays X and makes the first move.
  await expect(page.locator('.caro-cell[aria-label$=", X"]')).toHaveCount(1, { timeout: 5000 });
  await expect(page.getByLabel('Player 1')).toHaveAttribute('aria-current', 'true');
  await page.screenshot({ path: process.env.ROBOT_SHOT ?? 'test-results/caro-robot.png' });
});
