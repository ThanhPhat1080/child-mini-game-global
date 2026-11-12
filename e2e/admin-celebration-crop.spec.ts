import { expect, test, type Page } from '@playwright/test';
import { CHILD, reset, signInAsAdmin } from './support/fixtures';

// A32: a celebration picture is free style (no crop window), and the form advises a transparent, tall picture.

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
  await reset();
  await signInAsAdmin(page);
});

test('a celebration picture is not cropped, and the form advises a transparent, tall picture (A32)', async ({ page }) => {
  await page.getByRole('button', { name: `Edit ${CHILD.name}` }).click();
  await expect(page.getByText(/transparent background/)).toBeVisible();
  // The button label stays on one line: the button is its normal height, not two lines clipped.
  const choose = page.getByRole('button', { name: 'Choose from library for celebration picture A' });
  expect((await choose.boundingBox())!.height).toBeLessThanOrEqual(40.5);
  await page.screenshot({ path: 'test-results/celebration-field.png' });

  await page.getByRole('button', { name: 'Choose from library for celebration picture A' }).click();
  await page.locator('input[type=file][aria-label="Upload new picture"]').setInputFiles({
    name: 'kid.png', mimeType: 'image/png', buffer: await widePng(page),
  });
  // No crop window: the wide picture goes straight to the library as it is.
  await expect(page.getByRole('dialog', { name: 'Crop picture' })).toHaveCount(0);
  await expect(page.getByText('Upload new').first()).toBeVisible();
});

test('after a celebration picture is chosen, the "Applied" note sits under its button, not beside it', async ({ page }) => {
  await page.getByRole('button', { name: `Edit ${CHILD.name}` }).click();
  await page.getByRole('button', { name: 'Choose from library for celebration picture A' }).click();
  await page.locator('input[type=file][aria-label="Upload new picture"]').setInputFiles({
    name: 'kid.png', mimeType: 'image/png', buffer: await widePng(page),
  });
  await page.getByRole('dialog').filter({ hasText: 'Upload new' }).getByRole('button', { name: 'OK' }).click();

  const choose = page.getByRole('button', { name: 'Choose from library for celebration picture A' });
  const note = page.getByText('Applied when you press Save.').first();
  await expect(note).toBeVisible();
  const b = (await choose.boundingBox())!;
  const n = (await note.boundingBox())!;
  // Below the button: the note starts under the button's bottom edge and lines up with its left edge.
  expect(n.y).toBeGreaterThanOrEqual(b.y + b.height - 1);
  expect(Math.abs(n.x - b.x)).toBeLessThan(2);
  await page.screenshot({ path: 'test-results/celebration-applied.png' });
});
