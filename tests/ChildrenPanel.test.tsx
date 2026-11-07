import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// PR11: the children list is a section of Profile (level-2 heading), with the same cards and add button as before.

const h = vi.hoisted(() => ({ listMyChildren: vi.fn(), deleteChild: vi.fn() }));
vi.mock('@/lib/children', async (orig) => ({ ...(await orig<typeof import('@/lib/children')>()), listMyChildren: h.listMyChildren, deleteChild: h.deleteChild }));

import { ChildrenPanel } from '@/components/admin/ChildrenPanel';

const mia = { id: 'c1', parent_id: 'p', child_name: 'mia01', display_name: 'Mia', avatar_path: null, gender: 'female', age_band: '2-5', pin: 'ab12' };

beforeEach(() => {
  h.listMyChildren.mockReset().mockResolvedValue([mia]);
  h.deleteChild.mockReset();
});
afterEach(cleanup);

describe('ChildrenPanel (PR11)', () => {
  it('is a section headed "Your children" with one card per child and an add button', async () => {
    render(<ChildrenPanel />);
    expect(screen.getByRole('heading', { level: 2, name: 'Your children' })).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('child-card').textContent).toContain('Mia'));
    expect(screen.getByRole('button', { name: /Add child/ })).toBeTruthy();
  });

  it('says so when there are no children yet', async () => {
    h.listMyChildren.mockResolvedValue([]);
    render(<ChildrenPanel />);
    expect(await screen.findByText('No children yet. Add the first one.')).toBeTruthy();
  });
});
