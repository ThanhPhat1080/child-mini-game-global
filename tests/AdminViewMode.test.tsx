import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpotMarkerEditor } from '@/components/admin/SpotMarkerEditor';
import { SpotLevelPanel } from '@/components/admin/SpotLevelPanel';
import { QuestionPanel } from '@/components/admin/QuestionPanel';
import { EditLock } from '@/components/admin/EditLock';
import { blankSet, newQuestion, type ESet } from '@/lib/sets';
import type { ELevel } from '@/lib/spot/adminLevels';
import type { Difference } from '@/lib/spot/types';

// the share row and the library button create a client on render; the view-mode checks never call it
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({ storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `/media/${p}` } }) }) } }) }));
vi.mock('@/lib/media/library', () => ({ listLibrary: async () => [] }));

afterEach(cleanup);

const diffs: Difference[] = [{ x: 0.2, y: 0.3, r: 0.06 }, { x: 0.6, y: 0.7, r: 0.08 }, { x: 0.5, y: 0.5, r: 0.05 }];

describe('View mode: SpotMarkerEditor readOnly', () => {
  it('shows the spots as plain numbered highlights, with no way to place or select them', () => {
    const onChange = vi.fn();
    render(<SpotMarkerEditor srcA="/a.png" srcB="/b.png" differences={diffs} onChange={onChange} readOnly />);
    const img = screen.getByRole('img', { name: 'Picture A' });
    img.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.click(img, { clientX: 100, clientY: 100 });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Spot 1' })).toBeNull();
    expect(screen.getByLabelText('Spot 1').textContent).toBe('1');
    expect(screen.getByLabelText('Spot 3').textContent).toBe('3');
    expect(screen.queryByLabelText('Radius')).toBeNull();
  });

  it('keeps the picture tabs usable so both pictures can be viewed', () => {
    render(<SpotMarkerEditor srcA="/a.png" srcB="/b.png" differences={diffs} onChange={vi.fn()} readOnly />);
    fireEvent.click(screen.getByRole('button', { name: 'Show picture B' }));
    expect(screen.getByRole('button', { name: 'Show picture B' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('img', { name: 'Picture B' })).toBeTruthy();
  });
});

describe('View mode: SpotLevelPanel', () => {
  const level: ELevel = { id: 'l1', isNew: false, a: 'a.png', b: 'b.png', differences: diffs, active: true, visibility: 'global' };
  const noop = () => undefined;

  it('the level header still opens, and the open level shows the read-only spots', () => {
    render(<SpotLevelPanel l={level} n={1} message={null} shapeWarning={false} onCropped={noop} onEdit={noop} onChooseLibrary={noop} onSvg={noop} onAskDelete={noop} />);
    const toggle = screen.getByRole('button', { name: 'Expand level 1' });
    expect(toggle.hasAttribute('disabled')).toBe(false);
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Collapse level 1' })).toBeTruthy();
    expect(screen.getByLabelText('Spot 2').textContent).toBe('2');
    expect(screen.queryByRole('button', { name: 'Spot 2' })).toBeNull();
  });
});

describe('View mode: QuestionPanel', () => {
  function setup(locked: boolean, qs = [newQuestion(), newQuestion()]) {
    const d: ESet = { ...blankSet(), isNew: false, name: 'Animals', qs };
    const onSelect = vi.fn();
    const onAdd = vi.fn();
    const onMove = vi.fn();
    render(
      <QuestionPanel
        d={d} cur={0} q={qs[0]} locked={locked}
        onSelect={onSelect} onAdd={onAdd} onMove={onMove} onEdit={noopEdit} onAskDelete={noop} onChooseLibrary={noop} onSvg={noop} onPlay={noop}
      />,
    );
    return { onSelect, onAdd, onMove };
  }
  const noop = () => undefined;
  const noopEdit = () => undefined;

  it('in View mode a question in the list can still be opened', () => {
    const { onSelect } = setup(true);
    const second = screen.getAllByRole('button', { name: /New question/ })[1];
    expect(second.hasAttribute('disabled')).toBe(false);
    fireEvent.click(second);
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('in View mode add, move and edit are hidden and do nothing', () => {
    const { onAdd } = setup(true);
    const add = screen.getByText('Add question').closest('button') as HTMLButtonElement;
    expect(add.style.visibility).toBe('hidden');
    fireEvent.click(add);
    expect(onAdd).not.toHaveBeenCalled();
    // the editor on the right is locked: its inputs are disabled
    const text = screen.getByLabelText('Question text') as HTMLInputElement;
    expect(text.matches(':disabled')).toBe(true);
  });

  it('outside View mode the same buttons are visible and work', () => {
    const { onAdd } = setup(false);
    const add = screen.getByText('Add question').closest('button') as HTMLButtonElement;
    expect(add.style.visibility).toBe('');
    fireEvent.click(add);
    expect(onAdd).toHaveBeenCalled();
  });
});

describe('EditLock', () => {
  it('a locked lock disables every control inside it, and an unlocked one does not', () => {
    const { rerender } = render(<EditLock locked><button type="button">Save</button></EditLock>);
    expect(screen.getByRole('button', { name: 'Save' }).matches(':disabled')).toBe(true);
    rerender(<EditLock locked={false}><button type="button">Save</button></EditLock>);
    expect(screen.getByRole('button', { name: 'Save' }).matches(':disabled')).toBe(false);
  });
});
