import { expect, test } from '@playwright/test';
import { reset, SIGNED_OUT } from './support/fixtures';

test.use({ storageState: SIGNED_OUT });
test.beforeEach(async () => { await reset(); });

test('from the play sign-in to sign-up and back (FS3, FS6)', async ({ page }) => {
  await page.goto('/play/sign-in');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByRole('button', { name: 'How do I create an account?' }).click();
  await expect(page.getByText('Open the link we email you to confirm it.')).toBeVisible();
  await page.getByRole('link', { name: 'Sign up now' }).click();
  await expect(page).toHaveURL(/\/sign-up\?from=play$/);
  await page.getByRole('link', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/play\/sign-in$/);
});
