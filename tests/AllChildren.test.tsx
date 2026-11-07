import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ listAllChildren: vi.fn(), removeChild: vi.fn() }));
vi.mock('@/lib/superAdmin', () => h);

import AllChildrenPage from '@/app/admin/(super)/all-children/page';

const kid = (over: Record<string, unknown> = {}) => ({
  id: 'c1', parent_id: 'p1', child_name: 'mia', display_name: 'Mia', avatar_path: null, gender: 'female', age_band: '2-5', pin: 'ab12',
  created_at: '2026-11-02T00:00:00Z', parent_name: 'Lan Nguyen', parent_banned: false, ...over,
});

beforeEach(() => {
  h.listAllChildren.mockReset().mockResolvedValue([
    kid(),
    kid({ id: 'c2', parent_id: 'p2', child_name: 'bao', display_name: 'Bao', gender: 'male', parent_name: 'Bao Tran', parent_banned: true, created_at: '2026-11-01T00:00:00Z' }),
    kid({ id: 'c3', parent_id: 'p3', child_name: 'an', display_name: 'An', parent_name: null, created_at: '2026-11-03T00:00:00Z' }),
  ]);
  h.removeChild.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

const names = () => screen.getAllByTestId('child-card').map((c) => within(c).getByText(/^(Mia|Bao|An)$/).textContent);

describe('Children page (N15)', () => {
  it('shows large cards in a grid, each with a link to the parent detail', async () => {
    render(<AllChildrenPage />);
    expect(await screen.findByText('Mia')).toBeTruthy();
    const card = screen.getAllByTestId('child-card').find((c) => within(c).queryByText('Mia'))!;
    expect(card.getAttribute('data-size')).toBe('lg');
    const link = within(card).getByRole('link', { name: 'Lan Nguyen' });
    expect(link.getAttribute('href')).toBe('/admin/parents/p1');
    expect(screen.getByText('Unknown parent')).toBeTruthy();
  });

  it('a banned parent has a Ban tag next to the name', async () => {
    render(<AllChildrenPage />);
    await screen.findByText('Bao');
    const card = screen.getAllByTestId('child-card').find((c) => within(c).queryByText('Bao'))!;
    expect(within(card).getByText('Ban')).toBeTruthy();
    const mia = screen.getAllByTestId('child-card').find((c) => within(c).queryByText('Mia'))!;
    expect(within(mia).queryByText('Ban')).toBeNull();
  });

  it('searches by login name, display name and parent name', async () => {
    render(<AllChildrenPage />);
    await screen.findByText('Mia');
    const search = screen.getByRole('searchbox');
    fireEvent.change(search, { target: { value: 'bao' } }); // a display name and a parent name
    expect(names()).toEqual(['Bao']);
    fireEvent.change(search, { target: { value: 'nguyen' } }); // only the parent name
    expect(names()).toEqual(['Mia']);
    fireEvent.change(search, { target: { value: 'nothing' } });
    expect(screen.getByText('No children match.')).toBeTruthy();
  });

  it('sorts newest first by default and A to Z on request', async () => {
    render(<AllChildrenPage />);
    await screen.findByText('Mia');
    expect(names()).toEqual(['An', 'Mia', 'Bao']);
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort' }), { target: { value: 'az' } });
    expect(names()).toEqual(['An', 'Bao', 'Mia']);
  });

  it('edit opens the child in Super Admin mode with no media fields', async () => {
    render(<AllChildrenPage />);
    await screen.findByText('Mia');
    fireEvent.click(screen.getByRole('button', { name: 'Edit Mia' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText('Avatar')).toBeNull();
    expect(within(dialog).queryByText('Welcome sound')).toBeNull();
    expect(within(dialog).getByLabelText('Display name')).toBeTruthy();
  });

  it('asks before removing, and cancel removes nothing', async () => {
    render(<AllChildrenPage />);
    await screen.findByText('Mia');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Mia' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(h.removeChild).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(h.removeChild).not.toHaveBeenCalled();
  });

  it('removes after confirming, then reloads the list', async () => {
    render(<AllChildrenPage />);
    await screen.findByText('Mia');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Mia' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Remove Mia' }));
    fireEvent.click(within_dialog());
    expect(await screen.findByText('Could not remove the child.')).toBeTruthy();
    expect(screen.getByText('Mia')).toBeTruthy();
  });
});

function within_dialog() {
  const dlg = screen.getByRole('alertdialog');
  return Array.from(dlg.querySelectorAll('button')).find((b) => b.textContent === 'Remove')!;
}
