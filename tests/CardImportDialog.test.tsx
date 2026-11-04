import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardImportDialog } from '@/components/admin/CardImportDialog';
import type { EGroup } from '@/lib/memory/adminCards';

afterEach(cleanup);

function choose(container: HTMLElement, text: string, size?: number) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([text], 'c.json', { type: 'application/json' });
  const read = vi.fn(() => Promise.resolve(text));
  Object.defineProperty(file, 'text', { value: read });
  if (size !== undefined) Object.defineProperty(file, 'size', { value: size });
  fireEvent.change(input, { target: { files: [file] } });
  return read;
}

describe('CardImportDialog', () => {
  it('offers the template download and the guide', () => {
    render(<CardImportDialog onCancel={() => undefined} onImport={() => undefined} />);
    const link = screen.getByRole('link', { name: /memory-cards-template\.json/ });
    expect(link.getAttribute('href')).toBe('/memory-cards-template.json');
    expect(link.hasAttribute('download')).toBe(true);
    expect(screen.getByText(/English word read aloud/)).toBeTruthy();
    expect(screen.getByText(/max 40 characters/)).toBeTruthy();
    expect(screen.getByText(/SVG is best/)).toBeTruthy();
    expect(screen.getByText(/up to 2 MB/)).toBeTruthy();
    expect(screen.getByText(/recorded pronunciation/)).toBeTruthy();
    expect(screen.getByText(/are unsaved until you press/)).toBeTruthy();
    expect(screen.getByText(/without a picture must be finished by hand/)).toBeTruthy();
    expect(screen.getByText(/name of a group that already exists under Groups/)).toBeTruthy();
  });

  it('resolves group names against the groups it is given (including unsaved ones)', async () => {
    const onImport = vi.fn();
    const groups: EGroup[] = [{ id: 'draft-1', isNew: true, name: 'Birds' }];
    const { container } = render(<CardImportDialog groups={groups} onCancel={() => undefined} onImport={onImport} />);
    choose(container, JSON.stringify({ cards: [{ word: 'owl', group: ' birds ' }] }));
    await waitFor(() => expect(screen.getByText('1 card ready to import.')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 card' }));
    expect(onImport.mock.calls[0][0][0].groupId).toBe('draft-1');
  });

  it('an unknown group name is shown and imports nothing', async () => {
    const { container } = render(<CardImportDialog groups={[]} onCancel={() => undefined} onImport={() => undefined} />);
    choose(container, JSON.stringify({ cards: [{ word: 'owl', group: 'Birds' }] }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Card 1: group "Birds" does not exist/));
  });

  it('imports a valid file only after it is checked', async () => {
    const onImport = vi.fn();
    const { container } = render(<CardImportDialog onCancel={() => undefined} onImport={onImport} />);
    expect((screen.getByRole('button', { name: 'Import' }) as HTMLButtonElement).disabled).toBe(true);
    choose(container, readFileSync('public/memory-cards-template.json', 'utf8'));
    await waitFor(() => expect(screen.getByText('3 cards ready to import.')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Import 3 cards' }));
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onImport.mock.calls[0][0]).toHaveLength(3);
  });

  it('shows problems with the card number and imports nothing', async () => {
    const onImport = vi.fn();
    const { container } = render(<CardImportDialog onCancel={() => undefined} onImport={onImport} />);
    choose(container, JSON.stringify({ cards: [{ word: 'ok' }, { word: '' }] }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Card 2: word is required/));
    expect((screen.getByRole('button', { name: 'Import' }) as HTMLButtonElement).disabled).toBe(true);
    expect(onImport).not.toHaveBeenCalled();
  });

  it('shows at most 8 problems and counts the rest', async () => {
    const { container } = render(<CardImportDialog onCancel={() => undefined} onImport={() => undefined} />);
    choose(container, JSON.stringify({ cards: Array.from({ length: 11 }, () => ({ word: '' })) }));
    await waitFor(() => expect(screen.getByText('…and 3 more.')).toBeTruthy());
  });

  it('refuses a file over 1 MB before reading it', async () => {
    const { container } = render(<CardImportDialog onCancel={() => undefined} onImport={() => undefined} />);
    const read = choose(container, '{}', 1024 * 1024 + 1);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/larger than 1 MB/));
    expect(read).not.toHaveBeenCalled();
  });

  it('closes on Escape and Cancel', () => {
    const onCancel = vi.fn();
    render(<CardImportDialog onCancel={onCancel} onImport={() => undefined} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
