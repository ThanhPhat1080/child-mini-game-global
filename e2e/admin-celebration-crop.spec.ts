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
});
