import { expect, test, type Page } from '@playwright/test';
import { pickChild, reset, SIGNED_OUT, signInOnDevice } from './support/fixtures';

// NS1-NS4: child screens paint no text selection and drag no picture ghost; inputs keep normal selection.
test.use({ storageState: SIGNED_OUT });
test.beforeEach(async () => { await reset(); });

async function dragAcross(page: Page): Promise<void> {
  await page.mouse.move(100, 100);
  await page.mouse.down();
  await page.mouse.move(1200, 700, { steps: 10 });
  await page.mouse.up();
}

test('dragging over Welcome selects nothing (NS1)', async ({ page }) => {
  await signInOnDevice(page);
  await pickChild(page);
  await page.goto('/');
  await dragAcross(page);
  expect(await page.evaluate(() => String(window.getSelection()))).toBe('');
});

test('dragging over the game list selects nothing (NS1)', async ({ page }) => {
  await signInOnDevice(page);
  await pickChild(page);
  await page.goto('/games');
  await dragAcross(page);
  expect(await page.evaluate(() => String(window.getSelection()))).toBe('');
});

test('pictures on child screens are not draggable (NS3)', async ({ page }) => {
  await signInOnDevice(page);
  await pickChild(page);
  await page.goto('/');
  // Welcome shows the hero picture (app/page.tsx), a Pic
  const hero = page.locator('.hm-child img').first();
  await expect(hero).toBeVisible();
  expect(await hero.getAttribute('draggable')).toBe('false');
});

test('the email field keeps normal text selection (NS4)', async ({ page }) => {
  await page.goto('/play/sign-in');
  await page.getByRole('button', { name: 'Log in' }).click();
  // type=email has no selection API, so read the computed rule: inputs under .hm-child get user-select: text
  const email = page.getByLabel('Email');
  await expect(email).toBeVisible();
  expect(await email.evaluate((el) => getComputedStyle(el).userSelect)).toBe('text');
});
