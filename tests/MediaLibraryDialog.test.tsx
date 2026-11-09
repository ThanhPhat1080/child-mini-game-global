import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const lib = vi.hoisted(() => ({
  inUse: vi.fn(), del: vi.fn(), rename: vi.fn(), listLibrary: vi.fn(), playOnce: vi.fn(), uploadToLibrary: vi.fn(), cropToSquare: vi.fn(),
}));

vi.mock('@/lib/media/library', () => ({ listLibrary: lib.listLibrary }));
vi.mock('@/lib/audio', () => ({ playOnce: lib.playOnce }));
vi.mock('@/lib/media', () => ({
  mediaUrl: (p: string | null) => (p ? `https://cdn.test/${p}` : null),
  uploadToLibrary: lib.uploadToLibrary,
  isMediaInUse: lib.inUse,
  deleteMedia: lib.del,
  MAX_IMAGE_BYTES: 2 * 1024 * 1024,
}));
vi.mock('@/lib/media/rename', () => ({ renameMedia: lib.rename }));
vi.mock('@/lib/crop/render', () => ({ cropToAspect: (file: File, crop: unknown) => lib.cropToSquare(file, crop), cropToSquare: lib.cropToSquare }));

import { MediaLibraryDialog } from '@/components/admin/MediaLibraryDialog';

beforeEach(() => {
  lib.listLibrary.mockReset();
  lib.playOnce.mockReset();
});
afterEach(cleanup);

describe('MediaLibraryDialog', () => {
  it('Close calls onClose like Cancel, and the footer buttons are both 40px high, the one admin button size (FA1, FA5)', async () => {
    lib.listLibrary.mockResolvedValue(['cards/c1.png']);
    const onClose = vi.fn();
    render(<MediaLibraryDialog kind="image" onChoose={() => undefined} onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'Image Library' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect((within(dialog).getByRole('button', { name: 'Cancel' }) as HTMLElement).style.height).toBe('40px');
    expect((within(dialog).getByRole('button', { name: 'OK' }) as HTMLElement).style.height).toBe('40px');
  });

  it('is a labelled dialog that lists pictures as choosable buttons', async () => {
    lib.listLibrary.mockResolvedValue(['cards/c1.png', 'spot/a.png']);
    render(<MediaLibraryDialog kind="image" onChoose={() => undefined} onClose={() => undefined} />);
    expect(screen.getByRole('dialog', { name: 'Image Library' })).toBeTruthy();
    expect(lib.listLibrary).toHaveBeenCalledWith('image');
    expect(await screen.findByRole('button', { name: 'Choose c1.png' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose a.png' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Play c1.png' })).toBeNull();
  });

  it('a click selects without enlarging; the magnifier button enlarges', async () => {
    lib.listLibrary.mockResolvedValue(['cards/c1.png']);
    render(<MediaLibraryDialog kind="image" onChoose={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Choose c1.png' }));
    expect(screen.getByRole('button', { name: 'Choose c1.png' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Close picture' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Enlarge c1.png' }));
    expect(screen.getByRole('button', { name: 'Close picture' })).toBeTruthy();
  });

  it('clicking anywhere on a sound row selects it; the pencil starts renaming without selecting', async () => {
    lib.listLibrary.mockResolvedValue(['library/bell.mp3', 'library/drum.mp3']);
    render(<MediaLibraryDialog kind="audio" onChoose={vi.fn()} onClose={vi.fn()} />);
    const row = (await screen.findByRole('button', { name: 'Choose bell.mp3' })).closest('li') as HTMLElement;
    fireEvent.click(row);
    expect(row.getAttribute('data-selected')).toBe('true');
    const other = screen.getByRole('button', { name: 'Choose drum.mp3' }).closest('li') as HTMLElement;
    fireEvent.click(screen.getByRole('button', { name: 'Rename drum.mp3' }));
    expect(other.getAttribute('data-selected')).toBe('false');
    expect(await screen.findByRole('textbox', { name: 'Rename drum.mp3' })).toBeTruthy();
  });

  it('choosing a picture calls onChoose with its path and then closes', async () => {
    lib.listLibrary.mockResolvedValue(['cards/c1.png']);
    const onChoose = vi.fn();
    const onClose = vi.fn();
    render(<MediaLibraryDialog kind="image" onChoose={onChoose} onClose={onClose} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Choose c1.png' }));
    expect(onChoose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onChoose).toHaveBeenCalledWith('cards/c1.png');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onChoose.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0]);
  });

  it('sounds get a play / pause button that previews without choosing', async () => {
    lib.listLibrary.mockResolvedValue(['cards/c1.mp3']);
    const onChoose = vi.fn();
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    // jsdom does not play media: report the sound as playing so the second click is a pause.
    vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockReturnValue(false);
    const { unmount } = render(<MediaLibraryDialog kind="audio" onChoose={onChoose} onClose={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Play c1.mp3' }));
    expect(play).toHaveBeenCalledTimes(1);
    expect(onChoose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Pause c1.mp3' }));
    expect(pause).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Play c1.mp3' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Choose c1.mp3' }));
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onChoose).toHaveBeenCalledWith('cards/c1.mp3');
    unmount();
    vi.restoreAllMocks();
  });

  it('Escape closes it', async () => {
    lib.listLibrary.mockResolvedValue([]);
    const onClose = vi.fn();
    render(<MediaLibraryDialog kind="image" onChoose={() => undefined} onClose={onClose} />);
    await screen.findByText('Nothing in the library yet.');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('the Cancel button closes it', async () => {
    lib.listLibrary.mockResolvedValue([]);
    const onClose = vi.fn();
    render(<MediaLibraryDialog kind="image" onChoose={() => undefined} onClose={onClose} />);
    await screen.findByText('Nothing in the library yet.');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the empty message when nothing is in use', async () => {
    lib.listLibrary.mockResolvedValue([]);
    render(<MediaLibraryDialog kind="audio" onChoose={() => undefined} onClose={() => undefined} />);
    expect(await screen.findByText('Nothing in the library yet.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Choose / })).toBeNull();
  });

  it('shows an error line when the library cannot be read', async () => {
    lib.listLibrary.mockRejectedValue(new Error('offline'));
    render(<MediaLibraryDialog kind="image" onChoose={() => undefined} onClose={() => undefined} />);
    await waitFor(() => expect(screen.getByText('Could not load the library.')).toBeTruthy());
    expect(screen.queryByText('Nothing in the library yet.')).toBeNull();
  });
});

describe('MediaLibraryDialog crop before upload (A24)', () => {
  const png = new File(['png'], 'photo.png', { type: 'image/png' });
  const svg = new File(['<svg/>'], 'art.svg', { type: 'image/svg+xml' });

  beforeEach(() => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:photo'), revokeObjectURL: vi.fn() }));
    lib.listLibrary.mockResolvedValue([]);
    lib.uploadToLibrary.mockReset().mockResolvedValue('library/1-photo-square.webp');
    lib.cropToSquare.mockReset().mockResolvedValue(new File(['webp'], 'photo-square.webp', { type: 'image/webp' }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Picks a file with the hidden "Upload new picture" input. */
  function pick(file: File) {
    fireEvent.change(screen.getByLabelText('Upload new picture'), { target: { files: [file] } });
  }

  /** Gives the crop window a 1200x800 picture, as the browser would when it loads. */
  async function loadPicture() {
    const img = screen.getByRole('dialog', { name: 'Crop picture' }).querySelector('img') as HTMLImageElement;
    Object.defineProperty(img, 'naturalWidth', { value: 1200 });
    Object.defineProperty(img, 'naturalHeight', { value: 800 });
    await act(async () => { fireEvent.load(img); });
  }

  it('picking a PNG opens the crop window and uploads nothing yet', async () => {
    render(<MediaLibraryDialog kind="image" onChoose={() => undefined} onClose={() => undefined} />);
    await screen.findByText('Nothing in the library yet.');
    pick(png);
    expect(await screen.findByRole('dialog', { name: 'Crop picture' })).toBeTruthy();
    expect(lib.uploadToLibrary).not.toHaveBeenCalled();
  });

  it('Save crops the picture, uploads the square and reports the crop', async () => {
    const onCropped = vi.fn();
    render(<MediaLibraryDialog kind="image" onChoose={() => undefined} onClose={() => undefined} onCropped={onCropped} />);
    await screen.findByText('Nothing in the library yet.');
    pick(png);
    await screen.findByRole('dialog', { name: 'Crop picture' });
    await loadPicture();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(lib.uploadToLibrary).toHaveBeenCalledTimes(1));
    expect(lib.cropToSquare).toHaveBeenCalledWith(png, expect.objectContaining({ ratio: 1.5 }));
    expect(lib.uploadToLibrary).toHaveBeenCalledWith(expect.objectContaining({ name: 'photo-square.webp' }));
    expect(onCropped).toHaveBeenCalledWith(expect.objectContaining({ ratio: 1.5 }));
    expect(screen.queryByRole('dialog', { name: 'Crop picture' })).toBeNull();
  });

  it('Cancel in the crop window uploads nothing and keeps the library open', async () => {
    const onClose = vi.fn();
    render(<MediaLibraryDialog kind="image" onChoose={() => undefined} onClose={onClose} />);
    await screen.findByText('Nothing in the library yet.');
    pick(png);
    const crop = await screen.findByRole('dialog', { name: 'Crop picture' });
    fireEvent.click(within(crop).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Crop picture' })).toBeNull();
    expect(lib.uploadToLibrary).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Escape in the crop window cancels the crop and does not close the library', async () => {
    const onClose = vi.fn();
    render(<MediaLibraryDialog kind="image" onChoose={() => undefined} onClose={onClose} />);
    await screen.findByText('Nothing in the library yet.');
    pick(png);
    fireEvent.keyDown(await screen.findByRole('dialog', { name: 'Crop picture' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Crop picture' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(lib.uploadToLibrary).not.toHaveBeenCalled();
  });

  it('a picture that cannot be cropped shows its message and uploads nothing', async () => {
    lib.cropToSquare.mockRejectedValue(new Error('Could not read this picture'));
    render(<MediaLibraryDialog kind="image" onChoose={() => undefined} onClose={() => undefined} />);
    await screen.findByText('Nothing in the library yet.');
    pick(png);
    await screen.findByRole('dialog', { name: 'Crop picture' });
    await loadPicture();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Could not read this picture')).toBeTruthy();
    expect(lib.uploadToLibrary).not.toHaveBeenCalled();
  });

  it('an SVG picture uploads at once, without a crop window', async () => {
    render(<MediaLibraryDialog kind="image" onChoose={() => undefined} onClose={() => undefined} />);
    await screen.findByText('Nothing in the library yet.');
    pick(svg);
    await waitFor(() => expect(lib.uploadToLibrary).toHaveBeenCalledWith(svg));
    expect(screen.queryByRole('dialog', { name: 'Crop picture' })).toBeNull();
    expect(lib.cropToSquare).not.toHaveBeenCalled();
  });
});

describe('MediaLibraryDialog size limits for cropped pictures', () => {
  const sized = (size: number) => {
    const f = new File(['x'], 'phone.jpg', { type: 'image/jpeg' });
    Object.defineProperty(f, 'size', { value: size });
    return f;
  };

  beforeEach(() => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:photo'), revokeObjectURL: vi.fn() }));
    lib.listLibrary.mockResolvedValue([]);
    lib.uploadToLibrary.mockReset().mockResolvedValue('library/x.webp');
    lib.cropToSquare.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a 5 MB phone photo opens the crop window: the 2 MB limit applies to the cropped result', async () => {
    render(<MediaLibraryDialog kind="image" onChoose={() => undefined} onClose={() => undefined} />);
    await screen.findByText('Nothing in the library yet.');
    fireEvent.change(screen.getByLabelText('Upload new picture'), { target: { files: [sized(5 * 1024 * 1024)] } });
    expect(await screen.findByRole('dialog', { name: 'Crop picture' })).toBeTruthy();
    expect(screen.queryByText('Image must be 2 MB or smaller.')).toBeNull();
  });

  it('a picture over 20 MB is refused before the crop window opens', async () => {
    render(<MediaLibraryDialog kind="image" onChoose={() => undefined} onClose={() => undefined} />);
    await screen.findByText('Nothing in the library yet.');
    fireEvent.change(screen.getByLabelText('Upload new picture'), { target: { files: [sized(25 * 1024 * 1024)] } });
    expect(await screen.findByText('Picture must be 20 MB or smaller.')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Crop picture' })).toBeNull();
  });

  it('a cropped result still over 2 MB is refused and nothing is uploaded', async () => {
    lib.cropToSquare.mockResolvedValue(sized(3 * 1024 * 1024));
    render(<MediaLibraryDialog kind="image" onChoose={() => undefined} onClose={() => undefined} />);
    await screen.findByText('Nothing in the library yet.');
    fireEvent.change(screen.getByLabelText('Upload new picture'), { target: { files: [sized(5 * 1024 * 1024)] } });
    const crop = await screen.findByRole('dialog', { name: 'Crop picture' });
    const img = crop.querySelector('img') as HTMLImageElement;
    Object.defineProperty(img, 'naturalWidth', { value: 1200 });
    Object.defineProperty(img, 'naturalHeight', { value: 800 });
    await act(async () => { fireEvent.load(img); });
    fireEvent.click(within(crop).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Image must be 2 MB or smaller.')).toBeTruthy();
    expect(lib.uploadToLibrary).not.toHaveBeenCalled();
  });

  it('double click turns the name into a selected text box; Enter renames and a toast says so', async () => {
    lib.listLibrary.mockResolvedValue(['library/oh-ring-9j2k4m1a7b3cx.mp3']);
    lib.rename.mockResolvedValue('library/Bell-9j2k4m1a7b3cx.mp3');
    render(<MediaLibraryDialog kind="audio" onChoose={() => undefined} onClose={() => undefined} />);
    fireEvent.doubleClick(await screen.findByText('oh-ring-9j2k4m1a7b3cx.mp3'));
    const box = screen.getByRole('textbox', { name: /Rename/ }) as HTMLInputElement;
    expect(box.value).toBe('oh-ring');
    expect(box.selectionStart).toBe(0);
    expect(box.selectionEnd).toBe(7);
    fireEvent.change(box, { target: { value: 'Bell' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(lib.rename).toHaveBeenCalledWith('library/oh-ring-9j2k4m1a7b3cx.mp3', 'Bell'));
    expect(await screen.findByText('Renamed to Bell-9j2k4m1a7b3cx.mp3')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose Bell-9j2k4m1a7b3cx.mp3' })).toBeTruthy();
  });

  it('shows an error toast when the rename fails, and Escape cancels without renaming', async () => {
    lib.listLibrary.mockResolvedValue(['library/a-9j2k4m1a7b3cx.png']);
    lib.rename.mockRejectedValue(new Error('A file with that name already exists.'));
    render(<MediaLibraryDialog kind="image" onChoose={() => undefined} onClose={() => undefined} />);
    fireEvent.doubleClick(await screen.findByText('a-9j2k4m1a7b3cx.png'));
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(lib.rename).not.toHaveBeenCalled();
    fireEvent.doubleClick(screen.getByText('a-9j2k4m1a7b3cx.png'));
    const box = screen.getByRole('textbox');
    fireEvent.change(box, { target: { value: 'b' } });
    fireEvent.blur(box);
    expect(await screen.findByText('A file with that name already exists.')).toBeTruthy();
  });

  it('shows the new name before the server answers, and goes back with an error toast if it fails', async () => {
    lib.listLibrary.mockResolvedValue(['library/a-9j2k4m1a7b3cx.png']);
    let fail: (e: Error) => void = () => undefined;
    lib.rename.mockReturnValue(new Promise((_, rej) => { fail = rej; }));
    render(<MediaLibraryDialog kind="image" onChoose={() => undefined} onClose={() => undefined} />);
    fireEvent.doubleClick(await screen.findByText('a-9j2k4m1a7b3cx.png'));
    const box = screen.getByRole('textbox');
    fireEvent.change(box, { target: { value: 'b' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(screen.getByText('b-9j2k4m1a7b3cx.png')).toBeTruthy();
    fail(new Error('db down'));
    expect(await screen.findByText('db down')).toBeTruthy();
    expect(screen.getByText('a-9j2k4m1a7b3cx.png')).toBeTruthy();
  });

  it('renames different files independently while another rename is still waiting', async () => {
    lib.listLibrary.mockResolvedValue(['library/a-9j2k4m1a7b3cx.png', 'library/c-9j2k4m1a7b3dx.png']);
    lib.rename.mockReturnValueOnce(new Promise(() => undefined)).mockResolvedValueOnce('library/d-9j2k4m1a7b3dx.png');
    render(<MediaLibraryDialog kind="image" onChoose={() => undefined} onClose={() => undefined} />);
    fireEvent.doubleClick(await screen.findByText('a-9j2k4m1a7b3cx.png'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'b' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    fireEvent.doubleClick(screen.getByText('c-9j2k4m1a7b3dx.png'));
    const box = screen.getByRole('textbox');
    fireEvent.change(box, { target: { value: 'd' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(await screen.findByText('Renamed to d-9j2k4m1a7b3dx.png')).toBeTruthy();
    expect(lib.rename).toHaveBeenCalledTimes(2);
  });

  it('sorts by upload time (newest first) by default and by name when asked', async () => {
    lib.listLibrary.mockResolvedValue(['library/zed-000000000aaaa.png', 'library/amy-000000000bbbb.png', 'library/mid-000000000cccc.png']);
    render(<MediaLibraryDialog kind="image" onChoose={() => undefined} onClose={() => undefined} />);
    await screen.findByRole('button', { name: 'Choose zed-000000000aaaa.png' });
    const order = () => screen.getAllByRole('button', { name: /^Choose / }).map((b) => b.getAttribute('aria-label'));
    expect(order()).toEqual(['Choose mid-000000000cccc.png', 'Choose amy-000000000bbbb.png', 'Choose zed-000000000aaaa.png']);
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), { target: { value: 'name' } });
    expect(order()).toEqual(['Choose amy-000000000bbbb.png', 'Choose mid-000000000cccc.png', 'Choose zed-000000000aaaa.png']);
  });

  it('warns and keeps the file when a record uses it', async () => {
    lib.listLibrary.mockResolvedValue(['library/a.png']);
    lib.inUse.mockResolvedValue(true);
    render(<MediaLibraryDialog kind="image" onChoose={() => undefined} onClose={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete a.png' }));
    expect(await screen.findByText('a.png is used somewhere else, so it was not deleted.')).toBeTruthy();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(lib.del).not.toHaveBeenCalled();
  });

  it('asks first, then deletes an unused file and removes it from the list', async () => {
    lib.listLibrary.mockResolvedValue(['library/a.png']);
    lib.inUse.mockResolvedValue(false);
    lib.del.mockResolvedValue(true);
    render(<MediaLibraryDialog kind="image" onChoose={() => undefined} onClose={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete a.png' }));
    const ask = await screen.findByRole('alertdialog');
    fireEvent.click(within(ask).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Deleted a.png')).toBeTruthy();
    expect(lib.del).toHaveBeenCalledWith('library/a.png');
    expect(screen.queryByRole('button', { name: 'Choose a.png' })).toBeNull();
  });

  it('a renamed file keeps its place in the list, also for files uploaded before upload ids', async () => {
    lib.listLibrary.mockResolvedValue(['cards/a.png', 'cards/m.png', 'cards/z.png']);
    lib.rename.mockResolvedValue('cards/zz.png');
    render(<MediaLibraryDialog kind="image" onChoose={() => undefined} onClose={() => undefined} />);
    await screen.findByRole('button', { name: 'Choose a.png' });
    const order = () => screen.getAllByRole('button', { name: /^Choose / }).map((b) => b.getAttribute('aria-label'));
    const before = order();
    fireEvent.doubleClick(screen.getByText('a.png'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'zz' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(await screen.findByText('Renamed to zz.png')).toBeTruthy();
    expect(order()).toEqual(before.map((n) => (n === 'Choose a.png' ? 'Choose zz.png' : n)));
  });

  it('the magnifier opens a picture at full size; Escape closes only the viewer', async () => {
    lib.listLibrary.mockResolvedValue(['library/a.png']);
    const onClose = vi.fn();
    render(<MediaLibraryDialog kind="image" onChoose={() => undefined} onClose={onClose} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Enlarge a.png' }));
    const viewer = screen.getByRole('dialog', { name: 'a.png' });
    expect(within(viewer).getByRole('img').getAttribute('src')).toBe('https://cdn.test/library/a.png');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'a.png' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a file being validated for delete is inert with a Validating... note, and other files are unaffected', async () => {
    lib.listLibrary.mockResolvedValue(['library/a.png', 'library/b.png']);
    let done: (v: boolean) => void = () => undefined;
    lib.inUse.mockReturnValueOnce(new Promise<boolean>((r) => { done = r; })).mockReturnValueOnce(new Promise(() => undefined));
    render(<MediaLibraryDialog kind="image" onChoose={() => undefined} onClose={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete a.png' }));
    expect(screen.getByText('Validating before delete.')).toBeTruthy();
    expect(screen.getByText('Validating...')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Choose a.png' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Choose a.png' }));
    expect(screen.queryByRole('dialog', { name: 'a.png' })).toBeNull();
    // another file's delete does not enable the first one again
    expect((screen.getByRole('button', { name: 'Delete b.png' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Delete b.png' }));
    expect((screen.getByRole('button', { name: 'Delete a.png' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText('Validating...')).toHaveLength(2);
    done(true);
    expect(await screen.findByText('a.png is used somewhere else, so it was not deleted.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Delete a.png' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: 'Delete b.png' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('a sound being deleted cannot be played', async () => {
    lib.listLibrary.mockResolvedValue(['library/a.mp3']);
    lib.inUse.mockReturnValue(new Promise(() => undefined));
    render(<MediaLibraryDialog kind="audio" onChoose={() => undefined} onClose={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete a.mp3' }));
    expect((screen.getByRole('button', { name: 'Play a.mp3' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
