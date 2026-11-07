import { expect, test } from '@playwright/test';
import { CHILD, reset, signInAsAdmin } from './support/fixtures';

// PR6-PR12: a parent edits name and phone on Profile, and sees the children below. The old Children route redirects.

test.beforeEach(async ({ page }) => {
  await reset();
  await signInAsAdmin(page);
});

test('a parent saves name and phone on Profile, and sees the children below', async ({ page }) => {
  await page.getByRole('link', { name: 'Profile' }).click();
  await expect(page).toHaveURL(/\/admin\/profile$/);

  await page.getByLabel('Name').fill('Lan Anh');
  await page.getByLabel('Phone').fill('+84 912 345 678');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Profile saved.')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Name')).toHaveValue('Lan Anh');
  await expect(page.getByLabel('Phone')).toHaveValue('+84 912 345 678');
  await expect(page.getByRole('heading', { name: 'Your children' })).toBeVisible();
  await expect(page.getByTestId('child-card').first()).toContainText(CHILD.name);
});

test('/admin/children redirects to Profile', async ({ page }) => {
  await page.goto('/admin/children');
  await expect(page).toHaveURL(/\/admin\/profile$/);
});
