import { expect, test, type Browser, type Page } from '@playwright/test';
import { ACCOUNTS, getState, makeCards, pickChild, reset, SIGNED_OUT, signInAsAdmin, signInAsSuper, signInOnDevice } from './support/fixtures';

// Wiring only (T4, T5): who may do what is proven by the real-Postgres suite (npm run test:rls).

test.beforeEach(async () => {
  await reset();
});

/** A fresh, signed-out browser context. */
async function signedOut(browser: Browser): Promise<Page> {
  return (await browser.newContext({ storageState: SIGNED_OUT })).newPage();
}

test('a parent signs up through the policy carousel', async ({ browser }) => {
  const page = await signedOut(browser);
  await page.goto('/sign-up');
  await page.getByLabel('Email').fill('new.parent@test.local');
  await page.getByLabel('Password').fill('longenough1');
  await page.getByRole('button', { name: 'Create account' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const register = dialog.getByRole('button', { name: 'Register' });
  for (let i = 0; i < 12 && (await register.isDisabled()); i++) await dialog.getByRole('button', { name: 'Next' }).click();
  await register.click();
  await expect(page.getByText('Check your email to confirm your account')).toBeVisible();
  const { profiles } = await getState();
  expect(profiles.some((p) => p.role === 'parent' && p.display_name === null)).toBe(true);
});

test('a parent adds a child; the child picks the card, types the PIN and stays in after a reload', async ({ browser }) => {
  const parent = await signedOut(browser);
  await signInAsAdmin(parent);
  await parent.getByRole('button', { name: /add child/i }).first().click();
  const modal = parent.getByRole('dialog');
  await modal.getByRole('button', { name: /Girl/ }).click();
  await modal.getByLabel('Display name').fill('Mia');
  await modal.getByLabel('Login name').fill('Mia');
  await modal.getByLabel('PIN', { exact: true }).fill('ab12');
  await modal.getByRole('button', { name: '2-5' }).click();
  await modal.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(async () => (await getState()).children.some((c) => c.display_name === 'Mia')).toBe(true);

  // the same parent session on the play device: pick Mia, type the PIN
  await signInOnDevice(parent);
  await pickChild(parent, 'Mia', 'ab12');
  await parent.reload();
  await expect(parent).toHaveURL(/\/games$/);
});

test('Parent Configuration needs the adult check', async ({ page }) => {
  await page.goto('/play');
  await page.getByRole('button', { name: 'Parent configuration' }).click();
  const q = await page.getByTestId('adult-question').innerText();
  const [a, b] = q.split('=')[0].split('+').map((x) => Number(x.trim()));
  await page.getByLabel('Answer').fill(String(a + b));
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page).toHaveURL(/\/admin/);
});

test('deleting the active child sends the device back to the picker', async ({ page }) => {
  await page.goto('/games');
  await expect(page).toHaveURL(/\/games$/);
  await reset({ children: [] });
  await page.goto('/games');
  await expect(page).toHaveURL(/\/play$/);
});

test('signing out of the play device needs the adult check', async ({ page }) => {
  await page.goto('/play');
  await page.getByRole('button', { name: 'Sign out (grown-ups)' }).click();
  const q = await page.getByTestId('adult-question').innerText();
  const [a, b] = q.split('=')[0].split('+').map((x) => Number(x.trim()));
  await page.getByLabel('Answer').fill(String(a + b));
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page).toHaveURL(/\/admin\/sign-in$/);
});

test('share, approve, ban: the whole review loop', async ({ browser }) => {
  await reset({ memory_cards: makeCards(2) });

  // The parent shares card 1: it becomes "Under review".
  const parent = await signedOut(browser);
  await signInAsAdmin(parent);
  await parent.goto('/admin/cards');
  const sw = parent.getByRole('switch', { name: 'Share with all children' }).first();
  if (!(await sw.isVisible())) await parent.getByRole('article', { name: 'Card 1', exact: true }).locator('summary').click();
  await sw.click();
  await expect.poll(async () => (await getState()).memory_cards.filter((c) => c.visibility === 'pending').length).toBe(1);
  await parent.reload();
  await expect(parent.getByText('Under review').first()).toBeVisible();

  // The Super Admin approves it from the queue.
  const sa = await signedOut(browser);
  await signInAsSuper(sa);
  await sa.getByRole('button', { name: /^Approve/ }).first().click();
  await expect.poll(async () => (await getState()).memory_cards.filter((c) => c.visibility === 'global').length).toBe(1);

  // The child sees it under Everyone.
  const child = await signedOut(browser);
  await signInOnDevice(child);
  await pickChild(child);
  await child.getByRole('button', { name: /everyone/i }).click();
  await expect.poll(() => child.evaluate(() => localStorage.getItem('childPlayer:scope'))).toBe('global');

  // The Super Admin bans the parent with a reason: the parent is sent to the suspended page, the child still plays.
  await sa.goto('/admin/parents');
  await sa.getByRole('button', { name: /^Ban/ }).first().click();
  await sa.getByRole('dialog').getByRole('combobox').selectOption({ index: 1 });
  await sa.getByRole('dialog').getByRole('button', { name: /^Ban/ }).click();
  await expect.poll(async () => (await getState()).profiles.find((p) => p.user_id === ACCOUNTS.parent.id)?.banned).toBe(true);
  await parent.goto('/admin/cards');
  await expect(parent).toHaveURL(/\/admin\/suspended$/);
  await child.goto('/games');
  await expect(child).toHaveURL(/\/games$/);

  // The parent contacts the Super Admin.
  await parent.getByRole('textbox').fill('Please look at my account again.');
  await parent.getByRole('button', { name: /send/i }).click();
  await expect.poll(async () => (await getState()).support_messages.length).toBe(1);
});
