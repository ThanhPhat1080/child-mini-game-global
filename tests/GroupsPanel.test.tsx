import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GroupsPanel } from '@/components/admin/GroupsPanel';
import { validateGroupName, type EGroup } from '@/lib/memory/adminCards';

const g = (id: string, name: string): EGroup => ({ id, isNew: false, name });
const GROUPS = [g('g1', 'Animals'), g('g2', 'Fruit')];

function setup(o: { groups?: EGroup[]; usage?: Map<string, number>; onAdd?: (n: string) => string | null; onRename?: (id: string, n: string) => string | null } = {}) {
  const groups = o.groups ?? GROUPS;
  const onAdd = vi.fn(o.onAdd ?? ((n: string) => validateGroupName(n, groups)));
  const onRename = vi.fn(o.onRename ?? ((id: string, n: string) => validateGroupName(n, groups, id)));
  const onDelete = vi.fn();
  render(<GroupsPanel groups={groups} usage={o.usage ?? new Map()} onAdd={onAdd} onRename={onRename} onDelete={onDelete} />);
  return { onAdd, onRename, onDelete };
}

const addInput = () => screen.getByLabelText('New group name') as HTMLInputElement;
const addBtn = () => screen.getByRole('button', { name: 'Add group' });

afterEach(cleanup);

describe('GroupsPanel (A17)', () => {
  it('shows a chip with the name for every group', () => {
    setup();
    const list = screen.getByRole('list', { name: 'Groups' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((li) => li.querySelector('[data-chip-name]')?.textContent)).toEqual(['Animals', 'Fruit']);
    expect(screen.getByRole('heading', { name: 'Groups' })).toBeTruthy();
  });

  it('with no groups says so', () => {
    setup({ groups: [] });
    expect(screen.getByText(/No groups yet/)).toBeTruthy();
  });

  it('adding "Birds" calls onAdd and clears the input', () => {
    const { onAdd } = setup();
    fireEvent.change(addInput(), { target: { value: 'Birds' } });
    fireEvent.click(addBtn());
    expect(onAdd).toHaveBeenCalledWith('Birds');
    expect(addInput().value).toBe('');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Enter in the input adds', () => {
    const { onAdd } = setup();
    fireEvent.change(addInput(), { target: { value: 'Birds' } });
    fireEvent.keyDown(addInput(), { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledWith('Birds');
    expect(addInput().value).toBe('');
  });

  it('errors from onAdd show under the input and keep the text (empty, 41 characters, duplicate)', () => {
    const { onAdd } = setup();
    fireEvent.click(addBtn());
    expect(screen.getByRole('alert').textContent).toBe('Give the group a name.');

    const long = 'x'.repeat(41);
    fireEvent.change(addInput(), { target: { value: long } });
    fireEvent.click(addBtn());
    expect(screen.getByRole('alert').textContent).toBe('Keep the name to 40 characters or fewer.');
    expect(addInput().value).toBe(long);

    fireEvent.change(addInput(), { target: { value: ' animals ' } });
    expect(screen.queryByRole('alert')).toBeNull(); // typing clears the old message
    fireEvent.keyDown(addInput(), { key: 'Enter' });
    expect(screen.getByRole('alert').textContent).toBe('Another group already has this name.');
    expect(addInput().value).toBe(' animals ');
    expect(onAdd).toHaveBeenCalledTimes(3);
    // the message sits under the input
    const alert = screen.getByRole('alert');
    expect(addInput().compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(addInput().getAttribute('aria-describedby')).toBe(alert.id);
  });

  it('Escape clears the input and adds nothing', () => {
    const { onAdd } = setup();
    fireEvent.change(addInput(), { target: { value: 'Birds' } });
    fireEvent.keyDown(addInput(), { key: 'Escape' });
    expect(onAdd).not.toHaveBeenCalled();
    expect(addInput().value).toBe('');
  });

  it('rename inline: Enter saves through onRename', () => {
    const { onRename } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Rename group Animals' }));
    const input = screen.getByLabelText('New name for group Animals') as HTMLInputElement;
    expect(input.value).toBe('Animals');
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: 'Pets' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('g1', 'Pets');
    expect(screen.queryByLabelText('New name for group Animals')).toBeNull();
  });

  it('rename: a refused name shows the error under the rename input and stays in edit mode', () => {
    const { onRename } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Rename group Animals' }));
    const input = screen.getByLabelText('New name for group Animals') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'FRUIT' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('g1', 'FRUIT');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Another group already has this name.');
    expect(input.getAttribute('aria-describedby')).toBe(alert.id);
    expect(screen.getByLabelText('New name for group Animals')).toBeTruthy();
  });

  it('rename: Escape cancels without calling onRename; the OK button also renames', () => {
    const { onRename } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Rename group Fruit' }));
    fireEvent.change(screen.getByLabelText('New name for group Fruit'), { target: { value: 'Veg' } });
    fireEvent.keyDown(screen.getByLabelText('New name for group Fruit'), { key: 'Escape' });
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('New name for group Fruit')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Rename group Fruit' }));
    fireEvent.change(screen.getByLabelText('New name for group Fruit'), { target: { value: 'Veg' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm new name for group Fruit' }));
    expect(onRename).toHaveBeenCalledWith('g2', 'Veg');
  });

  it('delete asks for a confirmation that says how many cards use it; Cancel deletes nothing', () => {
    const { onDelete } = setup({ usage: new Map([['g1', 3], ['g2', 1]]) });
    fireEvent.click(screen.getByRole('button', { name: 'Delete group Animals' }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByRole('heading').textContent).toBe('Delete the group “Animals”?');
    expect(dialog.textContent).toContain('3 cards use this group. They will have no group.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete group Fruit' }));
    expect(screen.getByRole('alertdialog').textContent).toContain('1 card uses this group. It will have no group.');
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete group' }));
    expect(onDelete).toHaveBeenCalledWith('g2');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('delete of an unused group says no card uses it', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete group Animals' }));
    expect(screen.getByRole('alertdialog').textContent).toContain('No card uses this group.');
  });
});
