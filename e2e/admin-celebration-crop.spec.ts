import { expect, test, type Page } from '@playwright/test';
import { CHILD, reset, signInAsAdmin } from './support/fixtures';

// A32: a celebration picture is cropped to the 3:5 frame the scene shows, and the form tells the parent about transparency.

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

test('a celebration picture is cropped to a tall 3:5 frame, and the form says to use a transparent background (A32)', async ({ page }) => {
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

  const crop = page.getByRole('dialog', { name: 'Crop picture' });
  await expect(crop).toBeVisible();
  const area = await crop.getByRole('group', { name: 'Crop area' }).boundingBox();
  expect(area).not.toBeNull();
  // Width : height of the frame: about 340 : 600 (3:5), not a square.
  expect(area!.width / area!.height).toBeCloseTo(340 / 600, 1);
  await expect(crop.getByText('Preview. The picture is saved as this frame.')).toBeVisible();

  // Cancel looks like the other dialogs' Cancel: white, rounded, light border (same as Confirm, Import, Ban).
  const cancel = crop.getByRole('button', { name: 'Cancel' });
  await expect(cancel).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(cancel).toHaveCSS('border-radius', '10px');
  await expect(cancel).toHaveCSS('border-top-color', 'rgb(227, 213, 196)');
  await page.screenshot({ path: 'test-results/crop-cancel.png' });
  await cancel.click();
  await expect(crop).toHaveCount(0);
});

test('after a celebration picture is chosen, the "Applied" note sits under its button, not beside it', async ({ page }) => {
  await page.getByRole('button', { name: `Edit ${CHILD.name}` }).click();
  await page.getByRole('button', { name: 'Choose from library for celebration picture A' }).click();
  await page.locator('input[type=file][aria-label="Upload new picture"]').setInputFiles({
    name: 'kid.png', mimeType: 'image/png', buffer: await widePng(page),
  });
  await page.getByRole('dialog', { name: 'Crop picture' }).getByRole('button', { name: 'Save' }).click();
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
