import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ELevel } from '@/lib/spot/adminLevels';

const h = vi.hoisted(() => ({
  loadLevels: vi.fn(),
  saveLevels: vi.fn(),
  addPending: vi.fn(),
  clearPending: vi.fn(),
  svgToPending: vi.fn(),
  naturalSize: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({ from: () => { throw new Error('the page must not touch the database directly'); } }),
}));
vi.mock('@/lib/spot/adminLevels', async (orig) => ({
  ...(await orig<typeof import('@/lib/spot/adminLevels')>()),
  loadLevels: h.loadLevels,
  saveLevels: h.saveLevels,
}));
vi.mock('@/lib/spot/imageSize', () => ({ naturalSize: h.naturalSize }));
const lib = vi.hoisted(() => ({ listLibrary: vi.fn() }));
vi.mock('@/lib/media/library', () => ({ listLibrary: lib.listLibrary }));
vi.mock('@/lib/media', async (orig) => ({
  ...(await orig<typeof import('@/lib/media')>()),
  addPending: h.addPending,
  clearPending: h.clearPending,
  svgToPending: h.svgToPending,
  mediaUrl: (p: string | null) => (p ? (p.startsWith('pending:') ? `blob:${p}` : `/media/${p}`) : null),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => '/admin/spot' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

import SpotPage from '@/app/admin/(panel)/spot/page';
import { AdminNav } from '@/components/AdminNav';

const three = [{ x: 0.2, y: 0.2, r: 0.06 }, { x: 0.5, y: 0.5, r: 0.06 }, { x: 0.8, y: 0.8, r: 0.06 }];
const level = (n: number, o: Partial<ELevel> = {}): ELevel => ({ id: `l${n}`, isNew: false, a: `spot/${n}a.png`, b: `spot/${n}b.png`, differences: three, active: true, ...o });

const saveBtn = () => screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
const revertBtn = () => screen.getByRole('button', { name: 'Revert' }) as HTMLButtonElement;

/** Picks a picture from the library for one side of a level, then the file, then OK. */
async function pickPictureFromLibrary(n: number, side: 'A' | 'B', name: string) {
  fireEvent.click(screen.getByRole('button', { name: `Choose from library for level ${n} picture ${side}` }));
  fireEvent.click(await screen.findByRole('button', { name: `Choose ${name}` }));
  fireEvent.click(screen.getByRole('button', { name: 'OK' }));
}

async function renderWith(list: ELevel[]) {
  h.loadLevels.mockResolvedValue(list);
  render(<SpotPage />);
  await screen.findByRole('button', { name: 'Add level' });
  // saved levels start collapsed; most tests need them open
  for (const b of screen.queryAllByRole('button', { name: /^Expand level/ })) fireEvent.click(b);
}

/** Stubs the picture's rect so a click at fractions (fx, fy) maps back to them. */
function clickPictureA(n: number, fx: number, fy: number) {
  const art = within(screen.getByRole('article', { name: `Level ${n}` }));
  const img = art.getByRole('img', { name: 'Picture A' });
  img.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300, x: 0, y: 0, toJSON: () => ({}) });
  fireEvent.click(img, { clientX: fx * 400, clientY: fy * 300 });
}

beforeEach(() => {
  for (const f of Object.values(h)) f.mockReset();
  h.saveLevels.mockResolvedValue({ error: null, warning: null });
  h.naturalSize.mockResolvedValue({ w: 400, h: 300 });
  let n = 0;
  h.addPending.mockImplementation(() => `pending:${++n}`);
  h.svgToPending.mockImplementation(() => 'pending:svg');
});
afterEach(cleanup);

describe('Admin Spot page (A14-A16)', () => {
  it('lists each level with its pictures and on/off switch', async () => {
    await renderWith([level(1), level(2, { active: false })]);
    expect((screen.getByLabelText('Level 1 on') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Level 2 on') as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole('img', { name: 'Level 1 picture A thumbnail' }).getAttribute('src')).toBe('/media/spot/1a.png');
  });

  it('Add level sits in the header beside Revert and Save, in blue, and a new level is the last number, open, and shown first (newest first)', async () => {
    await renderWith([level(1)]);
    const add = screen.getByRole('button', { name: 'Add level' });
    expect(screen.getAllByRole('button', { name: 'Add level' })).toHaveLength(1);
    expect(add.compareDocumentPosition(revertBtn()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(add.style.backgroundColor).toBe('rgb(63, 115, 181)');
    fireEvent.click(add);
    const articles = screen.getAllByRole('article');
    expect(articles[0].getAttribute('aria-label')).toBe('Level 2');
    expect(within(articles[0]).getByRole('button', { name: 'Choose from library for level 2 picture A' })).toBeTruthy();
    expect(articles[1].getAttribute('aria-label')).toBe('Level 1');
    expect(screen.getByRole('img', { name: 'Level 1 picture A thumbnail' }).getAttribute('src')).toBe('/media/spot/1a.png');
  });

  it('Save is disabled until both pictures and 3 differences exist', async () => {
    await renderWith([level(1)]);
    expect(saveBtn().disabled).toBe(true); // nothing changed
    fireEvent.click(screen.getByRole('button', { name: 'Add level' }));
    expect(saveBtn().disabled).toBe(true);
    lib.listLibrary.mockResolvedValue(['spot/a.png', 'spot/b.png']);
    await pickPictureFromLibrary(2, 'A', 'a.png');
    await pickPictureFromLibrary(2, 'B', 'b.png');
    expect(saveBtn().disabled).toBe(true); // no spots yet
    clickPictureA(2, 0.2, 0.2);
    clickPictureA(2, 0.5, 0.5);
    expect(saveBtn().disabled).toBe(true); // 2 spots
    clickPictureA(2, 0.8, 0.8);
    expect(saveBtn().disabled).toBe(false);
  });

  it('removing a marker down to 2 disables Save again', async () => {
    await renderWith([level(1)]);
    fireEvent.click(screen.getByLabelText('Level 1 on')); // make it dirty
    expect(saveBtn().disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Spot 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete spot' }));
    expect(saveBtn().disabled).toBe(true);
  });

  it('an aspect mismatch above 2% warns but does not block Save', async () => {
    h.naturalSize.mockImplementation(async (url: string) => (url.endsWith('1b.png') ? { w: 400, h: 400 } : { w: 400, h: 300 }));
    await renderWith([level(1)]);
    await screen.findByText(/different shapes/i);
    fireEvent.click(screen.getByLabelText('Level 1 on'));
    expect(saveBtn().disabled).toBe(false);
  });

  it('no longer shows the landscape tip: every picture is a square now (ADR-032)', async () => {
    await renderWith([level(1)]);
    expect(screen.queryByText(/landscape pictures/i)).toBeNull();
  });

  it('a tall picture no longer warns, because new pictures are cropped to a square (ADR-032)', async () => {
    h.naturalSize.mockImplementation(async () => ({ w: 300, h: 400 }));
    await renderWith([level(1)]);
    await waitFor(() => expect(h.naturalSize).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByText(/picture is tall/i)).toBeNull();
  });

  it('small spots warn but do not block Save', async () => {
    await renderWith([level(1, { differences: [{ x: 0.2, y: 0.2, r: 0.05 }, { x: 0.5, y: 0.5, r: 0.06 }, { x: 0.8, y: 0.8, r: 0.06 }] })]);
    expect(screen.getByText('1 spot is small and may be hard for a young child to see.')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Level 1 on'));
    expect(saveBtn().disabled).toBe(false);
  });

  it('no warning when the shapes are within 2%', async () => {
    h.naturalSize.mockImplementation(async (url: string) => (url.endsWith('1b.png') ? { w: 404, h: 300 } : { w: 400, h: 300 }));
    await renderWith([level(1)]);
    await waitFor(() => expect(h.naturalSize).toHaveBeenCalledTimes(2));
    await Promise.resolve();
    expect(screen.queryByText(/different shapes/i)).toBeNull();
  });


  it('Delete asks first: Cancel keeps the level, confirming removes it from the draft only', async () => {
    await renderWith([level(1), level(2)]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete level 1' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('article', { name: 'Level 2' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Delete level 1' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete level' }));
    expect(screen.queryByRole('article', { name: 'Level 2' })).toBeNull();
    expect(h.saveLevels).not.toHaveBeenCalled();
    expect(saveBtn().disabled).toBe(false);
  });

  it('Revert restores the loaded state and forgets picked files', async () => {
    await renderWith([level(1)]);
    fireEvent.click(screen.getByRole('button', { name: 'Add level' }));
    fireEvent.click(screen.getByLabelText('Level 1 on'));
    h.clearPending.mockClear();
    fireEvent.click(revertBtn());
    expect(screen.queryByRole('article', { name: 'Level 2' })).toBeNull();
    expect((screen.getByLabelText('Level 1 on') as HTMLInputElement).checked).toBe(true);
    expect(h.clearPending).toHaveBeenCalled();
    expect(revertBtn().disabled).toBe(true);
  });

  it('Save calls saveLevels(saved, draft), then reloads', async () => {
    const first = [level(1)];
    await renderWith(first);
    fireEvent.click(screen.getByLabelText('Level 1 on'));
    h.loadLevels.mockResolvedValue([level(1, { active: false })]);
    fireEvent.click(saveBtn());
    await waitFor(() => expect(h.loadLevels).toHaveBeenCalledTimes(2));
    expect(h.saveLevels).toHaveBeenCalledWith(first, [level(1, { active: false })]);
    await waitFor(() => expect(saveBtn().disabled).toBe(true));
  });

  it('shows the save error and keeps the draft', async () => {
    h.saveLevels.mockResolvedValue({ error: 'db down', warning: null });
    await renderWith([level(1)]);
    fireEvent.click(screen.getByLabelText('Level 1 on'));
    fireEvent.click(saveBtn());
    expect((await screen.findByRole('alert')).textContent).toBe('db down');
    expect(saveBtn().disabled).toBe(false);
  });

  it('"Preview as child" links to the level and is hidden for a new level', async () => {
    await renderWith([level(1)]);
    const link = screen.getByRole('link', { name: 'Preview as child' });
    expect(link.getAttribute('href')).toBe('/games/spot/l1?preview=1');
    fireEvent.click(screen.getByRole('button', { name: 'Add level' }));
    expect(screen.getAllByRole('link', { name: 'Preview as child' })).toHaveLength(1);
  });

  it('the admin nav has a Spot link after Cards', () => {
    render(<AdminNav />);
    const links = screen.getAllByRole('link').map((a) => a.textContent);
    expect(links.indexOf('Spot')).toBe(links.indexOf('Cards') + 1);
    expect(screen.getByRole('link', { name: 'Spot' }).getAttribute('href')).toBe('/admin/spot');
    expect(screen.getByRole('link', { name: 'Spot' }).getAttribute('aria-current')).toBe('page');
  });

  it('a saved level starts collapsed to its header and small pictures, and the sort button reverses the list', async () => {
    h.loadLevels.mockResolvedValue([level(1), level(2)]);
    render(<SpotPage />);
    await screen.findByRole('button', { name: 'Add level' });
    expect(screen.getByRole('img', { name: 'Level 1 picture A thumbnail' })).toBeTruthy(); // pictures stay visible
    expect(screen.getByRole('img', { name: 'Level 1 picture B thumbnail' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Choose from library for level 1 picture A' })).toBeNull();
    const order = () => screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'));
    expect(order()).toEqual(['Level 2', 'Level 1']);
    fireEvent.click(screen.getByRole('button', { name: /^Sort levels/ }));
    expect(order()).toEqual(['Level 1', 'Level 2']);
    fireEvent.click(screen.getByRole('button', { name: 'Expand level 1' }));
    expect(screen.getByRole('button', { name: 'Choose from library for level 1 picture A' })).toBeTruthy();
  });
});
