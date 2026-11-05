import { expect, test } from '@playwright/test';
import { CHILD, makeCards, makeFindLevels, makeSpotLevels, pickChild, reset } from './support/fixtures';

// Layout of the corner controls on a 1920x1080 screen (FP10, FP11, FP13).
test.use({ viewport: { width: 1920, height: 1080 } });

const SET = '00000000-0000-4000-c000-000000000001';
const FIND = makeFindLevels(1, 3)[0];
const SPOT = makeSpotLevels(1)[0];
const QUIZ_SET = {
  id: SET, title: 'Animals', subtitle: null, heading_color: '#5A4038', cover_path: null, status: 'published', position: 0,
  created_at: new Date(Date.UTC(2026, 0, 1)).toISOString(),
};

test.beforeEach(async () => {
  await reset({ memory_cards: makeCards(30), quiz_sets: [QUIZ_SET], find_levels: [FIND], spot_levels: [SPOT] });
});

// `/games/quiz/<set>` is not listed: it reads its questions through an embedded select that the stand-in does not
// serve, so the page renders empty. Its music button is the same component as on the other pages.
const PAGES = [
  '/', '/games', '/games/memory', '/games/memory/12', '/games/listen', '/games/sort', '/games/quiz',
  `/games/quiz/${SET}/done`, '/games/find', `/games/find/${FIND.id}`, '/games/spot', `/games/spot/${SPOT.id}`,
];

for (const path of PAGES) {
  test(`music button is bottom-right and clear on ${path} (FP10)`, async ({ page }) => {
    await page.goto(path);
    const music = page.getByRole('button', { name: /background music/i });
    await expect(music).toBeVisible();
    await page.waitForTimeout(800); // pictures and layouts settle
    await page.screenshot({ path: `test-results/corners${path.replace(/\W+/g, '-')}.png` });
    const { left, top, hits } = await music.evaluate((btn) => {
      const m = btn.getBoundingClientRect();
      const out: string[] = [];
      for (const el of document.querySelectorAll('button, a, input, img, [role="img"], [data-card]')) {
        if (el === btn || btn.contains(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.left < m.right && r.right > m.left && r.top < m.bottom && r.bottom > m.top) out.push(`${el.tagName}:${el.getAttribute('aria-label') ?? ''}`);
      }
      return { left: m.left, top: m.top, hits: out };
    });
    expect(left).toBeGreaterThan(1500);
    expect(top).toBeGreaterThan(800);
    expect(hits).toEqual([]);
  });
}

test('the leave button is on / and /games only (FP11)', async ({ page }) => {
  for (const p of ['/', '/games']) {
    await page.goto(p);
    await expect(page.getByRole('button', { name: 'Leave game' })).toBeVisible();
  }
  await page.goto('/games/quiz');
  await expect(page.getByRole('button', { name: /background music/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leave game' })).toHaveCount(0);
});

test('leave goes to the picker and coming back needs the PIN (FP13)', async ({ page }) => {
  await page.goto('/games');
  await page.getByRole('button', { name: 'Leave game' }).click();
  await page.getByRole('button', { name: 'Leave', exact: true }).click();
  await expect(page).toHaveURL(/\/play$/);
  await page.goto('/games');
  await expect(page).toHaveURL(/\/play$/); // no active child any more
  await pickChild(page); // the card and the PIN, then /games
  await expect(page).toHaveURL(/\/games$/);
});

test('the picker card and PIN look (FP5, FP7)', async ({ page }) => {
  await page.goto('/games');
  await page.getByRole('button', { name: 'Leave game' }).click();
  await page.getByRole('button', { name: 'Leave', exact: true }).click();
  const config = page.getByRole('button', { name: 'Parent configuration' });
  await expect(config).toHaveCSS('border-top-style', 'dashed');
  await expect(config).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page.getByRole('button', { name: CHILD.name, exact: true }).click();
  await page.getByLabel('PIN character 1').pressSequentially(CHILD.pin[0]);
  await expect(page.getByLabel('PIN character 1')).toHaveValue('*');
});
