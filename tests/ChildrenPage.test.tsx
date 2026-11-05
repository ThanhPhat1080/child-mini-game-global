import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ listMyChildren: vi.fn(), deleteChild: vi.fn() }));
vi.mock('@/lib/children', async (orig) => ({ ...(await orig<typeof import('@/lib/children')>()), listMyChildren: h.listMyChildren, deleteChild: h.deleteChild }));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null | undefined) => (p ? `/media/${p}` : null), removeMedia: vi.fn() }));
vi.mock('@/lib/settings', () => ({ getChildSettings: vi.fn().mockResolvedValue(null), updateChildSettings: vi.fn() }));
vi.mock('@/components/admin/ChildModal', () => ({
  ChildModal: ({ mode, child, onClose }: { mode: string; child?: { display_name: string }; onClose: () => void }) => (
    <div role="dialog">{mode}:{child?.display_name ?? ''}<button onClick={onClose}>close</button></div>
  ),
}));

import ChildrenPage from '@/app/admin/(panel)/children/page';

const kid = (n: number) => ({ id: `c${n}`, parent_id: 'p', child_name: `kid${n}`, display_name: `Kid ${n}`, avatar_path: null, gender: n % 2 ? 'male' : 'female', age_band: '2-5', pin: 'ab12' });

beforeEach(() => {
  vi.resetAllMocks();
  h.listMyChildren.mockResolvedValue([kid(1), kid(2)]);
  h.deleteChild.mockResolvedValue({ ok: true });
});
afterEach(cleanup);

describe('Children page (KU1, KU7)', () => {
  it('lists children and keeps Add enabled below 5', async () => {
    render(<ChildrenPage />);
    expect(await screen.findByText('Kid 1')).toBeTruthy();
    expect(screen.getByText('Kid 2')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Add child' }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('disables Add at 5 with the limit note', async () => {
    h.listMyChildren.mockResolvedValue([1, 2, 3, 4, 5].map(kid));
    render(<ChildrenPage />);
    await screen.findByText('Kid 5');
    expect((screen.getByRole('button', { name: 'Add child' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/reached the limit/)).toBeTruthy();
  });
  it('opens the modal for add and edit', async () => {
    render(<ChildrenPage />);
    await screen.findByText('Kid 1');
    fireEvent.click(screen.getByRole('button', { name: 'Add child' }));
    expect(screen.getByRole('dialog').textContent).toContain('create');
    fireEvent.click(screen.getByText('close'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Kid 2' }));
    expect(screen.getByRole('dialog').textContent).toContain('edit:Kid 2');
  });
  it('remove confirms first, deletes only on confirm, then reloads without optimistic removal', async () => {
    render(<ChildrenPage />);
    await screen.findByText('Kid 1');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Kid 1' }));
    expect(h.deleteChild).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    h.listMyChildren.mockResolvedValue([kid(2)]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove child' }));
    expect(screen.getByText('Kid 1')).toBeTruthy();
    await waitFor(() => expect(h.deleteChild).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect(screen.queryByText('Kid 1')).toBeNull());
    expect(h.listMyChildren).toHaveBeenCalledTimes(2);
  });
  it('cancel in the confirm does not delete', async () => {
    render(<ChildrenPage />);
    await screen.findByText('Kid 1');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Kid 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(h.deleteChild).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
