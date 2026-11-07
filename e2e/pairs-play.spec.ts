import { expect, test, type Locator, type Page } from '@playwright/test';
import { getState, reset } from './support/fixtures';

// Puzzle Pairs (H1-H12): the board of halves, the question modal, the drag and join, the finish and New level.
// The default state has the four seed pictures (fish, triangle, house, apple) and 18 cards, so every question is Listen & Pick.

let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('console', (m) => {
    // the app has no favicon yet (not part of this screen); every other console error fails the test
    if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(`${m.text()} @ ${m.location().url}`);
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await reset();
});
test.afterEach(() => {
  expect(errors).toEqual([]);
});

const root = (page: Page) => page.locator('[data-pairs-play]');
const pieces = (page: Page) => page.locator('[data-piece]');
const piece = (page: Page, id: string) => page.locator(`[data-piece="${id}"]`);
const hit = (page: Page, id: string) => page.locator(`[data-piece="${id}"] [data-hit]`);
const faceUp = (page: Page) => page.locator('[data-piece][data-up="true"]');
const shelfFilled = (page: Page) => page.locator('[data-shelf-place][data-filled="true"]');
const dialog = (page: Page) => page.getByRole('dialog');
const answers = (page: Page) => dialog(page).locator('[data-answer]');
const rightFeedback = (page: Page) => page.locator('[data-feedback="right"]');
const isLeft = (id: string) => id.endsWith(':L');
/** The picture id of a half id (`pp-fish:L` -> `pp-fish`). */
const pictureOf = (id: string) => id.slice(0, id.lastIndexOf(':'));

/** Opens the game and waits until the level is dealt (8 face-down halves). */
async function open(page: Page) {
  await page.goto('/games/pairs');
  await expect(root(page)).toHaveAttribute('data-phase', 'play');
  await expect(pieces(page)).toHaveCount(8);
  await expect(faceUp(page)).toHaveCount(0);
}

/** The halves on the board, as ids. */
async function boardIds(page: Page): Promise<string[]> {
  return pieces(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-piece') ?? ''));
}

/** Waits until a box stops moving (the board animates after a join or a flip). */
async function settle(loc: Locator) {
  let last = '';
  await expect.poll(async () => {
    const now = JSON.stringify(await loc.boundingBox());
    const still = now === last;
    last = now;
    return still;
  }, { timeout: 5000, intervals: [100] }).toBe(true);
}

/**
 * Clicks a half on its visible part. Playwright's default click point is the centre of the 336 box, which for an R half
 * is inside the jigsaw notch (x 168..201), outside the clipped shape, so the click would fall through to the background.
 */
async function clickHalf(page: Page, id: string) {
  const hitEl = hit(page, id);
  const b = (await hitEl.boundingBox())!;
  await hitEl.click({ position: { x: b.width * (isLeft(id) ? 0.25 : 0.75), y: b.height / 2 } });
}

/** Clicks the visible part of a face-down half and waits for its question. */
async function openHalf(page: Page, id: string) {
  await clickHalf(page, id);
  await expect(dialog(page)).toBeVisible();
}

/** Tries answers 1, 2, 3 in turn until the modal closes; a wrong pick only dims that answer, so this ends on the right one. */
async function answerRight(page: Page) {
  for (const i of [0, 1, 2]) {
    if ((await dialog(page).count()) === 0) break;
    if ((await rightFeedback(page).count()) > 0) break; // the right pick is already celebrated
    if ((await answers(page).nth(i).getAttribute('data-wrong')) === 'true') continue;
    await answers(page).nth(i).click();
  }
  await expect(dialog(page)).toHaveCount(0, { timeout: 6000 });
}

/** Waits until the half is face up and its flip is over (the flip shows a back face until then). */
async function expectTurned(page: Page, id: string) {
  await expect(piece(page, id)).toHaveAttribute('data-up', 'true');
  await expect(piece(page, id).locator('[data-face="back"]')).toHaveCount(0);
}

/** Turns a half over: opens its question and answers it right. */
async function turnHalf(page: Page, id: string) {
  await openHalf(page, id);
  await answerRight(page);
  await expectTurned(page, id);
}

/** Where to press a face-up half: the middle of its visible part. */
async function grab(page: Page, id: string) {
  const box = (await hit(page, id).boundingBox())!;
  return { x: box.x + box.width * (isLeft(id) ? 0.25 : 0.75), y: box.y + box.height / 2 };
}

/** Drags one face-up half onto another (10 steps), then releases. */
async function drag(page: Page, from: string, to: string) {
  await settle(hit(page, from));
  await settle(hit(page, to));
  const a = await grab(page, from);
  const b = await grab(page, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 10 });
  await page.mouse.up();
}

test('the level opens with 8 face-down halves of 4 pictures, two halves each', async ({ page }) => {
  await open(page);
  const ids = await boardIds(page);
  const pictures = new Set(ids.map(pictureOf));
  expect(pictures.size).toBe(4);
  for (const p of pictures) {
    expect(ids).toContain(`${p}:L`);
    expect(ids).toContain(`${p}:R`);
  }
  await expect(shelfFilled(page)).toHaveCount(0);
});

test('a question closed with X leaves the half face down; the next try turns it', async ({ page }) => {
  await open(page);
  const [id] = await boardIds(page);

  await openHalf(page, id);
  await dialog(page).getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(piece(page, id)).toHaveAttribute('data-up', 'false');
  await expect(faceUp(page)).toHaveCount(0);

  await turnHalf(page, id);
  await expect(faceUp(page)).toHaveCount(1);
});

test('a wrong pick dims only that answer and the question stays open until the right one', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page);
  // Which answer is right is random: try the first answer on each half until one of them is wrong.
  let sawWrong = false;
  for (const id of await boardIds(page)) {
    await openHalf(page, id);
    const first = answers(page).nth(0);
    await first.click();
    if ((await first.getAttribute('data-wrong')) !== 'true') {
      // it was the right one: the half turns and the next half is tried
      await expectTurned(page, id);
      continue;
    }
    sawWrong = true;
    await expect(first).toHaveAttribute('aria-disabled', 'true');
    await expect(answers(page).nth(1)).toHaveAttribute('data-wrong', 'false');
    await expect(page.locator('[data-feedback="wrong"]')).toBeVisible();
    await expect(dialog(page)).toBeVisible();
    await expect(piece(page, id)).toHaveAttribute('data-up', 'false');
    await answerRight(page);
    await expectTurned(page, id);
    break;
  }
  expect(sawWrong).toBe(true);
});

test('a wrong join slides back and nothing reaches the shelf', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page);
  const ids = await boardIds(page);
  const first = ids[0];
  const other = ids.find((id) => pictureOf(id) !== pictureOf(first))!;
  // turn one half of each of two pictures: two face-up halves that do not match
  await turnHalf(page, first);
  await turnHalf(page, other);
  await expect(faceUp(page)).toHaveCount(2);

  await settle(hit(page, first));
  const before = (await hit(page, first).boundingBox())!;
  await drag(page, first, other);

  // both stay face up, the board still has its 8 halves, nothing is on the shelf
  await expect(faceUp(page)).toHaveCount(2);
  await expect(pieces(page)).toHaveCount(8);
  await expect(shelfFilled(page)).toHaveCount(0);
  // the dragged half slides back to where it was
  await expect.poll(async () => {
    const now = (await hit(page, first).boundingBox())!;
    return Math.abs(now.x - before.x) < 2 && Math.abs(now.y - before.y) < 2;
  }, { timeout: 5000 }).toBe(true);
});

test('the full level: four right joins finish it, and New level deals 8 face-down halves', async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  const pictures = [...new Set((await boardIds(page)).map(pictureOf))];

  for (const p of pictures) {
    await turnHalf(page, `${p}:L`);
    await turnHalf(page, `${p}:R`);
  }
  await expect(faceUp(page)).toHaveCount(8);
  await expect(shelfFilled(page)).toHaveCount(0);

  // join each picture: its left half onto its right half; the shelf fills one place at a time
  for (const [k, p] of pictures.entries()) {
    await drag(page, `${p}:L`, `${p}:R`);
    if (k < pictures.length - 1) await expect(shelfFilled(page)).toHaveCount(k + 1, { timeout: 8000 });
  }

  // the finish screen: praise, the 4 finished pictures, New level and Back to games
  await expect(page.getByRole('button', { name: 'New level' })).toBeVisible({ timeout: 8000 });
  await expect(page.locator('[data-done-picture]')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Back to games' })).toBeVisible();
  await expect(root(page)).toHaveAttribute('data-phase', 'done');

  await page.getByRole('button', { name: 'New level' }).click();
  await expect(root(page)).toHaveAttribute('data-phase', 'play', { timeout: 8000 });
  await expect(pieces(page)).toHaveCount(8);
  await expect(faceUp(page)).toHaveCount(0);
  await expect(shelfFilled(page)).toHaveCount(0);
});

test('fewer than 4 pictures with different words: a friendly screen and no halves', async ({ page }) => {
  const seed = (await getState()).puzzle_pictures;
  await reset({ puzzle_pictures: seed.slice(0, 3) });
  await page.goto('/games/pairs');
  await expect(root(page)).toHaveAttribute('data-phase', 'empty');
  await expect(page.getByRole('status', { name: 'New pictures are coming soon' })).toBeVisible();
  await expect(pieces(page)).toHaveCount(0);
});
