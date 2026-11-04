import { expect, test, type Page } from '@playwright/test';
import { makeCards, reset } from './support/fixtures';

let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('console', (m) => {
    // the app has no favicon yet (not part of this screen); every other console error fails the test
    if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(`${m.text()} @ ${m.location().url}`);
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await reset({ memory_cards: makeCards(12) });
});
test.afterEach(() => {
  expect(errors).toEqual([]);
});

const root = (page: Page) => page.locator('[data-listen-play]');
const question = (page: Page) => page.locator('[data-question-index]');
const answers = (page: Page) => page.locator('[data-answer]');

/** Opens the game and waits for question 1 with its first answer focused (hydrated). */
async function open(page: Page) {
  await page.goto('/games/listen');
  await expect(question(page)).toHaveAttribute('data-question-index', '0');
  await expect(answers(page)).toHaveCount(3);
  await expect(answers(page).first()).toBeFocused();
}

/** 0-based position of the right answer, read from the DOM. */
async function rightIndex(page: Page): Promise<number> {
  const id = await question(page).getAttribute('data-answer-id');
  const ids = await answers(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-card-id')));
  const i = ids.indexOf(id);
  expect(i).toBeGreaterThanOrEqual(0);
  return i;
}

/** Plays every question with `pickRight`, checking the index moves on each time, until data-done. */
async function playRound(page: Page, count: number, pickRight: (i: number) => Promise<void>) {
  const seen = new Set<string>();
  for (let n = 0; n < count; n++) {
    await expect(question(page)).toHaveAttribute('data-question-index', String(n), { timeout: 6000 });
    seen.add((await question(page).getAttribute('data-answer-id'))!);
    await pickRight(await rightIndex(page));
  }
  await expect(root(page)).toHaveAttribute('data-done', 'true', { timeout: 8000 });
  await expect(answers(page)).toHaveCount(0);
  expect(seen.size).toBe(count);
}

test('a full 10-question round by mouse reaches the done state', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  await expect(root(page)).toHaveAttribute('data-done', 'false');
  await playRound(page, 10, (i) => answers(page).nth(i).click());
  await expect(page.getByRole('link', { name: 'Back to games' })).toBeVisible();
});

test('a full round by keys 1/2/3', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  await playRound(page, 10, (i) => page.keyboard.press(String(i + 1)));
});

test('a wrong pick dims that button and keeps the question; the right pick then moves on', async ({ page }) => {
  await open(page);
  const right = await rightIndex(page);
  const wrong = (right + 1) % 3;
  await answers(page).nth(wrong).click();
  await expect(answers(page).nth(wrong)).toHaveAttribute('data-wrong', 'true');
  await expect(answers(page).nth(right)).toHaveAttribute('data-wrong', 'false');
  await page.waitForTimeout(1500);
  await expect(question(page)).toHaveAttribute('data-question-index', '0');
  await page.keyboard.press(String(right + 1));
  await expect(question(page)).toHaveAttribute('data-question-index', '1', { timeout: 6000 });
  await expect(page.locator('[data-answer][data-wrong="true"]')).toHaveCount(0);
});

test('a wrong pick gets a soft grayscale, also while another answer is hovered', async ({ page }) => {
  await open(page);
  const right = await rightIndex(page);
  const wrong = (right + 1) % 3;
  await answers(page).nth(wrong).click();
  await expect(answers(page).nth(wrong)).toHaveAttribute('data-wrong', 'true');
  await answers(page).nth(right).hover();
  await expect(answers(page).nth(wrong)).toHaveCSS('filter', 'grayscale(0.5)');
});

test('a wrong pick shows the Oh-oh popup, then it goes away; the picks still work', async ({ page }) => {
  await open(page);
  const right = await rightIndex(page);
  const wrong = (right + 1) % 3;
  await answers(page).nth(wrong).click();
  await expect(page.locator('[data-feedback="wrong"]')).toBeVisible();
  await expect(answers(page).nth(wrong)).toHaveClass(/hm-wobble/);
  await expect(page.locator('[data-feedback="wrong"]')).toHaveCount(0, { timeout: 4000 });
  await expect(page.locator('[data-feedback="right"]')).toHaveCount(0);
});

test('a right pick shows the Hooray overlay; the next question has none', async ({ page }) => {
  await open(page);
  const right = await rightIndex(page);
  await answers(page).nth(right).click();
  await expect(page.locator('[data-feedback="right"]')).toBeVisible();
  await expect(answers(page).nth(right)).toHaveClass(/hm-picked/);
  await expect(question(page)).toHaveAttribute('data-question-index', '1', { timeout: 8000 });
  await expect(page.locator('[data-feedback]')).toHaveCount(0);
});

test('no card word is written on the play screen', async ({ page }) => {
  await open(page);
  await expect(page.getByText(/word\d+/)).toHaveCount(0);
  const html = await root(page).evaluate((e) => e.outerHTML);
  expect(html).not.toMatch(/word\d+/);
});

test('Esc returns to the game list', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/games$/);
});

test('the help badge opens the popup; its Esc closes only the popup', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'What is Listen & Pick? Show how to play' }).click();
  await expect(page.getByRole('dialog', { name: 'How to play Listen & Pick' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/games\/listen$/);
  await expect(question(page)).toHaveAttribute('data-question-index', '0');
});

test('2 cards: the friendly screen, no answers', async ({ page }) => {
  await reset({ memory_cards: makeCards(2) });
  await page.goto('/games/listen');
  await expect(page.getByRole('status', { name: 'New cards are coming soon' })).toBeVisible();
  await expect(answers(page)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Back to games' })).toBeVisible();
});

test('5 cards give a 5-question round', async ({ page }) => {
  test.setTimeout(90_000);
  await reset({ memory_cards: makeCards(5) });
  await open(page);
  await playRound(page, 5, (i) => answers(page).nth(i).click());
});

/** Plays `count` questions, making `wrongOn[n]` wrong picks on question n before the right one. */
async function playWithWrong(page: Page, count: number, wrongOn: Record<number, number> = {}) {
  for (let n = 0; n < count; n++) {
    await expect(question(page)).toHaveAttribute('data-question-index', String(n), { timeout: 6000 });
    const right = await rightIndex(page);
    for (const w of [0, 1, 2].filter((i) => i !== right).slice(0, wrongOn[n] ?? 0)) {
      await answers(page).nth(w).click();
      await expect(answers(page).nth(w)).toHaveAttribute('data-wrong', 'true');
    }
    await answers(page).nth(right).click();
  }
  await expect(root(page)).toHaveAttribute('data-done', 'true', { timeout: 8000 });
}

const wrongLine = (page: Page) => page.locator('[data-wrong-line]');
const wrongItems = (page: Page) => page.locator('[data-wrong-item]');

test.describe('finish screen (L6, L7)', () => {
  test.beforeEach(async () => { await reset({ memory_cards: makeCards(5) }); });

  test('two wrong picks on one question and one on another end with "Wrong 3 times" and a list with x2', async ({ page }) => {
    test.setTimeout(90_000);
    await open(page);
    await playWithWrong(page, 5, { 0: 2, 1: 1 });
    await expect(page.locator('[data-listen-done]')).toBeVisible();
    await expect(wrongLine(page)).toHaveText('Wrong 3 times');
    await expect(page.locator('[data-wrong-total]')).toHaveText('3');
    await expect(wrongItems(page)).toHaveCount(2);
    await expect(wrongItems(page).first()).toContainText('x2');
    await expect(wrongItems(page).last()).not.toContainText('x');
    await expect(page.getByRole('button', { name: 'Play again' })).toBeFocused();
  });

  test('a perfect round shows "Wrong 0 times" and no list', async ({ page }) => {
    test.setTimeout(90_000);
    await open(page);
    await playWithWrong(page, 5);
    await expect(wrongLine(page)).toHaveText('Wrong 0 times');
    await expect(page.locator('[data-wrong-list]')).toHaveCount(0);
  });

  test('Play again starts a new round and the next finish starts from 0', async ({ page }) => {
    test.setTimeout(120_000);
    await open(page);
    await playWithWrong(page, 5, { 2: 1 });
    await expect(wrongLine(page)).toHaveText('Wrong 1 times');
    await page.getByRole('button', { name: 'Play again' }).click();
    await expect(root(page)).toHaveAttribute('data-done', 'false');
    await expect(question(page)).toHaveAttribute('data-question-index', '0');
    await expect(answers(page)).toHaveCount(3);
    await playWithWrong(page, 5);
    await expect(wrongLine(page)).toHaveText('Wrong 0 times');
    await expect(page.locator('[data-wrong-list]')).toHaveCount(0);
  });

  test('leaving to /games clears the log and coming back starts from 0', async ({ page }) => {
    test.setTimeout(120_000);
    await open(page);
    await playWithWrong(page, 5, { 0: 2 });
    await expect(wrongLine(page)).toHaveText('Wrong 2 times');
    expect(await page.evaluate(() => localStorage.getItem('hamy.listen.wrong'))).not.toBeNull();
    await page.getByRole('link', { name: 'Back to games' }).click();
    await expect(page).toHaveURL(/\/games$/);
    expect(await page.evaluate(() => localStorage.getItem('hamy.listen.wrong'))).toBeNull();
    await open(page);
    await playWithWrong(page, 5);
    await expect(wrongLine(page)).toHaveText('Wrong 0 times');
  });

  test('on the finish Esc goes to /games and the arrows move between the two buttons', async ({ page }) => {
    test.setTimeout(90_000);
    await open(page);
    await playWithWrong(page, 5);
    await expect(page.locator('[data-listen-done][data-keys="ready"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play again' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('link', { name: 'Back to games' })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('button', { name: 'Play again' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/games$/);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the root carries hm-reduced and the game still plays', async ({ page }) => {
    await open(page);
    await expect(root(page)).toHaveClass(/hm-reduced/);
    await answers(page).nth(await rightIndex(page)).click();
    await expect(question(page)).toHaveAttribute('data-question-index', '1', { timeout: 6000 });
  });
});
