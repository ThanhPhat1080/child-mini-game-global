import { expect, test } from '@playwright/test';
import { reset, signInAsAdmin, STANDIN } from './support/fixtures';

test.beforeEach(async () => {
  await reset();
});

test('the game list shows the Quiz card', async ({ page }) => {
  await page.goto('/games');
  await expect(page.getByRole('link', { name: 'Play Quiz' })).toBeVisible();
});

test('admin pages redirect to sign-in when signed out', async ({ page }) => {
  await page.goto('/admin/cards');
  await expect(page).toHaveURL(/\/admin\/sign-in$/);
});

test('after sign-in the sets page loads with a session cookie', async ({ page, context }) => {
  await signInAsAdmin(page);
  const cookies = await context.cookies();
  expect(cookies.some((c) => /^sb-.*auth-token/.test(c.name))).toBe(true);
  await page.goto('/admin/sets');
  await expect(page).toHaveURL(/\/admin\/sets$/);
  await expect(page.getByRole('heading', { name: 'Quiz sets' })).toBeVisible();
});

test('a wrong password shows an error and stays on sign-in', async ({ page }) => {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Email').fill('admin@test.local');
  await page.getByLabel('Password').fill('nope');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Wrong email or password.')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/sign-in$/);
});

test('stand-in storage round-trips an upload with its content type', async ({ page }) => {
  await page.goto('/admin/sign-in'); // any page on the app origin, for the CORS-enabled browser client
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="#f00"/></svg>';
  const result = await page.evaluate(
    async ({ base, svg }) => {
      // Same shape supabase-js uses: FormData with cacheControl and the file Blob.
      const fd = new FormData();
      fd.append('cacheControl', '3600');
      fd.append('', new File([svg], 'a.svg', { type: 'image/svg+xml' }));
      const up = await fetch(`${base}/storage/v1/object/media/t/a.svg`, { method: 'POST', body: fd });
      const got = await fetch(`${base}/storage/v1/object/public/media/t/a.svg`);
      return { up: up.status, type: got.headers.get('content-type'), text: await got.text() };
    },
    { base: STANDIN, svg },
  );
  expect(result.up).toBe(200);
  expect(result.type).toBe('image/svg+xml');
  expect(result.text).toBe(svg);
});

test('the stand-in rejects filters it does not support', async () => {
  const res = await fetch(`${STANDIN}/rest/v1/memory_cards?or=(active.eq.true)`);
  expect(res.status).toBe(501);
  const del = await fetch(`${STANDIN}/rest/v1/memory_cards`, { method: 'DELETE' });
  expect(del.status).toBe(400);
});
