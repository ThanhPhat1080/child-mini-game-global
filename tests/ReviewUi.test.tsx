import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({ rpc: h.rpc }) }));

import { ContentTabs } from '@/components/admin/ContentTabs';
import { EditLock } from '@/components/admin/EditLock';
import { ShareToggle } from '@/components/admin/ShareToggle';
import { VisibilityBadge } from '@/components/admin/VisibilityBadge';
import { applyScope, isLocked, requestEdit, shareItem } from '@/lib/review';

beforeEach(() => {
  h.rpc.mockReset().mockResolvedValue({ error: null });
});
afterEach(cleanup);

const form = (
  <>
    <input aria-label="title" />
    <button type="button">Delete</button>
  </>
);

describe('review UI (N3, N4, V1-V4)', () => {
  it('editor inputs are disabled for pending and global items, enabled for private', () => {
    const { rerender } = render(<EditLock locked={false}>{form}</EditLock>);
    expect(screen.getByLabelText('title').matches(':disabled')).toBe(false);
    for (const v of ['pending', 'global'] as const) {
      rerender(<EditLock locked={isLocked(v, 'me', 'me')}>{form}</EditLock>);
      expect(screen.getByLabelText('title').matches(':disabled')).toBe(true);
      expect(screen.getByRole('button', { name: 'Delete' }).matches(':disabled')).toBe(true);
    }
  });

  it("isLocked also locks a private row of someone else, and ignores rows with no visibility", () => {
    expect(isLocked('private', 'me', 'me')).toBe(false);
    expect(isLocked('private', 'other', 'me')).toBe(true);
    expect(isLocked(undefined, null, 'me')).toBe(false);
  });

  it('Share toggle calls shareItem and shows the Under review notice', async () => {
    const changed = vi.fn();
    const { rerender } = render(<ShareToggle table="memory_cards" id="c1" visibility="private" onChanged={changed} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Share with all children' }));
    await waitFor(() => expect(changed).toHaveBeenCalledWith('pending'));
    expect(h.rpc).toHaveBeenCalledWith('share_item', { p_table: 'memory_cards', p_id: 'c1' });
    rerender(<ShareToggle table="memory_cards" id="c1" visibility="pending" />);
    expect(screen.getByRole('status').textContent).toMatch(/Under review/);
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('shows the error when sharing fails and does not change state', async () => {
    h.rpc.mockResolvedValue({ error: { message: 'forbidden' } });
    const changed = vi.fn();
    render(<ShareToggle table="quiz_sets" id="s1" visibility="private" onChanged={changed} />);
    fireEvent.click(screen.getByRole('switch'));
    expect((await screen.findByRole('alert')).textContent).toBe('forbidden');
    expect(changed).not.toHaveBeenCalled();
  });

  it('Request edit appears only for global items and calls requestEdit', async () => {
    const { rerender } = render(<ShareToggle table="quiz_sets" id="s1" visibility="private" />);
    expect(screen.queryByRole('button', { name: 'Request edit' })).toBeNull();
    rerender(<ShareToggle table="quiz_sets" id="s1" visibility="pending" />);
    expect(screen.queryByRole('button', { name: 'Request edit' })).toBeNull();
    rerender(<ShareToggle table="quiz_sets" id="s1" visibility="global" />);
    fireEvent.click(screen.getByRole('button', { name: 'Request edit' }));
    fireEvent.change(screen.getByLabelText(/What would you like to change/), { target: { value: 'typo in title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('request_edit', { p_table: 'quiz_sets', p_id: 's1', p_note: 'typo in title' }));
    expect((await screen.findByRole('status')).textContent).toMatch(/Edit request sent/);
  });

  it('badge shows the three states, the lock only for Global', () => {
    const { rerender } = render(<VisibilityBadge visibility="private" />);
    expect(screen.getByText('Private')).toBeTruthy();
    rerender(<VisibilityBadge visibility="pending" />);
    expect(screen.getByText('Under review')).toBeTruthy();
    expect(screen.queryByTestId('lock')).toBeNull();
    rerender(<VisibilityBadge visibility="global" />);
    expect(screen.getByText('Global')).toBeTruthy();
    expect(screen.getByTestId('lock')).toBeTruthy();
  });

  it('tabs switch between Mine and Global', () => {
    const onChange = vi.fn();
    render(<ContentTabs scope="mine" onChange={onChange} />);
    expect(screen.getByRole('tab', { name: 'Mine' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'Global' }));
    expect(onChange).toHaveBeenCalledWith('global');
  });

  it('applyScope: mine = private and pending, global = global only', () => {
    const q = { in: vi.fn(() => q), eq: vi.fn(() => q) };
    applyScope(q, 'mine');
    expect(q.in).toHaveBeenCalledWith('visibility', ['private', 'pending']);
    applyScope(q, 'global');
    expect(q.eq).toHaveBeenCalledWith('visibility', 'global');
  });

  it('shareItem and requestEdit throw the database message', async () => {
    h.rpc.mockResolvedValue({ error: { message: 'nope' } });
    await expect(shareItem('quiz_sets', 'x')).rejects.toThrow('nope');
    await expect(requestEdit('quiz_sets', 'x', 'n')).rejects.toThrow('nope');
  });
});
