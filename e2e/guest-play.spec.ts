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
  await page.getByRole('button', { name: 'Play now!' }).click();
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

// UI feedback (desktop first): the guest pages fit the window, X lets the child pick again, Back is a text link on Log in.
test.describe('guest UI on a desktop window', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the Boy / Girl step and the details step do not scroll', async ({ page }) => {
    await page.goto('/play/guest');
    const fits = () => page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight);
    expect(await fits()).toBe(true);
    await page.getByRole('button', { name: 'Girl' }).click();
    await expect(page.getByLabel("Child's name")).toBeVisible();
    expect(await fits()).toBe(true);
  });

  test('picking Girl: the avatar glides up once to a fixed spot, then the form rises; X runs it backwards', async ({ page }) => {
    await page.goto('/play/guest');
    const girl = page.getByRole('button', { name: 'Girl' });
    const head = page.locator('img[src*="princess-head"]').first();
    const before = (await head.boundingBox())!;
    await girl.click();
    // the avatar only moves up (never overshoots and comes back) and the form is not shown until it arrived
    const ys: number[] = [];
    for (let i = 0; i < 14; i++) { ys.push((await head.boundingBox())!.y); await page.waitForTimeout(60); }
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeLessThanOrEqual(ys[i - 1] + 2);
    await expect(page.getByLabel("Child's name")).toBeVisible();
    await page.waitForTimeout(1000);
    const avatar = (await head.boundingBox())!;
    expect(avatar.y).toBeLessThan(before.y);
    expect(avatar.width).toBeLessThan(before.width);
    expect(Math.abs(avatar.y - ys[ys.length - 1])).toBeLessThan(6); // it had already settled (the ring still breathes a little)
    const form = (await page.getByRole('heading', { name: 'Hi, Princess' }).boundingBox())!;
    expect(form.y).toBeGreaterThan(avatar.y + avatar.height - 1); // the form is below the avatar
    // X: the form goes, the avatar returns to its old place and size, Boy shows again
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('button', { name: 'Boy' })).toBeVisible();
    await expect(page.getByLabel("Child's name")).toHaveCount(0);
    await page.waitForTimeout(300);
    const after = (await head.boundingBox())!;
    expect(Math.abs(after.y - before.y)).toBeLessThan(8); // the ring breathes a little
    expect(Math.abs(after.width - before.width)).toBeLessThan(8);
  });

  test('after X the child can pick Girl again', async ({ page }) => {
    await page.goto('/play/guest');
    await page.getByRole('button', { name: 'Girl' }).click();
    await expect(page.getByLabel("Child's name")).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Girl' }).click();
    await expect(page.getByLabel("Child's name")).toBeVisible();
  });

  test('the Back on the guest step sits in the top-left corner of the screen', async ({ page }) => {
    await page.goto('/play/guest');
    const box = await page.getByRole('link', { name: 'Back' }).boundingBox();
    expect(box!.x).toBeLessThan(60);
    expect(box!.y).toBeLessThan(60);
  });

  test('the details form says Hi, Princess for a girl', async ({ page }) => {
    await page.goto('/play/guest');
    await page.getByRole('button', { name: 'Girl' }).click();
    await expect(page.getByRole('heading', { name: 'Hi, Princess' })).toBeVisible();
    const box = await page.getByRole('button', { name: 'Close' }).boundingBox();
    // the X does not overlap the heading text (its right edge, not the box)
    const textRight = await page.getByRole('heading', { name: 'Hi, Princess' }).evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getBoundingClientRect().right;
    });
    expect(box!.x).toBeGreaterThan(textRight);
  });

  test('the Back on the guest step goes to the chooser with no question', async ({ page }) => {
    await page.goto('/play/guest');
    await page.getByRole('link', { name: 'Back' }).click(); // the in-game round Back is a link
    await expect(page).toHaveURL(/\/play\/sign-in$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Log in shows a text Back that returns to the chooser', async ({ page }) => {
    await page.goto('/play/sign-in');
    await page.getByRole('button', { name: 'Log in' }).click();
    const back = page.getByRole('button', { name: 'Back' });
    await expect(back).toBeVisible();
    await expect(back).toHaveText(/Back/);
    await back.click();
    await expect(page.getByRole('link', { name: 'Play as guest' })).toBeVisible();
  });
});
