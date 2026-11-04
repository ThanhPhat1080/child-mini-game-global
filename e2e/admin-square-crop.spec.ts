import { expect, test, type Page } from '@playwright/test';
import { getState, makeCards, reset, signInAsAdmin, STANDIN } from './support/fixtures';

const storage = async () => ((await getState()) as unknown as { storage: string[] }).storage;

/** A solid 1200x800 PNG, made in the browser so no image file is needed on disk. */
async function widePng(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 800;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#E59AA1';
    ctx.fillRect(0, 0, 1200, 800);
    const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, 'image/png'));
    const bytes = new Uint8Array(await blob!.arrayBuffer());
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  });
  return Buffer.from(b64, 'base64');
}

test.beforeEach(async ({ page }) => {
  await reset({ memory_cards: makeCards(12) });
  await signInAsAdmin(page);
});

test('a wide picture is cropped to a square WebP before it is stored (A24)', async ({ page }) => {
  await page.goto('/admin/cards');
  await expect(page.getByRole('button', { name: 'Add card' })).toBeVisible();

  await page.getByRole('button', { name: 'Choose from library for card 1 picture' }).click();
  await expect(page.getByRole('dialog', { name: 'Image Library' })).toBeVisible();

  await page.getByLabel('Upload new picture').setInputFiles({
    name: 'wide.png', mimeType: 'image/png', buffer: await widePng(page),
  });
  const crop = page.getByRole('dialog', { name: 'Crop picture' });
  await expect(crop).toBeVisible();
  await expect(crop.getByRole('button', { name: 'Save' })).toBeEnabled();
  await crop.getByRole('button', { name: 'Save' }).click();

  await expect.poll(async () => (await storage()).filter((p) => p.startsWith('library/') && p.endsWith('.webp'))).toHaveLength(1);
  const [path] = (await storage()).filter((p) => p.startsWith('library/') && p.endsWith('.webp'));

  const res = await page.request.get(`${STANDIN}/storage/v1/object/public/media/${path}`);
  expect(res.ok()).toBe(true);
  const size = await page.evaluate(async (b64: string) => {
    const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/webp' }));
    return { w: bmp.width, h: bmp.height };
  }, (await res.body()).toString('base64'));
  expect(size.w).toBe(size.h);
  expect(size.w).toBe(800);
});
