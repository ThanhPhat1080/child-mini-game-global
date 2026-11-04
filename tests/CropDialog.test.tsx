import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CropDialog } from '@/components/admin/CropDialog';
import type { Crop } from '@/lib/crop/geometry';

const file = new File(['x'], 'photo.png', { type: 'image/png' });

/** A 480 px square on a 1200x800 picture, in the middle, so it can grow and shrink. */
const smallStart: Crop = { x: 0.2, y: 0.2, w: 0.4, h: 0.6, ratio: 1.5 };

beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:photo'),
    revokeObjectURL: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Renders the dialog and loads a 1200x800 picture into it. */
async function renderLoaded(props: { start?: Crop; onSave?: (c: Crop) => void; onCancel?: () => void } = {}) {
  const onSave = props.onSave ?? vi.fn();
  const onCancel = props.onCancel ?? vi.fn();
  const { container } = render(<CropDialog file={file} start={props.start} onSave={onSave} onCancel={onCancel} />);
  const img = container.querySelector('img') as HTMLImageElement;
  Object.defineProperty(img, 'naturalWidth', { value: 1200 });
  Object.defineProperty(img, 'naturalHeight', { value: 800 });
  await act(async () => { fireEvent.load(img); });
  return { onSave, onCancel };
}

describe('CropDialog', () => {
  it('is a dialog named "Crop picture"', async () => {
    await renderLoaded();
    expect(screen.getByRole('dialog', { name: 'Crop picture' })).toBeTruthy();
  });

  it('save gives a square crop on a 1200x800 picture', async () => {
    const { onSave } = await renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const crop = (onSave as ReturnType<typeof vi.fn>).mock.calls[0][0] as Crop;
    expect(crop.w * 1200).toBeCloseTo(crop.h * 800);
  });

  it('ArrowRight on the crop area moves it right', async () => {
    const { onSave } = await renderLoaded({ start: smallStart });
    fireEvent.keyDown(screen.getByRole('group', { name: 'Crop area' }), { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const crop = (onSave as ReturnType<typeof vi.fn>).mock.calls[0][0] as Crop;
    expect(crop.x).toBeGreaterThan(smallStart.x);
  });

  it('Shift+ArrowRight grows the square', async () => {
    const { onSave } = await renderLoaded({ start: smallStart });
    fireEvent.keyDown(screen.getByRole('group', { name: 'Crop area' }), { key: 'ArrowRight', shiftKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const crop = (onSave as ReturnType<typeof vi.fn>).mock.calls[0][0] as Crop;
    expect(crop.w * 1200).toBeGreaterThan(smallStart.w * 1200);
    expect(crop.w * 1200).toBeCloseTo(crop.h * 800);
  });

  it('a picture the browser cannot decode shows a message and Save stays disabled', async () => {
    const { container } = render(<CropDialog file={file} onSave={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    expect(screen.getByRole('alert').textContent).toBe('Could not read this picture');
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('the crop area has keyboard focus once the picture is loaded', async () => {
    await renderLoaded();
    expect(document.activeElement).toBe(screen.getByRole('group', { name: 'Crop area' }));
  });

  it('the dialog fits a small screen: its height is capped and it scrolls', async () => {
    await renderLoaded();
    const dialog = screen.getByRole('dialog', { name: 'Crop picture' });
    expect(dialog.style.maxHeight).toBe('calc(100vh - 32px)');
    expect(dialog.style.overflowY).toBe('auto');
  });

  it('Esc calls onCancel and does not save', async () => {
    const { onSave, onCancel } = await renderLoaded();
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Crop picture' }), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('Cancel calls onCancel and not onSave', async () => {
    const { onSave, onCancel } = await renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });
});
