import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ rpc: vi.fn(), getSession: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({ rpc: h.rpc, auth: { getSession: h.getSession } }) }));

import { ContentTabs } from '@/components/admin/ContentTabs';
import { EditLock } from '@/components/admin/EditLock';
import { ShareToggle } from '@/components/admin/ShareToggle';
import { VisibilityBadge } from '@/components/admin/VisibilityBadge';
import { familyOrGlobal, isLocked, ownerFirst, playerId, requestEdit, shareItem } from '@/lib/review';

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

  it('ownerFirst: the family\'s rows come first, then the rest, each in the given order', () => {
    const rows = [{ id: 'g1', owner_id: 'x' }, { id: 'm1', owner_id: 'me' }, { id: 'g2', owner_id: null }, { id: 'm2', owner_id: 'me' }];
    expect(ownerFirst(rows, 'me').map((r) => r.id)).toEqual(['m1', 'm2', 'g1', 'g2']);
    expect(ownerFirst(rows, null).map((r) => r.id)).toEqual(['g1', 'm1', 'g2', 'm2']);
  });

  it('familyOrGlobal keeps the family\'s rows and global rows only (FG2)', () => {
    const q = { or: vi.fn(() => 'narrowed') };
    expect(familyOrGlobal(q, 'me')).toBe('narrowed');
    expect(q.or).toHaveBeenCalledWith('owner_id.eq.me,visibility.eq.global');
    const untouched = { or: vi.fn() };
    expect(familyOrGlobal(untouched, null)).toBe(untouched);
    expect(untouched.or).not.toHaveBeenCalled();
  });

  it('playerId reads the session user and falls back to null', async () => {
    h.getSession.mockResolvedValue({ data: { session: { user: { id: 'me' } } } });
    expect(await playerId()).toBe('me');
    h.getSession.mockRejectedValue(new Error('x'));
    expect(await playerId()).toBeNull();
  });

  it('shareItem and requestEdit throw the database message', async () => {
    h.rpc.mockResolvedValue({ error: { message: 'nope' } });
    await expect(shareItem('quiz_sets', 'x')).rejects.toThrow('nope');
    await expect(requestEdit('quiz_sets', 'x', 'n')).rejects.toThrow('nope');
  });
});
