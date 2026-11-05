import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ELevel } from '@/lib/find/adminLevels';

const h = vi.hoisted(() => ({
  loadFindLevels: vi.fn(),
  saveFindLevels: vi.fn(),
  addPending: vi.fn(),
  clearPending: vi.fn(),
  svgToPending: vi.fn(),
  listLibrary: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({ from: () => { throw new Error('the page must not touch the database directly'); } }),
}));
vi.mock('@/lib/find/adminLevels', async (orig) => ({
  ...(await orig<typeof import('@/lib/find/adminLevels')>()),
  loadFindLevels: h.loadFindLevels,
  saveFindLevels: h.saveFindLevels,
}));
vi.mock('@/lib/media/library', () => ({ listLibrary: h.listLibrary }));
vi.mock('@/lib/media', async (orig) => ({
  ...(await orig<typeof import('@/lib/media')>()),
  addPending: h.addPending,
  clearPending: h.clearPending,
  svgToPending: h.svgToPending,
  mediaUrl: (p: string | null) => (p ? (p.startsWith('pending:') ? `blob:${p}` : `/media/${p}`) : null),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => '/admin/find' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

import FindPage from '@/app/admin/(panel)/find/page';
import { AdminNav } from '@/components/AdminNav';

const obj = (word: string, x = 0.2, y = 0.2) => ({ x, y, r: 0.06, word, audio_path: null });
const level = (n: number, o: Partial<ELevel> = {}): ELevel => ({
  id: `l${n}`, isNew: false, image: `find/${n}.png`, objects: [obj('cat', 0.2, 0.2), obj('dog', 0.6, 0.6)], active: true, ...o,
});

const saveBtn = () => screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
const revertBtn = () => screen.getByRole('button', { name: 'Revert' }) as HTMLButtonElement;

async function renderWith(list: ELevel[]) {
  h.loadFindLevels.mockResolvedValue(list);
  render(<FindPage />);
  await screen.findByRole('button', { name: 'Add level' });
  // saved levels start collapsed; most tests need them open
  for (const b of screen.queryAllByRole('button', { name: /^Expand level/ })) fireEvent.click(b);
}

/** Stubs the picture's rect so a click at fractions (fx, fy) maps back to them. */
function clickPicture(n: number, fx: number, fy: number) {
  const art = within(screen.getByRole('article', { name: `Level ${n}` }));
  const img = art.getByRole('img', { name: 'Picture' });
  img.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300, x: 0, y: 0, toJSON: () => ({}) });
  fireEvent.click(img, { clientX: fx * 400, clientY: fy * 300 });
}

beforeEach(() => {
  for (const f of Object.values(h)) f.mockReset();
  h.saveFindLevels.mockResolvedValue({ error: null, warning: null });
  h.listLibrary.mockResolvedValue([]);
  let n = 0;
  h.addPending.mockImplementation(() => `pending:${++n}`);
  h.svgToPending.mockImplementation(() => 'pending:svg');
});
afterEach(cleanup);

describe('Admin Find page (A20-A22)', () => {
  it('lists each level with its picture and on/off switch', async () => {
    await renderWith([level(1), level(2, { active: false })]);
    expect((screen.getByLabelText('Level 1 on') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Level 2 on') as HTMLInputElement).checked).toBe(false);
    expect(within(screen.getByRole('article', { name: 'Level 1' })).getByRole('img', { name: 'Level 1 picture' }).getAttribute('src')).toBe('/media/find/1.png');
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
    expect(within(articles[0]).getByRole('button', { name: '+ Choose images' })).toBeTruthy();
    expect(articles[1].getAttribute('aria-label')).toBe('Level 1');
    expect(within(articles[1]).getByRole('img', { name: 'Level 1 picture' }).getAttribute('src')).toBe('/media/find/1.png');
  });

  it('Save stays disabled until a picture, 2 objects and a word for each exist', async () => {
    await renderWith([level(1)]);
    expect(saveBtn().disabled).toBe(true); // nothing changed
    fireEvent.click(screen.getByRole('button', { name: 'Add level' }));
    expect(saveBtn().disabled).toBe(true);
    h.listLibrary.mockResolvedValue(['find/a.png']);
    fireEvent.click(within(screen.getByRole('article', { name: 'Level 2' })).getByRole('button', { name: '+ Choose images' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Choose a.png' }));
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(saveBtn().disabled).toBe(true); // no objects yet
    clickPicture(2, 0.2, 0.2);
    expect(saveBtn().disabled).toBe(true); // 1 object
    clickPicture(2, 0.5, 0.5);
    expect(saveBtn().disabled).toBe(true); // 2 objects, no words
    const art2 = within(screen.getByRole('article', { name: 'Level 2' }));
    fireEvent.change(art2.getByLabelText('Word for object 1'), { target: { value: 'cat' } });
    expect(saveBtn().disabled).toBe(true); // second word missing
    fireEvent.change(art2.getByLabelText('Word for object 2'), { target: { value: 'dog' } });
    expect(saveBtn().disabled).toBe(false);
  });

  it('a picture from the library sets the shared path and no copy is made', async () => {
    h.listLibrary.mockResolvedValue(['find/shared.png']);
    await renderWith([level(1, { image: null, objects: [] })]);
    fireEvent.click(within(screen.getByRole('article', { name: 'Level 1' })).getByRole('button', { name: '+ Choose images' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Choose shared.png' }));
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(h.listLibrary).toHaveBeenCalledWith('image');
    expect(within(screen.getByRole('article', { name: 'Level 1' })).getByRole('img', { name: 'Level 1 picture' }).getAttribute('src')).toBe('/media/find/shared.png');
    expect(h.addPending).not.toHaveBeenCalled();
  });

  it('a sound from the library goes on the chosen object only', async () => {
    h.listLibrary.mockResolvedValue(['find/cat.mp3']);
    await renderWith([level(1)]);
    fireEvent.click(screen.getByRole('button', { name: 'Choose sound for object 2' }));
    expect(h.listLibrary).toHaveBeenCalledWith('audio');
    fireEvent.click(await screen.findByRole('button', { name: 'Choose cat.mp3' }));
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    const row2 = screen.getByLabelText('Object 2 row');
    expect(row2.textContent).toContain('cat.mp3');
    expect(screen.getByLabelText('Object 1 row').textContent).toContain('No sound');
    expect(saveBtn().disabled).toBe(false);
  });


  it('shows the incomplete count in the status line', async () => {
    await renderWith([level(1, { objects: [obj('cat')] }), level(2)]);
    expect(screen.getByRole('status').textContent).toBe('1 level needs a picture, 2 to 12 objects and a word for each');
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
    expect(h.saveFindLevels).not.toHaveBeenCalled();
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

  it('Save calls saveFindLevels(saved, draft), then reloads', async () => {
    const first = [level(1)];
    await renderWith(first);
    fireEvent.click(screen.getByLabelText('Level 1 on'));
    h.loadFindLevels.mockResolvedValue([level(1, { active: false })]);
    fireEvent.click(saveBtn());
    await waitFor(() => expect(h.loadFindLevels).toHaveBeenCalledTimes(2));
    expect(h.saveFindLevels).toHaveBeenCalledWith(first, [level(1, { active: false })]);
    await waitFor(() => expect(saveBtn().disabled).toBe(true));
  });

  it('shows the save error and keeps the draft', async () => {
    h.saveFindLevels.mockResolvedValue({ error: 'db down', warning: null });
    await renderWith([level(1)]);
    fireEvent.click(screen.getByLabelText('Level 1 on'));
    fireEvent.click(saveBtn());
    expect((await screen.findByRole('alert')).textContent).toBe('db down');
    expect(saveBtn().disabled).toBe(false);
  });

  it('"Preview as child" links to the level and is hidden for a new level', async () => {
    await renderWith([level(1)]);
    expect(screen.getByRole('link', { name: 'Preview as child' }).getAttribute('href')).toBe('/games/find/l1?preview=1');
    fireEvent.click(screen.getByRole('button', { name: 'Add level' }));
    expect(screen.getAllByRole('link', { name: 'Preview as child' })).toHaveLength(1);
  });

  it('the admin nav has a Find link after Spot', () => {
    render(<AdminNav />);
    const links = screen.getAllByRole('link').map((a) => a.textContent);
    expect(links.indexOf('Find')).toBe(links.indexOf('Spot') + 1);
    expect(screen.getByRole('link', { name: 'Find' }).getAttribute('href')).toBe('/admin/find');
    expect(screen.getByRole('link', { name: 'Find' }).getAttribute('aria-current')).toBe('page');
  });

  it('a saved level starts collapsed to its header and a small picture; the header toggles the rest open and closed', async () => {
    h.loadFindLevels.mockResolvedValue([level(1)]);
    render(<FindPage />);
    await screen.findByRole('button', { name: 'Add level' });
    const art = within(screen.getByRole('article', { name: 'Level 1' }));
    expect(art.getByRole('img', { name: 'Level 1 picture' })).toBeTruthy(); // the picture stays visible to follow the level
    expect(art.getByRole('button', { name: 'Delete level 1' })).toBeTruthy();
    expect(art.queryByRole('button', { name: '+ Choose images' })).toBeNull();
    expect(art.queryByRole('img', { name: 'Picture' })).toBeNull(); // the marker editor is closed
    fireEvent.click(art.getByRole('button', { name: 'Expand level 1' }));
    expect(art.getByRole('button', { name: '+ Choose images' })).toBeTruthy();
    expect(art.getByRole('img', { name: 'Picture' })).toBeTruthy();
    fireEvent.click(art.getByRole('button', { name: 'Collapse level 1' }));
    expect(art.queryByRole('button', { name: '+ Choose images' })).toBeNull();
    expect(art.getByRole('img', { name: 'Level 1 picture' })).toBeTruthy();
  });

  it('sorts by created, newest first by default; the icon button reverses it and numbers stay', async () => {
    await renderWith([level(1), level(2), level(3)]);
    const order = () => screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'));
    expect(order()).toEqual(['Level 3', 'Level 2', 'Level 1']);
    fireEvent.click(screen.getByRole('button', { name: /^Sort levels/ }));
    expect(order()).toEqual(['Level 1', 'Level 2', 'Level 3']);
  });
});
