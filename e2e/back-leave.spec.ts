import { expect, test } from '@playwright/test';
import { makeCards, reset } from './support/fixtures';

// Back on a game screen asks "Leave now?" only while the child is playing (the play screens). The pickers
// (game list, level and set lists) go back at once. Esc does what the button does: it asks on a play screen.

const PICKERS = ['/games/quiz', '/games/memory', '/games/find', '/games/spot'];
// `/games/quiz/<set>` is not here: the stand-in renders it empty (no questions), so it is covered by the unit test
// in tests/QuizQuestionFrame.test.tsx.
const PLAY = [
  '/games/caro',
  '/games/listen',
  '/games/sort',
  '/games/memory/12',
  '/games/find/00000000-0000-4000-b000-000000000001',
  '/games/spot/00000000-0000-4000-a000-000000000001',
];

const back = (page: import('@playwright/test').Page) => page.getByRole('link', { name: /^Back/ });
const ask = (page: import('@playwright/test').Page) => page.getByRole('dialog', { name: 'Leave now?' });

test.beforeEach(async () => {
  await reset({ memory_cards: makeCards(12) });
});

for (const url of PICKERS) {
  test(`${url}: Back goes back at once, with no question`, async ({ page }) => {
    await page.goto(url);
    await expect(back(page)).toHaveCount(1);
    await back(page).click();
    await expect(ask(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/games$/);
  });
}

for (const url of PLAY) {
  test(`${url}: Back asks "Leave now?"; No stays on the screen`, async ({ page }) => {
    await page.goto(url);
    await expect(back(page)).toHaveCount(1);
    await back(page).click();
    await expect(ask(page)).toBeVisible();
    await page.getByRole('button', { name: 'No' }).click();
    await expect(ask(page)).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`${url}$`));
  });
}

test('on a play screen Esc asks too; a second Esc closes the question and the child stays', async ({ page }) => {
  await page.goto('/games/caro');
  await expect(back(page)).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(ask(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(ask(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/games\/caro$/);
});
