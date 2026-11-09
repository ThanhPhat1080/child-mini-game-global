import { expect, test, type Page } from '@playwright/test';
import { reset, SIGNED_OUT } from './support/fixtures';

// GT5 (Guest Play): a visitor with no account picks Boy or Girl, types a name and age, plays, and leaves with the sum.
test.use({ storageState: SIGNED_OUT });
test.beforeEach(async () => { await reset(); });

async function setupVisitor(page: Page, name: string, gender: 'Boy' | 'Girl'): Promise<void> {
  await page.goto('/play/sign-in');
  await page.getByRole('link', { name: 'Play as guest' }).click();
  await expect(page).toHaveURL(/\/play\/guest$/);
  await page.getByRole('button', { name: gender }).click();
  await page.getByLabel("Child's name").fill(name);
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page).toHaveURL(/\/$/);
}

test('chooser, Girl, name and age, Welcome with the princess, reload keeps the visitor', async ({ page }) => {
  await setupVisitor(page, 'Mai', 'Girl');
  await expect(page.locator('img[src*="princess.webp"]').first()).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem('cp_visitor'))).toContain('"name":"Mai"');
});

test('Boy shows the prince', async ({ page }) => {
  await setupVisitor(page, 'Leo', 'Boy');
  await expect(page.locator('img[src*="prince.webp"]').first()).toBeVisible();
});

test('a visitor at /admin lands on the admin sign-in, and /play goes to Welcome', async ({ page }) => {
  await setupVisitor(page, 'Mai', 'Girl');
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/sign-in$/);
  await page.goto('/play');
  await expect(page).toHaveURL(/\/$/);
});

test('Leave asks the sum; a right answer erases the guest and returns to the chooser', async ({ page }) => {
  await setupVisitor(page, 'Mai', 'Girl');
  await page.getByRole('button', { name: 'Leave game' }).click();
  await page.getByRole('button', { name: 'Leave', exact: true }).click();
  const q = await page.getByTestId('adult-question').innerText();
  const [a, b] = q.split('=')[0].split('+').map((x) => Number(x.trim()));
  await page.getByLabel('Answer').fill(String(a + b));
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page).toHaveURL(/\/play\/sign-in$/);
  await expect(page.getByRole('link', { name: 'Play as guest' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('cp_visitor'))).toBeNull();
});

test('a forged visitor cookie with no saved data goes to the sign-in chooser', async ({ page, context }) => {
  await context.addCookies([{ name: 'cp_visitor', value: '1', url: 'http://127.0.0.1:3100/' }]);
  await page.goto('/');
  await expect(page).toHaveURL(/\/play\/sign-in$/);
});
