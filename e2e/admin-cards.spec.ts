import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { getState, makeCards, reset, signInAsAdmin, STANDIN } from './support/fixtures';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><circle cx="4" cy="4" r="3" fill="#E59AA1"/></svg>';
/** Pastes SVG code into one card's "Or paste SVG code" box and uses it (the picture becomes a local preview until Save). */
async function pasteCardSvg(page: Page, n: number, svg = SVG) {
  const card = page.getByRole('article', { name: `Card ${n}`, exact: true });
  await card.locator('summary').click();
  await card.getByLabel(`SVG code for card ${n}`, { exact: true }).fill(svg);
  await card.getByRole('button', { name: `Use SVG for card ${n}`, exact: true }).click();
}

type CardRow = { id: string; word: string; image_path: string | null; active: boolean };
const cardsOf = async () => (await getState()).memory_cards as CardRow[];
const storage = async () => ((await getState()) as unknown as { storage: string[] }).storage;

/** Puts a file straight into the stand-in bucket (as if an earlier Save had uploaded it). */
async function putFile(path: string): Promise<void> {
  const fd = new FormData();
  fd.append('', new File([SVG], 'f.svg', { type: 'image/svg+xml' }));
  const res = await fetch(`${STANDIN}/storage/v1/object/media/${path}`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
}

/** Opens the Cards page and waits until the cards are loaded (the client fetch only runs after hydration). */
async function openCards(page: Page): Promise<void> {
  await page.goto('/admin/cards');
  await expect(page.getByRole('button', { name: 'Add card' })).toBeVisible();
}

const health = (page: Page) => page.getByTestId('pool-health');
const save = (page: Page) => page.getByRole('button', { name: 'Save' });

test.beforeEach(async ({ page }) => {
  await reset({ memory_cards: makeCards(12) });
  await signInAsAdmin(page);
});

test('the admin nav links to the Cards page', async ({ page }) => {
  await page.getByRole('link', { name: 'Cards' }).click();
  await expect(page).toHaveURL(/\/admin\/cards$/);
  await expect(page.getByRole('link', { name: 'Cards' })).toHaveAttribute('aria-current', 'page');
});

test('add a card with a picture and a word: nothing is uploaded until Save, then it persists', async ({ page }) => {
  await openCards(page);
  await page.getByRole('button', { name: 'Add card' }).click();
  await expect(save(page)).toBeDisabled(); // the new card has no picture or word yet
  await pasteCardSvg(page, 1); // new cards go to the top
  await page.getByLabel('Word for card 1', { exact: true }).fill('lion');
  await expect(page.getByRole('img', { name: 'Card 1 picture' })).toHaveAttribute('src', /^blob:/);
  await expect(save(page)).toBeEnabled();
  expect(await storage()).toEqual([]); // picking is only a local preview
  expect((await cardsOf()).some((c) => c.word === 'lion')).toBe(false);

  await save(page).click();
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible();
  await expect(save(page)).toBeDisabled();

  const lion = (await cardsOf()).find((c) => c.word === 'lion');
  expect(lion?.image_path).toMatch(/^[0-9a-f-]{36}\/cards\/.+\.svg$/);
  expect(lion?.active).toBe(true);
  expect(await storage()).toEqual([lion!.image_path]);

  await page.reload();
  await expect(page.getByLabel('Word for card 1', { exact: true })).toHaveValue('lion'); // newest first
  await expect(page.getByRole('img', { name: 'Card 1 picture' })).toHaveAttribute('src', new RegExp(`/storage/v1/object/public/media/${lion!.image_path}$`));
});

test('Revert discards unsaved edits', async ({ page }) => {
  await openCards(page);
  await page.getByLabel('Word for card 1', { exact: true }).fill('changed');
  await page.getByRole('button', { name: 'Add card' }).click();
  await expect(page.getByLabel('Word for card 13', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Word for card 1', { exact: true })).toHaveValue(''); // the new card is on top
  await page.getByRole('button', { name: 'Revert' }).click();
  await expect(page.getByLabel('Word for card 1', { exact: true })).toHaveValue('word12'); // newest first
  await expect(page.getByLabel('Word for card 13', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Revert' })).toBeDisabled();
  expect((await cardsOf()).map((c) => c.word)).toEqual(makeCards(12).map((c) => c.word));
});

test('turning a card off lowers the available levels, and Save stores it', async ({ page }) => {
  await openCards(page);
  await expect(health(page)).toHaveText('12 active cards: levels 12, 16, 20 and 24 are available; 30 needs 15.');
  await page.getByRole('switch', { name: 'Card 1 on' }).click();
  await expect(health(page)).toHaveText('11 active cards: levels 12, 16 and 20 are available; 24 needs 12, 30 needs 15.');
  await save(page).click();
  await expect(save(page)).toBeDisabled();
  await expect.poll(async () => (await cardsOf()).find((c) => c.word === 'word12')?.active).toBe(false);
});

test('Delete asks first and removes the row and its bucket file only after Save', async ({ page }) => {
  const rows = makeCards(3);
  rows[0] = { ...rows[0], image_path: 'cards/old.svg' };
  await reset({ memory_cards: rows });
  await putFile('cards/old.svg');
  await putFile('seed/apple.svg'); // bundled art is never ours to delete, even if a file had that name
  await openCards(page);

  // newest first: word3, word2, word1, so word1 (cards/old.svg) is card 3
  await page.getByRole('button', { name: 'Delete card 3' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByLabel('Word for card 3', { exact: true })).toHaveValue('word1');

  await page.getByRole('button', { name: 'Delete card 3' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete card' }).click();
  await expect(page.getByLabel('Word for card 3', { exact: true })).toHaveCount(0);
  // staged only: the database and the bucket are untouched until Save
  expect((await cardsOf()).map((c) => c.word)).toEqual(['word1', 'word2', 'word3']);
  expect((await storage()).sort()).toEqual(['cards/old.svg', 'seed/apple.svg']);

  // a card using bundled art goes too; its seed/ file must stay
  await page.getByRole('button', { name: 'Delete card 2' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete card' }).click();

  await save(page).click();
  await expect(save(page)).toBeDisabled();
  await expect.poll(async () => (await cardsOf()).map((c) => c.word)).toEqual(['word3']);
  await expect.poll(storage).toEqual(['seed/apple.svg']);
});

const importFile = (name: string, body: unknown) => ({ name, mimeType: 'application/json', buffer: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)) });
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Quick import cards' });

async function importThroughDialog(page: Page, file: ReturnType<typeof importFile>): Promise<void> {
  await page.getByRole('button', { name: 'Quick import cards' }).click();
  await expect(dialog(page)).toBeVisible();
  await dialog(page).locator('input[type="file"]').setInputFiles(file);
}

test('importing the shipped template: blank pictures keep Save disabled until picked, then Save stores the cards', async ({ page }) => {
  await reset({ memory_cards: [] });
  await openCards(page);
  await importThroughDialog(page, { name: 'memory-cards-template.json', mimeType: 'application/json', buffer: readFileSync('public/memory-cards-template.json') });
  await expect(dialog(page).getByText('3 cards ready to import.')).toBeVisible();
  await dialog(page).getByRole('button', { name: 'Import 3 cards' }).click();
  await expect(dialog(page)).toHaveCount(0);

  await expect(page.getByLabel('Word for card 1', { exact: true })).toHaveValue('apple');
  await expect(page.getByLabel('Word for card 3', { exact: true })).toHaveValue('cat');
  await expect(page.getByRole('img', { name: 'Card 3 picture' })).toHaveAttribute('src', /^blob:/); // SVG code became a local preview
  await expect(page.getByText('2 cards need a picture and a word before you can save.')).toBeVisible();
  await expect(save(page)).toBeDisabled();
  expect(await cardsOf()).toEqual([]); // unsaved

  await pasteCardSvg(page, 1);
  await expect(save(page)).toBeDisabled();
  await pasteCardSvg(page, 2);
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible();
  await expect.poll(async () => (await cardsOf()).map((c) => c.word).sort()).toEqual(['apple', 'banana', 'cat']);
  for (const c of await cardsOf()) expect(c.image_path).toMatch(/^[0-9a-f-]{36}\/cards\/.+\.svg$/);
});

test('a file with one bad card imports nothing and names the card', async ({ page }) => {
  await openCards(page);
  await importThroughDialog(page, importFile('bad.json', { cards: [{ word: 'fine', image: '' }, { word: '', image: '' }, { word: 'ok', active: 'yes' }] }));
  const alert = dialog(page).getByRole('alert');
  await expect(alert).toContainText('Card 2: word is required');
  await expect(alert).toContainText('Card 3: active must be true or false');
  await expect(dialog(page).getByRole('button', { name: 'Import', exact: true })).toBeDisabled();
  await dialog(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByLabel('Word for card 13', { exact: true })).toHaveCount(0);
  await expect(save(page)).toBeDisabled();
  expect((await cardsOf()).map((c) => c.word)).toEqual(makeCards(12).map((c) => c.word));
});

test('imported cards (SVG code) can be saved and played from /games/memory', async ({ page }) => {
  await reset({ memory_cards: [] });
  await openCards(page);
  const colors = ['#E59AA1', '#9AC3E5', '#F2DB8C', '#A8D5A2', '#C9A8E5', '#F2B48C'];
  const cards = colors.map((fill, i) => ({
    word: `shape${i + 1}`,
    image: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'><circle cx='4' cy='4' r='3' fill='${fill}'/></svg>`,
    audio: '',
    active: true,
  }));
  await importThroughDialog(page, importFile('six.json', { cards }));
  await dialog(page).getByRole('button', { name: 'Import 6 cards' }).click();
  await expect(save(page)).toBeEnabled();
  await save(page).click();
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible();
  await expect.poll(async () => (await cardsOf()).length).toBe(6);

  await page.goto('/games/memory/12');
  const tiles = page.locator('[data-tile]');
  await expect(tiles.first()).toBeFocused();
  await expect(tiles).toHaveCount(12);
  const ids = await tiles.evaluateAll((els) => els.map((e) => e.getAttribute('data-card-id') ?? ''));
  const first = ids[0];
  const mate = ids.findIndex((id, i) => i > 0 && id === first);
  await tiles.nth(0).click();
  await tiles.nth(mate).click();
  await expect(tiles.nth(0)).toHaveAttribute('data-matched', 'true');
  await expect(tiles.nth(mate)).toHaveAttribute('data-matched', 'true');
});

test.describe('Quick import cards header button', () => {
  const importBtn = (page: Page) => page.getByRole('button', { name: 'Quick import cards' });

  test('one row with Revert and Save in the sticky header, left to right, blue text style, opens with nothing to save', async ({ page }) => {
    await openCards(page);
    await expect(importBtn(page)).toHaveCount(1);
    await expect(save(page)).toBeDisabled();
    const boxes = await Promise.all([importBtn(page), page.getByRole('button', { name: 'Revert' }), save(page)].map((l) => l.boundingBox()));
    const [a, b, c] = boxes.map((x) => x!);
    expect(a.x + a.width).toBeLessThanOrEqual(b.x);
    expect(b.x + b.width).toBeLessThanOrEqual(c.x);
    for (const x of [a, b, c]) expect(Math.abs(x.y + x.height / 2 - (a.y + a.height / 2))).toBeLessThan(4);
    await expect(importBtn(page)).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(importBtn(page)).toHaveCSS('color', 'rgb(63, 115, 181)');
    const h1 = (await page.getByRole('heading', { name: 'Memory cards' }).boundingBox())!;
    expect(a.y).toBeLessThan(h1.y + h1.height); // top right, on the title's line
    const header = (await page.locator('div[style*="sticky"]').boundingBox())!;
    expect(header.x + header.width - (c.x + c.width)).toBeLessThan(24);
    await page.mouse.wheel(0, 600);
    await expect(importBtn(page)).toBeInViewport();
    await importBtn(page).click();
    await expect(dialog(page)).toBeVisible();
  });

  test('at 1024 px the header does not overflow and Save stays visible', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await openCards(page);
    await expect(save(page)).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test('at 390 px the header does not overflow and Save stays visible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openCards(page);
    // The stacked nav and the Mine/Global tabs push the header below the fold at this width; it is sticky, so it pins once the page scrolls.
    await page.mouse.wheel(0, 600);
    await expect(save(page)).toBeVisible();
    await expect(save(page)).toBeInViewport({ ratio: 1 });
    await expect(importBtn(page)).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});

test.describe('Groups (A17, A18)', () => {
  type GroupRow = { id: string; name: string };
  const groupsOf = async () => (await getState()).card_groups as GroupRow[];
  const picker = (page: Page, n: number) => page.getByRole('combobox', { name: `Group for card ${n}`, exact: true });
  const groupsArea = (page: Page) => page.getByRole('region', { name: 'Groups' });

  test('create a group, tag a card, Save, reload: the tag is there; delete the group, Save, reload: "No group"', async ({ page }) => {
    await openCards(page);
    await expect(groupsArea(page)).toBeVisible();
    await expect(groupsArea(page).getByText('No groups yet. Add one below.')).toBeVisible();

    await page.getByLabel('New group name').fill('Birds');
    await page.getByLabel('New group name').press('Enter');
    await expect(page.getByLabel('New group name')).toHaveValue('');
    await expect(groupsArea(page).getByRole('listitem')).toHaveText(['Birds']);
    await picker(page, 11).selectOption({ label: 'Birds' }); // newest first: card 11 is word2
    await expect(save(page)).toBeEnabled();
    expect(await groupsOf()).toEqual([]); // nothing is written before Save

    await save(page).click();
    await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible();
    const [birds] = await groupsOf();
    expect(birds.name).toBe('Birds');
    expect((await cardsOf() as (CardRow & { group_id: string | null })[]).find((c) => c.word === 'word2')?.group_id).toBe(birds.id);

    await page.reload();
    await expect(picker(page, 11).locator('option:checked')).toHaveText('Birds');
    await expect(picker(page, 1).locator('option:checked')).toHaveText('No group');
    await expect(groupsArea(page).getByRole('listitem')).toHaveText(['Birds']);

    await page.getByRole('button', { name: 'Delete group Birds' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('1 card uses this group. It will have no group.');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete group' }).click();
    await expect(picker(page, 11).locator('option:checked')).toHaveText('No group'); // at once, in the draft
    expect(await groupsOf()).toHaveLength(1); // still there until Save

    await save(page).click();
    await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible();
    await expect.poll(groupsOf).toEqual([]);
    await page.reload();
    await expect(picker(page, 11).locator('option:checked')).toHaveText('No group');
    await expect(groupsArea(page).getByText('No groups yet. Add one below.')).toBeVisible();
    expect((await cardsOf() as (CardRow & { group_id: string | null })[]).every((c) => c.group_id == null)).toBe(true);
  });

  test('rename a group inline and Save; a weak group shows the Sort It warning', async ({ page }) => {
    const id = '20000000-0000-4000-8000-000000000001';
    const rows = makeCards(4).map((c, i) => ({ ...c, group_id: i < 3 ? id : null }));
    await reset({ memory_cards: rows, card_groups: [{ id, name: 'Animals', created_at: '2026-01-01T00:00:00.000Z' }] });
    await openCards(page);
    const weak = 'Sort It needs at least 4 cards with different words in a group.';
    await expect(page.getByText(weak)).toHaveCount(3);
    await picker(page, 1).selectOption({ label: 'Animals' }); // newest first: card 1 is the ungrouped word4
    await expect(page.getByText(weak)).toHaveCount(0);

    await page.getByRole('button', { name: 'Rename group Animals' }).click();
    await page.getByRole('textbox', { name: 'New name for group Animals' }).fill('Pets');
    await page.getByRole('textbox', { name: 'New name for group Animals' }).press('Enter');
    await expect(groupsArea(page).getByRole('listitem')).toHaveText(['Pets']);
    await expect(picker(page, 1).locator('option:checked')).toHaveText('Pets');
    await save(page).click();
    await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible();
    expect(await groupsOf()).toMatchObject([{ id, name: 'Pets' }]);
  });

  test('at 390 px the Groups area does not overflow the page', async ({ page }) => {
    const id = '20000000-0000-4000-8000-000000000001';
    await reset({ memory_cards: makeCards(2), card_groups: [{ id, name: 'A rather long group name for a phone', created_at: '2026-01-01T00:00:00.000Z' }] });
    await page.setViewportSize({ width: 390, height: 844 });
    await openCards(page);
    await expect(groupsArea(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});

test.describe('Quick import with a group (A19) and Sort It pool health (A13)', () => {
  type TaggedRow = CardRow & { group_id: string | null };
  const svg = (fill: string) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'><circle cx='4' cy='4' r='3' fill='${fill}'/></svg>`;
  const sortHealth = (page: Page) => page.getByTestId('sort-health');

  test('create a group, import cards that use it (any case), Save, reload: the cards are tagged', async ({ page }) => {
    await reset({ memory_cards: [] });
    await openCards(page);
    await expect(sortHealth(page)).toContainText('0 groups can be played so far');

    await page.getByLabel('New group name').fill('Birds');
    await page.getByLabel('New group name').press('Enter');
    await expect(page.getByRole('region', { name: 'Groups' }).getByRole('listitem')).toHaveText(['Birds']);

    const cards = ['owl', 'duck', 'hen', 'swan'].map((word, i) => ({ word, image: svg(['#E59AA1', '#9AC3E5', '#F2DB8C', '#A8D5A2'][i]), group: i % 2 ? ' BIRDS ' : 'birds' }));
    await importThroughDialog(page, importFile('birds.json', { cards }));
    await dialog(page).getByRole('button', { name: 'Import 4 cards' }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Group for card 1', exact: true }).locator('option:checked')).toHaveText('Birds');
    await expect(sortHealth(page)).toContainText('1 group can be played so far');

    await save(page).click();
    await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible();
    const groups = (await getState()).card_groups as { id: string; name: string }[];
    expect(groups.map((g) => g.name)).toEqual(['Birds']);
    await expect.poll(async () => ((await cardsOf()) as TaggedRow[]).map((c) => c.group_id)).toEqual(Array(4).fill(groups[0].id));

    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Group for card 1', exact: true })).toBeVisible();
    for (let n = 1; n <= 4; n++) await expect(page.getByRole('combobox', { name: `Group for card ${n}`, exact: true }).locator('option:checked')).toHaveText('Birds');
    await expect(sortHealth(page)).toContainText('1 group can be played so far');
  });

  test('an unknown group name shows the error under the dialog and imports nothing', async ({ page }) => {
    await openCards(page);
    await importThroughDialog(page, importFile('bad-group.json', { cards: [{ word: 'fine', image: '' }, { word: 'owl', image: '', group: 'Birds' }] }));
    await expect(dialog(page).getByRole('alert')).toContainText('Card 2: group "Birds" does not exist. Create it under Groups first.');
    await expect(dialog(page).getByRole('button', { name: 'Import', exact: true })).toBeDisabled();
    await dialog(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByLabel('Word for card 13', { exact: true })).toHaveCount(0);
    await expect(save(page)).toBeDisabled();
    expect((await cardsOf()).map((c) => c.word)).toEqual(makeCards(12).map((c) => c.word));
  });
});
