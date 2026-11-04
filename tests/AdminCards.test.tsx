import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ECard, EGroup } from '@/lib/memory/adminCards';

const h = vi.hoisted(() => ({
  loadCards: vi.fn(),
  saveCards: vi.fn(),
  loadGroups: vi.fn(),
  saveGroups: vi.fn(),
  deleteGroups: vi.fn(),
  sayWord: vi.fn(),
  addPending: vi.fn(),
  clearPending: vi.fn(),
  svgToPending: vi.fn(),
  upload: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    from: () => { throw new Error('the page must not touch the database directly'); },
    storage: { from: () => ({ upload: h.upload, remove: h.upload }) },
  }),
}));
vi.mock('@/lib/memory/adminCards', async (orig) => ({
  ...(await orig<typeof import('@/lib/memory/adminCards')>()),
  loadCards: h.loadCards,
  saveCards: h.saveCards,
  loadGroups: h.loadGroups,
  saveGroups: h.saveGroups,
  deleteGroups: h.deleteGroups,
}));
vi.mock('@/lib/memory/cards', () => ({ sayWord: h.sayWord }));
const lib = vi.hoisted(() => ({ listLibrary: vi.fn() }));
vi.mock('@/lib/media/library', () => ({ listLibrary: lib.listLibrary }));
vi.mock('@/lib/media', async (orig) => ({
  ...(await orig<typeof import('@/lib/media')>()),
  addPending: h.addPending,
  clearPending: h.clearPending,
  svgToPending: h.svgToPending,
  mediaUrl: (p: string | null) => (p ? (p.startsWith('pending:') ? `blob:${p}` : `/media/${p}`) : null),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => '/admin/cards' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

import CardsPage from '@/app/admin/(panel)/cards/page';
import { AdminNav } from '@/components/AdminNav';
import { CardPanel } from '@/components/admin/CardPanel';

const card = (n: number, o: Partial<ECard> = {}): ECard => ({ id: `c${n}`, isNew: false, word: `word${n}`, image: `cards/${n}.png`, audio: null, active: true, groupId: null, ...o });
const cards = (n: number, active = true) => Array.from({ length: n }, (_, i) => card(i + 1, { active }));

const saveBtn = () => screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
const revertBtn = () => screen.getByRole('button', { name: 'Revert' }) as HTMLButtonElement;
const word = (n: number) => screen.getByLabelText(`Word for card ${n}`) as HTMLInputElement;
const toggle = (n: number) => screen.getByRole('switch', { name: `Card ${n} on` }) as HTMLInputElement;
const health = () => screen.getByTestId('pool-health').textContent ?? '';

/** Picks a file from the library for one field, then the file, then OK. */
async function chooseFromLibrary(label: string, name: string) {
  fireEvent.click(screen.getByRole('button', { name: `Choose from library for ${label}` }));
  fireEvent.click(await screen.findByRole('button', { name: `Choose ${name}` }));
  fireEvent.click(screen.getByRole('button', { name: 'OK' }));
}

async function renderWith(list: ECard[], groups: EGroup[] = []) {
  h.loadCards.mockResolvedValue(list);
  h.loadGroups.mockResolvedValue(groups);
  render(<CardsPage />);
  await screen.findByRole('button', { name: 'Add card' });
  await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull());
}

beforeEach(() => {
  for (const f of Object.values(h)) f.mockReset();
  h.saveCards.mockResolvedValue({ error: null, warning: null });
  h.saveGroups.mockResolvedValue({ error: null });
  h.deleteGroups.mockResolvedValue({ error: null });
  h.loadGroups.mockResolvedValue([]);
  let n = 0;
  h.addPending.mockImplementation(() => `pending:${++n}`);
  h.svgToPending.mockImplementation(() => 'pending:svg');
  lib.listLibrary.mockResolvedValue(['cards/lion.png', 'cards/robin.png']);
});
afterEach(cleanup);

describe('Admin cards page (A11, A13)', () => {
  it('lists every card with its picture, word and on/off toggle', async () => {
    await renderWith([card(1), card(2, { active: false })]);
    expect(word(1).value).toBe('word1');
    expect(word(2).value).toBe('word2');
    expect((screen.getByRole('img', { name: 'Card 1 picture' }) as HTMLImageElement).getAttribute('src')).toBe('/media/cards/1.png');
    expect(toggle(1).checked).toBe(true);
    expect(toggle(2).checked).toBe(false);
  });

  it('"Add card" puts an empty card at the top', async () => {
    await renderWith([card(1)]);
    fireEvent.click(screen.getByRole('button', { name: 'Add card' }));
    expect(word(1).value).toBe('');
    expect(word(2).value).toBe('word1');
    expect(toggle(1).checked).toBe(true);
    expect(screen.queryByRole('img', { name: 'Card 1 picture' })).toBeNull();
  });

  it('Save stays disabled until every card is complete and something changed', async () => {
    await renderWith([card(1)]);
    expect(saveBtn().disabled).toBe(true); // nothing changed yet
    fireEvent.click(screen.getByRole('button', { name: 'Add card' }));
    expect(saveBtn().disabled).toBe(true); // new card has no word and no picture
    fireEvent.change(word(1), { target: { value: 'lion' } });
    expect(saveBtn().disabled).toBe(true); // still no picture
    await chooseFromLibrary('card 1 picture', 'lion.png');
    expect(saveBtn().disabled).toBe(false);
  });

  it('the word input stops at 40 characters and shows a counter', async () => {
    await renderWith([card(1)]);
    expect(word(1).maxLength).toBe(40);
    expect(screen.getByText('5/40')).toBeTruthy();
  });

  it('Save calls saveCards(saved, draft), then reloads and clears picked files', async () => {
    const first = [card(1)];
    await renderWith(first);
    fireEvent.change(word(1), { target: { value: 'kitten' } });
    const after = [card(1, { word: 'kitten' })];
    h.loadCards.mockResolvedValue(after);
    h.clearPending.mockClear();
    fireEvent.click(saveBtn());
    await waitFor(() => expect(h.loadCards).toHaveBeenCalledTimes(2));
    expect(h.saveCards).toHaveBeenCalledWith(first, [card(1, { word: 'kitten' })]);
    await waitFor(() => expect(saveBtn().disabled).toBe(true));
    expect(h.clearPending).toHaveBeenCalled();
    expect(word(1).value).toBe('kitten');
  });

  it('Revert restores the loaded cards and forgets picked files', async () => {
    await renderWith([card(1)]);
    fireEvent.change(word(1), { target: { value: 'changed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add card' }));
    h.clearPending.mockClear();
    fireEvent.click(revertBtn());
    expect(word(1).value).toBe('word1');
    expect(screen.queryByLabelText('Word for card 2')).toBeNull();
    expect(h.clearPending).toHaveBeenCalled();
    expect(revertBtn().disabled).toBe(true);
  });

  it('Delete asks first: Cancel keeps the card, confirming removes it from the draft only', async () => {
    await renderWith([card(1), card(2)]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete card 1' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(word(1).value).toBe('word1');

    fireEvent.click(screen.getByRole('button', { name: 'Delete card 1' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete card' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(word(1).value).toBe('word2');
    expect(screen.queryByLabelText('Word for card 2')).toBeNull();
    expect(h.saveCards).not.toHaveBeenCalled();
    expect(saveBtn().disabled).toBe(false);
  });




  it('SVG code becomes a picture through svgToPending', async () => {
    await renderWith([card(1)]);
    fireEvent.change(screen.getByLabelText('SVG code for card 1'), { target: { value: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use SVG for card 1' }));
    expect(h.svgToPending).toHaveBeenCalledWith('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(screen.getByRole('img', { name: 'Card 1 picture' }).getAttribute('src')).toBe('blob:pending:svg');
  });

  it('pasted SVG with a script or an event handler is refused inline and never stored', async () => {
    await renderWith([card(1)]);
    const paste = (code: string) => {
      fireEvent.change(screen.getByLabelText('SVG code for card 1'), { target: { value: code } });
      fireEvent.click(screen.getByRole('button', { name: 'Use SVG for card 1' }));
    };
    paste('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(screen.getByText('SVG code may not contain scripts, foreignObject or embedded content.')).toBeTruthy();
    paste('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="4" height="4"/></svg>');
    expect(screen.getByText('SVG code may not contain event handlers such as onclick.')).toBeTruthy();
    expect(h.svgToPending).not.toHaveBeenCalled();
    expect(h.addPending).not.toHaveBeenCalled();
    expect(screen.getByRole('img', { name: 'Card 1 picture' }).getAttribute('src')).toBe('/media/cards/1.png');
  });

  it('valid pasted SVG is accepted, and drawings that differ only in whitespace share one pending file', async () => {
    const tokens = new Map<string, string>();
    h.svgToPending.mockImplementation((svg: string) => {
      if (!tokens.has(svg)) tokens.set(svg, `pending:svg${tokens.size + 1}`);
      return tokens.get(svg)!;
    });
    await renderWith([card(1), card(2)]);
    const paste = (n: number, code: string) => {
      fireEvent.change(screen.getByLabelText(`SVG code for card ${n}`), { target: { value: code } });
      fireEvent.click(screen.getByRole('button', { name: `Use SVG for card ${n}` }));
    };
    paste(1, '<svg xmlns="http://www.w3.org/2000/svg"><rect width="4" height="4"/></svg>');
    paste(2, '  <svg xmlns="http://www.w3.org/2000/svg">\n   <rect  width="4"\n height="4"/>\n</svg>\n');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(tokens.size).toBe(1);
    expect(screen.getByRole('img', { name: 'Card 1 picture' }).getAttribute('src')).toBe('blob:pending:svg1');
    expect(screen.getByRole('img', { name: 'Card 2 picture' }).getAttribute('src')).toBe('blob:pending:svg1');
  });



  it('two cards with the same word show a warning that does not block Save', async () => {
    await renderWith([card(1), card(2)]);
    fireEvent.change(word(2), { target: { value: ' WORD1 ' } });
    expect(screen.getAllByText('Another card has the same word.')).toHaveLength(2);
    expect(saveBtn().disabled).toBe(false);
  });

  it('"play" says the card through sayWord', async () => {
    await renderWith([card(1), card(2, { audio: 'card-voices/2.mp3' })]);
    fireEvent.click(screen.getByRole('button', { name: 'Play card 2' }));
    expect(h.sayWord).toHaveBeenCalledWith({ word: 'word2', audio_path: 'card-voices/2.mp3' });
  });

  it('the pool health line reflects active cards', async () => {
    await renderWith(cards(12));
    expect(health()).toBe('12 active cards: levels 12, 16, 20 and 24 are available; 30 needs 15.');
    fireEvent.click(toggle(1));
    expect(health()).toBe('11 active cards: levels 12, 16 and 20 are available; 24 needs 12, 30 needs 15.');
  });

  it('pool health with 5 and 6 active cards', async () => {
    await renderWith(cards(6));
    expect(health()).toBe('6 active cards: level 12 is available; 16 needs 8, 20 needs 10, 24 needs 12, 30 needs 15.');
  });

  it('pool health with 0 and with 15 active cards', async () => {
    await renderWith(cards(3, false));
    expect(health()).toBe('0 active cards: no level is available yet; 12 needs 6, 16 needs 8, 20 needs 10, 24 needs 12, 30 needs 15.');
    cleanup();
    await renderWith(cards(15));
    expect(health()).toBe('15 active cards: levels 12, 16, 20, 24 and 30 are available.');
  });

  it('a failing save shows the error and keeps the draft', async () => {
    await renderWith([card(1)]);
    fireEvent.change(word(1), { target: { value: 'kitten' } });
    h.saveCards.mockResolvedValue({ error: 'network down', warning: null });
    fireEvent.click(saveBtn());
    expect(await screen.findByText('network down')).toBeTruthy();
    expect(word(1).value).toBe('kitten');
    expect(h.loadCards).toHaveBeenCalledTimes(1);
    expect(saveBtn().disabled).toBe(false);
  });

  it('a save warning is shown but the save still goes through', async () => {
    await renderWith([card(1)]);
    fireEvent.change(word(1), { target: { value: 'kitten' } });
    h.loadCards.mockResolvedValue([card(1, { word: 'kitten' })]);
    h.saveCards.mockResolvedValue({ error: null, warning: 'Some old files could not be removed.' });
    await act(async () => { fireEvent.click(saveBtn()); });
    expect(await screen.findByText('Some old files could not be removed.')).toBeTruthy();
    await waitFor(() => expect(h.loadCards).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(saveBtn().disabled).toBe(true));
  });

  describe('Sort It pool health (A13)', () => {
    const sortHealthText = () => screen.getByTestId('sort-health').textContent ?? '';
    const grouped = (gid: string, n: number, start = 1) => Array.from({ length: n }, (_, i) => card(start + i, { groupId: gid }));

    it('shows the Sort It line under the pool health', async () => {
      await renderWith(cards(3));
      expect(sortHealthText()).toBe('Sort It: 0 groups can be played so far (2 are needed, each with 4 cards).');
      expect(screen.getByTestId('pool-health').compareDocumentPosition(screen.getByTestId('sort-health')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('counts saved groups with 4 cards', async () => {
      await renderWith([...grouped('g1', 4), ...grouped('g2', 4, 5)], [{ id: 'g1', isNew: false, name: 'A' }, { id: 'g2', isNew: false, name: 'B' }]);
      expect(sortHealthText()).toBe('Sort It: 2 groups can be played (2 are needed, each with 4 cards).');
    });

    it('counts unsaved changes: tagging a fourth card with a group, and the note says so', async () => {
      await renderWith([...grouped('g1', 3), card(4)], [{ id: 'g1', isNew: false, name: 'A' }]);
      expect(sortHealthText()).toMatch(/^Sort It: 0 groups/);
      fireEvent.change(screen.getByRole('combobox', { name: 'Group for card 4' }), { target: { value: 'g1' } });
      expect(sortHealthText()).toMatch(/^Sort It: 1 group can be played so far/);
      expect(screen.getByText(/Counts include unsaved changes/)).toBeTruthy();
    });

    it('counts cards tagged to a group created in this session', async () => {
      await renderWith(cards(4));
      fireEvent.change(screen.getByLabelText('New group name'), { target: { value: 'Birds' } });
      fireEvent.keyDown(screen.getByLabelText('New group name'), { key: 'Enter' });
      const select = screen.getByRole('combobox', { name: 'Group for card 1' }) as HTMLSelectElement;
      const birds = Array.from(select.options).find((o) => o.textContent === 'Birds')!.value;
      for (let n = 1; n <= 4; n++) fireEvent.change(screen.getByRole('combobox', { name: `Group for card ${n}` }), { target: { value: birds } });
      expect(sortHealthText()).toMatch(/^Sort It: 1 group can be played so far/);
    });

    it('Quick import resolves a group created in this session and counts it', async () => {
      await renderWith([card(1)]);
      fireEvent.change(screen.getByLabelText('New group name'), { target: { value: 'Birds' } });
      fireEvent.keyDown(screen.getByLabelText('New group name'), { key: 'Enter' });
      fireEvent.click(screen.getByRole('button', { name: 'Quick import cards' }));
      const json = JSON.stringify({ cards: ['a', 'b', 'c', 'd'].map((w) => ({ word: w, image: 'https://example.com/b.png', group: 'birds' })) });
      const input = document.querySelector('input[type="file"][accept=".json,application/json"]') as HTMLInputElement;
      const f = new File([json], 'c.json', { type: 'application/json' });
      Object.defineProperty(f, 'text', { value: () => Promise.resolve(json) });
      fireEvent.change(input, { target: { files: [f] } });
      fireEvent.click(await screen.findByRole('button', { name: 'Import 4 cards' }));
      expect(sortHealthText()).toMatch(/^Sort It: 1 group can be played so far/);
      expect((screen.getByRole('combobox', { name: 'Group for card 2' }) as HTMLSelectElement).selectedOptions[0].textContent).toBe('Birds');
    });
  });

  it('Quick import cards puts them at the top as unsaved changes; identical SVG shares one pending token', async () => {
    const tokens = new Map<string, string>();
    h.svgToPending.mockImplementation((svg: string) => {
      if (!tokens.has(svg)) tokens.set(svg, `pending:svg${tokens.size + 1}`);
      return tokens.get(svg)!;
    });
    await renderWith([card(1)]);
    expect(saveBtn().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Quick import cards' }));
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'><rect width='8' height='8'/></svg>";
    const json = JSON.stringify({ cards: [
      { word: 'lion', image: svg }, { word: 'tiger', image: svg }, { word: 'bear', image: 'https://example.com/b.png' }, { word: 'fox', image: '', active: false },
    ] });
    const input = document.querySelector('input[type="file"][accept=".json,application/json"]') as HTMLInputElement;
    const f = new File([json], 'c.json', { type: 'application/json' });
    Object.defineProperty(f, 'text', { value: () => Promise.resolve(json) });
    fireEvent.change(input, { target: { files: [f] } });
    fireEvent.click(await screen.findByRole('button', { name: 'Import 4 cards' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect([1, 2, 3, 4].map((n) => word(n).value)).toEqual(['lion', 'tiger', 'bear', 'fox']);
    expect(tokens.size).toBe(1);
    expect(screen.getByRole('img', { name: 'Card 1 picture' }).getAttribute('src')).toBe('blob:pending:svg1');
    expect(screen.getByRole('img', { name: 'Card 2 picture' }).getAttribute('src')).toBe('blob:pending:svg1');
    expect(toggle(4).checked).toBe(false);
    expect(screen.queryByRole('img', { name: 'Card 4 picture' })).toBeNull();
    expect(saveBtn().disabled).toBe(true); // fox has no picture yet
    expect(screen.getByText(/1 card needs a picture/)).toBeTruthy();
    expect(h.saveCards).not.toHaveBeenCalled();
    fireEvent.click(revertBtn());
    expect(screen.queryByLabelText('Word for card 2')).toBeNull();
  });

  describe('Quick import cards header button', () => {
    const importBtn = () => screen.getByRole('button', { name: 'Quick import cards' }) as HTMLButtonElement;

    it('sits in the sticky header before Revert and Save, as a blue text button', async () => {
      await renderWith([card(1)]);
      expect(screen.getAllByRole('button', { name: 'Quick import cards' })).toHaveLength(1);
      const header = revertBtn().closest('div[style*="sticky"]') as HTMLElement;
      expect(header).toBeTruthy();
      expect(header.contains(importBtn())).toBe(true);
      expect(header.contains(saveBtn())).toBe(true);
      const order = Array.from(header.querySelectorAll('button')).map((b) => b.textContent);
      expect(order).toEqual(['Quick import cards', 'Revert', 'Save']);
      const css = getComputedStyle(importBtn());
      expect(css.color).toBe('rgb(63, 115, 181)'); // the blue of the set editor's import button
      expect(css.backgroundColor === 'transparent' || css.backgroundColor === 'rgba(0, 0, 0, 0)' || css.backgroundColor === '').toBe(true);
      expect(css.height).toBe('44px');
    });

    it('opens the dialog with no unsaved changes (Save and Revert disabled)', async () => {
      await renderWith([card(1)]);
      expect(saveBtn().disabled).toBe(true);
      expect(revertBtn().disabled).toBe(true);
      expect(importBtn().disabled).toBe(false);
      fireEvent.click(importBtn());
      expect(await screen.findByRole('dialog', { name: 'Quick import cards' })).toBeTruthy();
    });

    it('is disabled while a save is running', async () => {
      await renderWith([card(1)]);
      fireEvent.change(word(1), { target: { value: 'kitten' } });
      let done: (v: { error: null }) => void = () => {};
      h.saveCards.mockReturnValue(new Promise((r) => { done = r; }));
      h.loadCards.mockResolvedValue([card(1, { word: 'kitten' })]);
      await act(async () => { fireEvent.click(saveBtn()); });
      expect(importBtn().disabled).toBe(true);
      await act(async () => { done({ error: null }); });
      await waitFor(() => expect(importBtn().disabled).toBe(false));
    });
  });

  it('the admin nav has a "Cards" link, marked current on /admin/cards', () => {
    render(<AdminNav />);
    const link = screen.getByRole('link', { name: 'Cards' });
    expect(link.getAttribute('href')).toBe('/admin/cards');
    expect(link.getAttribute('aria-current')).toBe('page');
  });
});

describe('CardPanel group picker (A18)', () => {
  const GROUPS: EGroup[] = [{ id: 'g1', isNew: false, name: 'Animals' }, { id: 'g2', isNew: true, name: 'Fruit' }];
  const WEAK = 'Sort It needs at least 4 cards with different words in a group.';
  function renderPanel(c: ECard, weakGroup = false) {
    const onEdit = vi.fn();
    const noop = () => {};
    render(
      <CardPanel c={c} n={3} duplicate={false} message={null} autoFocus={false} groups={GROUPS} weakGroup={weakGroup}
        onEdit={onEdit} onChooseLibrary={noop} onSvg={noop} onPlay={noop} onAskDelete={noop} />,
    );
    return { onEdit, select: screen.getByRole('combobox', { name: 'Group for card 3' }) as HTMLSelectElement };
  }

  it('lists "No group" first, then the groups in order', () => {
    const { select } = renderPanel(card(3));
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['No group', 'Animals', 'Fruit']);
    expect(select.options[select.selectedIndex].textContent).toBe('No group');
  });

  it('shows the card\'s group and choosing another calls onEdit({ groupId })', () => {
    const { select, onEdit } = renderPanel(card(3, { groupId: 'g1' }));
    expect(select.options[select.selectedIndex].textContent).toBe('Animals');
    fireEvent.change(select, { target: { value: 'g2' } });
    expect(onEdit).toHaveBeenCalledWith({ groupId: 'g2' });
    fireEvent.change(select, { target: { value: '' } });
    expect(onEdit).toHaveBeenLastCalledWith({ groupId: null });
  });

  it('a card whose group is missing shows "No group"', () => {
    const { select } = renderPanel(card(3, { groupId: 'gone' }));
    expect(select.value).toBe('');
    expect(select.options[select.selectedIndex].textContent).toBe('No group');
  });

  it('the weak group warning shows only when weakGroup', () => {
    renderPanel(card(3, { groupId: 'g1' }));
    expect(screen.queryByText(WEAK)).toBeNull();
    cleanup();
    renderPanel(card(3, { groupId: 'g1' }), true);
    expect(screen.getByText(WEAK).getAttribute('role')).toBe('status');
  });
});

describe('Admin cards page: groups (A17, A18)', () => {
  const grp = (id: string, name: string, o: Partial<EGroup> = {}): EGroup => ({ id, isNew: false, name, ...o });
  const ANIMALS = grp('g1', 'Animals');
  const FRUIT = grp('g2', 'Fruit');
  const picker = (n: number) => screen.getByRole('combobox', { name: `Group for card ${n}` }) as HTMLSelectElement;
  const picked = (n: number) => picker(n).options[picker(n).selectedIndex].textContent;
  const chips = () => screen.queryAllByRole('listitem').map((li) => li.querySelector('[data-chip-name]')?.textContent);
  const addGroup = (name: string) => {
    fireEvent.change(screen.getByLabelText('New group name'), { target: { value: name } });
    fireEvent.click(screen.getByRole('button', { name: 'Add group' }));
  };
  const rename = (from: string, to: string) => {
    fireEvent.click(screen.getByRole('button', { name: `Rename group ${from}` }));
    const input = screen.getByLabelText(`New name for group ${from}`);
    fireEvent.change(input, { target: { value: to } });
    fireEvent.keyDown(input, { key: 'Enter' });
  };
  const removeGroup = (name: string) => {
    fireEvent.click(screen.getByRole('button', { name: `Delete group ${name}` }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete group' }));
  };
  const order = (...fns: { mock: { invocationCallOrder: number[] } }[]) => fns.map((f) => f.mock.invocationCallOrder[0]);
  const WEAK = 'Sort It needs at least 4 cards with different words in a group.';

  it('loads the groups as chips above the cards and offers them in every picker', async () => {
    await renderWith([card(1, { groupId: 'g2' }), card(2)], [ANIMALS, FRUIT]);
    expect(h.loadGroups).toHaveBeenCalledTimes(1);
    expect(chips()).toEqual(['Animals', 'Fruit']);
    const groupsArea = screen.getByRole('region', { name: 'Groups' });
    expect(groupsArea.compareDocumentPosition(screen.getByRole('article', { name: 'Card 1' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(picked(1)).toBe('Fruit');
    expect(picked(2)).toBe('No group');
    expect(Array.from(picker(2).options).map((o) => o.textContent)).toEqual(['No group', 'Animals', 'Fruit']);
    expect(saveBtn().disabled).toBe(true);
  });

  it('group edits are unsaved changes; names are validated (empty, 41 characters, duplicate)', async () => {
    await renderWith([card(1)], [ANIMALS]);
    addGroup('  ');
    expect(screen.getByRole('alert').textContent).toBe('Give the group a name.');
    addGroup('x'.repeat(41));
    expect(screen.getByRole('alert').textContent).toBe('Keep the name to 40 characters or fewer.');
    addGroup(' ANIMALS ');
    expect(screen.getByRole('alert').textContent).toBe('Another group already has this name.');
    expect(saveBtn().disabled).toBe(true);
    addGroup(' Birds ');
    expect(chips()).toEqual(['Animals', 'Birds']);
    expect(saveBtn().disabled).toBe(false);
    expect(screen.getByText('Unsaved changes. Press Save to keep them.')).toBeTruthy();
    expect(h.saveGroups).not.toHaveBeenCalled();
  });

  it('Save writes groups, then cards, then deletes removed groups (in that order)', async () => {
    const before = [card(1, { groupId: 'g1' }), card(2, { groupId: 'g2' })];
    await renderWith(before, [ANIMALS, FRUIT]);
    rename('Animals', 'Pets');
    removeGroup('Fruit');
    h.loadCards.mockResolvedValue([card(1, { groupId: 'g1' }), card(2)]);
    h.loadGroups.mockResolvedValue([grp('g1', 'Pets')]);
    fireEvent.click(saveBtn());
    await waitFor(() => expect(h.loadCards).toHaveBeenCalledTimes(2));
    expect(h.saveGroups).toHaveBeenCalledWith([ANIMALS, FRUIT], [grp('g1', 'Pets')]);
    expect(h.saveCards).toHaveBeenCalledWith(before, [card(1, { groupId: 'g1' }), card(2, { groupId: null })]);
    expect(h.deleteGroups).toHaveBeenCalledWith(['g2']);
    const [g, c, d] = order(h.saveGroups, h.saveCards, h.deleteGroups);
    expect(g).toBeLessThan(c);
    expect(c).toBeLessThan(d);
    expect(h.loadGroups).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(saveBtn().disabled).toBe(true));
    expect(chips()).toEqual(['Pets']);
  });

  it('Save skips deleteGroups when no group was removed', async () => {
    await renderWith([card(1)], [ANIMALS]);
    rename('Animals', 'Pets');
    h.loadGroups.mockResolvedValue([grp('g1', 'Pets')]);
    fireEvent.click(saveBtn());
    await waitFor(() => expect(h.loadCards).toHaveBeenCalledTimes(2));
    expect(h.saveGroups).toHaveBeenCalled();
    expect(h.saveCards).toHaveBeenCalled();
    expect(h.deleteGroups).not.toHaveBeenCalled();
  });

  it('deleting a group asks how many cards use it and sets its draft cards to "No group" at once', async () => {
    await renderWith([card(1, { groupId: 'g1' }), card(2, { groupId: 'g1' }), card(3, { groupId: 'g2' })], [ANIMALS, FRUIT]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete group Animals' }));
    expect(screen.getByRole('alertdialog').textContent).toContain('2 cards use this group. They will have no group.');
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(picked(1)).toBe('Animals');
    removeGroup('Animals');
    expect(chips()).toEqual(['Fruit']);
    expect(picked(1)).toBe('No group');
    expect(picked(2)).toBe('No group');
    expect(picked(3)).toBe('Fruit');
    expect(Array.from(picker(1).options).map((o) => o.textContent)).toEqual(['No group', 'Fruit']);
    expect(h.deleteGroups).not.toHaveBeenCalled();

    fireEvent.click(saveBtn());
    await waitFor(() => expect(h.deleteGroups).toHaveBeenCalledWith(['g1']));
    const sent = h.saveCards.mock.calls[0][1] as ECard[];
    expect(sent.map((c) => c.groupId)).toEqual([null, null, 'g2']);
    expect(order(h.saveCards, h.deleteGroups)[0]).toBeLessThan(order(h.saveCards, h.deleteGroups)[1]);
  });

  it('a saveGroups error stops the Save: no saveCards, no deleteGroups, the draft stays', async () => {
    await renderWith([card(1, { groupId: 'g2' })], [ANIMALS, FRUIT]);
    rename('Animals', 'Pets');
    removeGroup('Fruit');
    h.saveGroups.mockResolvedValue({ error: 'network down' });
    fireEvent.click(saveBtn());
    expect(await screen.findByText('network down')).toBeTruthy();
    expect(h.saveCards).not.toHaveBeenCalled();
    expect(h.deleteGroups).not.toHaveBeenCalled();
    expect(h.loadCards).toHaveBeenCalledTimes(1);
    expect(chips()).toEqual(['Pets']);
    expect(picked(1)).toBe('No group');
    expect(saveBtn().disabled).toBe(false);
  });

  it('a duplicate-name error from the database shows a friendly message (rename to a name being deleted)', async () => {
    await renderWith([card(1)], [ANIMALS, FRUIT]);
    removeGroup('Fruit');
    rename('Animals', 'Fruit'); // allowed in the draft: Fruit is gone there, but still exists until the delete runs
    h.saveGroups.mockResolvedValue({ error: 'duplicate key value violates unique constraint "card_groups_name_unique"' });
    fireEvent.click(saveBtn());
    expect(await screen.findByText('A group with that name already exists.')).toBeTruthy();
    expect(screen.queryByText(/duplicate key/)).toBeNull();
    expect(h.saveCards).not.toHaveBeenCalled();
    expect(h.deleteGroups).not.toHaveBeenCalled();
    expect(chips()).toEqual(['Fruit']);
  });

  it('a swap of two names that the database refuses (code 23505) shows the friendly message', async () => {
    await renderWith([card(1)], [ANIMALS, FRUIT]);
    rename('Animals', 'Tmp');
    rename('Fruit', 'Animals');
    rename('Tmp', 'Fruit');
    expect(chips()).toEqual(['Fruit', 'Animals']);
    h.saveGroups.mockResolvedValue({ error: '23505' });
    fireEvent.click(saveBtn());
    expect(await screen.findByText('A group with that name already exists.')).toBeTruthy();
    expect(h.saveCards).not.toHaveBeenCalled();
    expect(chips()).toEqual(['Fruit', 'Animals']);
  });

  it('a saveCards error after the groups were written stops before deleteGroups', async () => {
    await renderWith([card(1, { groupId: 'g2' })], [ANIMALS, FRUIT]);
    removeGroup('Fruit');
    h.saveCards.mockResolvedValue({ error: 'cards failed', warning: null });
    fireEvent.click(saveBtn());
    expect(await screen.findByText('cards failed')).toBeTruthy();
    expect(h.deleteGroups).not.toHaveBeenCalled();
    expect(chips()).toEqual(['Animals']);
    expect(picked(1)).toBe('No group');
  });

  it('a deleteGroups error shows the error; the draft groups stay so Save can try the delete again', async () => {
    await renderWith([card(1, { groupId: 'g2' })], [ANIMALS, FRUIT]);
    removeGroup('Fruit');
    h.deleteGroups.mockResolvedValueOnce({ error: 'delete failed' });
    h.loadCards.mockResolvedValue([card(1)]); // the cards were saved
    fireEvent.click(saveBtn());
    expect(await screen.findByText('delete failed')).toBeTruthy();
    expect(chips()).toEqual(['Animals']);
    expect(picked(1)).toBe('No group');
    await waitFor(() => expect(saveBtn().disabled).toBe(false));
    h.loadGroups.mockResolvedValue([ANIMALS]);
    fireEvent.click(saveBtn());
    await waitFor(() => expect(h.deleteGroups).toHaveBeenCalledTimes(2));
    expect(h.deleteGroups).toHaveBeenLastCalledWith(['g2']);
    await waitFor(() => expect(saveBtn().disabled).toBe(true));
  });

  it('Revert discards both group and card edits', async () => {
    await renderWith([card(1, { groupId: 'g1' })], [ANIMALS, FRUIT]);
    fireEvent.change(word(1), { target: { value: 'changed' } });
    rename('Fruit', 'Veg');
    addGroup('Birds');
    removeGroup('Animals');
    expect(chips()).toEqual(['Veg', 'Birds']);
    expect(picked(1)).toBe('No group');
    fireEvent.click(revertBtn());
    expect(chips()).toEqual(['Animals', 'Fruit']);
    expect(word(1).value).toBe('word1');
    expect(picked(1)).toBe('Animals');
    expect(revertBtn().disabled).toBe(true);
    expect(saveBtn().disabled).toBe(true);
  });

  it('Save stays disabled while a card is incomplete; groups are optional', async () => {
    await renderWith([card(1)], []);
    addGroup('Birds');
    expect(saveBtn().disabled).toBe(false); // a group with no cards is fine, cards without a group are fine
    fireEvent.click(screen.getByRole('button', { name: 'Add card' }));
    expect(saveBtn().disabled).toBe(true);
    fireEvent.change(picker(1), { target: { value: picker(1).options[1].value } });
    expect(saveBtn().disabled).toBe(true); // a group never completes a card
    fireEvent.change(word(1), { target: { value: 'robin' } });
    await chooseFromLibrary('card 1 picture', 'robin.png');
    expect(saveBtn().disabled).toBe(false);
  });

  it('adding a group and tagging a card in one session saves with the new group\'s id', async () => {
    await renderWith([card(1), card(2)], [ANIMALS]);
    addGroup('Birds');
    const birds = Array.from(picker(1).options).find((o) => o.textContent === 'Birds')!.value;
    expect(birds).toMatch(/^[0-9a-f-]{36}$/);
    fireEvent.change(picker(1), { target: { value: birds } });
    expect(picked(1)).toBe('Birds');
    fireEvent.click(saveBtn());
    await waitFor(() => expect(h.saveCards).toHaveBeenCalled());
    expect(h.saveGroups).toHaveBeenCalledWith([ANIMALS], [ANIMALS, { id: birds, isNew: true, name: 'Birds' }]);
    expect((h.saveCards.mock.calls[0][1] as ECard[]).map((c) => c.groupId)).toEqual([birds, null]);
    expect(order(h.saveGroups)[0]).toBeLessThan(order(h.saveCards)[0]);
    expect(h.deleteGroups).not.toHaveBeenCalled();
  });

  it('cards of a group with fewer than 4 different words show the Sort It warning (not a block)', async () => {
    const list = [
      card(1, { groupId: 'g1' }), card(2, { groupId: 'g1' }), card(3, { groupId: 'g1' }),
      card(4, { groupId: 'g2' }), card(5, { groupId: 'g2' }), card(6, { groupId: 'g2' }), card(7, { groupId: 'g2' }),
      card(8),
    ];
    await renderWith(list, [ANIMALS, FRUIT]);
    expect(screen.getAllByText(WEAK)).toHaveLength(3);
    for (const n of [1, 2, 3]) expect(within(screen.getByRole('article', { name: `Card ${n}` })).queryByText(WEAK)).toBeTruthy();
    fireEvent.change(picker(8), { target: { value: 'g1' } });
    expect(screen.queryAllByText(WEAK)).toHaveLength(0);
    expect(saveBtn().disabled).toBe(false);
  });

  it('a load failure of the groups shows the error', async () => {
    h.loadCards.mockResolvedValue([card(1)]);
    h.loadGroups.mockRejectedValue(new Error('groups down'));
    render(<CardsPage />);
    expect(await screen.findByText('groups down')).toBeTruthy();
  });
});
