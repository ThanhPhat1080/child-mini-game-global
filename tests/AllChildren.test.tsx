import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ listAllChildren: vi.fn(), removeChild: vi.fn() }));
vi.mock('@/lib/superAdmin', () => h);

import AllChildrenPage from '@/app/admin/(super)/all-children/page';

const kid = (over: Record<string, unknown> = {}) => ({ id: 'c1', display_name: 'Mia', child_name: 'mia', parent_id: 'p1', parent_name: 'Lan', ...over });

beforeEach(() => {
  h.listAllChildren.mockReset().mockResolvedValue([kid(), kid({ id: 'c2', display_name: 'Bao', parent_name: null })]);
  h.removeChild.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('All children (N5, K13)', () => {
  it('lists children with their parent name and has no create form', async () => {
    render(<AllChildrenPage />);
    expect(await screen.findByText('Mia')).toBeTruthy();
    expect(screen.getByText('Parent: Lan')).toBeTruthy();
    expect(screen.getByText('Parent: Unknown parent')).toBeTruthy();
    expect(screen.queryByRole('form', { name: /create account/i })).toBeNull();
    expect(screen.queryByLabelText('Password (at least 8 characters)')).toBeNull();
  });

  it('asks before removing, and cancel removes nothing', async () => {
    render(<AllChildrenPage />);
    await screen.findByText('Mia');
    fireEvent.click(screen.getAllByRole('button', { name: /remove/i })[0]);
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(h.removeChild).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(h.removeChild).not.toHaveBeenCalled();
  });

  it('removes after confirming, then reloads the list', async () => {
    render(<AllChildrenPage />);
    await screen.findByText('Mia');
    fireEvent.click(screen.getAllByRole('button', { name: /remove/i })[0]);
    h.listAllChildren.mockResolvedValue([kid({ id: 'c2', display_name: 'Bao', parent_name: null })]);
    fireEvent.click(within_dialog());
    await waitFor(() => expect(h.removeChild).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect(screen.queryByText('Mia')).toBeNull());
    expect(h.listAllChildren).toHaveBeenCalledTimes(2);
  });

  it('shows an error toast when removing fails and keeps the child', async () => {
    h.removeChild.mockRejectedValue(new Error('Could not remove the child.'));
    render(<AllChildrenPage />);
    await screen.findByText('Mia');
    fireEvent.click(screen.getAllByRole('button', { name: /remove/i })[0]);
    fireEvent.click(within_dialog());
    expect(await screen.findByText('Could not remove the child.')).toBeTruthy();
    expect(screen.getByText('Mia')).toBeTruthy();
  });
});

function within_dialog() {
  const dlg = screen.getByRole('alertdialog');
  return Array.from(dlg.querySelectorAll('button')).find((b) => b.textContent === 'Remove')!;
}
