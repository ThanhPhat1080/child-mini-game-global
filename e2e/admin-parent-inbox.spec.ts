import { expect, test } from '@playwright/test';
import { reset, signInAsAdmin, signInAsSuper } from './support/fixtures';

// IN1-IN6, SA2: the parent sends from Inbox and sees the status; the Super Admin sees the parent's email.

test.beforeEach(async ({ page }) => {
  await reset();
  await signInAsAdmin(page);
});

test('the parent sends from Inbox and sees it as Sent; the Super Admin sees the parent contact', async ({ page, browser }) => {
  await page.getByRole('link', { name: 'Inbox' }).click();
  await expect(page).toHaveURL(/\/admin\/inbox$/);
  await expect(page.getByText(/This is your feedback mailbox\./)).toBeVisible();

  await page.getByLabel('Contact the Super Admin').fill('Please fix the sound');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Message sent. The Super Admin will read it.')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Please fix the sound' })).toContainText('Sent');

  const superContext = await browser.newContext();
  const superPage = await superContext.newPage();
  await signInAsSuper(superPage);
  await superPage.goto('/admin/messages');
  await expect(superPage.getByText('Please fix the sound')).toBeVisible();
  await expect(superPage.getByRole('link', { name: 'admin@test.local' })).toHaveAttribute('href', 'mailto:admin@test.local');
  await expect(superPage.getByText('No phone number')).toBeVisible();
  await superContext.close();
});
