import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImportDialog } from '@/components/admin/ImportDialog';

afterEach(cleanup);

function choose(container: HTMLElement, text: string) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([text], 'q.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(text) });
  fireEvent.change(input, { target: { files: [file] } });
}

describe('ImportDialog', () => {
  it('offers the template download and the picture guide', () => {
    render(<ImportDialog onCancel={() => undefined} onImport={() => undefined} />);
    const link = screen.getByRole('link', { name: /quiz-template\.json/ });
    expect(link.getAttribute('href')).toBe('/quiz-template.json');
    expect(link.hasAttribute('download')).toBe(true);
    expect(screen.getByText(/600 × 300 px/)).toBeTruthy();
    expect(screen.getByText(/84 × 84 px/)).toBeTruthy();
    expect(screen.getByText(/upload the picture later/)).toBeTruthy();
    expect(screen.getByText(/2 MB/)).toBeTruthy();
  });

  it('imports a valid file only after it is checked', async () => {
    const onImport = vi.fn();
    const { container } = render(<ImportDialog onCancel={() => undefined} onImport={onImport} />);
    const btn = screen.getByRole('button', { name: 'Import' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    choose(container, readFileSync('public/quiz-template.json', 'utf8'));
    await waitFor(() => expect(screen.getByText('2 questions ready to import.')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Import 2 questions' }));
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onImport.mock.calls[0][0]).toHaveLength(2);
  });

  it('shows every problem and imports nothing for a bad file', async () => {
    const onImport = vi.fn();
    const { container } = render(<ImportDialog onCancel={() => undefined} onImport={onImport} />);
    choose(container, JSON.stringify({ questions: [{ text: 'x', answers: [{ correct: true }] }] }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Question 1: needs 2 or 3 answers/));
    expect((screen.getByRole('button', { name: 'Import' }) as HTMLButtonElement).disabled).toBe(true);
    expect(onImport).not.toHaveBeenCalled();
  });

  it('closes on Escape and Cancel', () => {
    const onCancel = vi.fn();
    render(<ImportDialog onCancel={onCancel} onImport={() => undefined} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
