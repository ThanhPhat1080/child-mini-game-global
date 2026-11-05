import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/settings', () => ({ getMyChildSettings: h.get }));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null) => (p ? `/media/${p}` : null) }));

import { useActiveChild } from '@/lib/useActiveChild';

afterEach(cleanup);

describe('useActiveChild (FP1)', () => {
  it('starts loading, then gives the child', async () => {
    h.get.mockResolvedValue({ child_name: 'Bi', avatar_path: 'a.png', gender: 'male' });
    const { result } = renderHook(() => useActiveChild());
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ name: 'Bi', avatarUrl: '/media/a.png', gender: 'male' });
  });
  it('fails when the load rejects', async () => {
    h.get.mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useActiveChild());
    await waitFor(() => expect(result.current.status).toBe('failed'));
  });
  it('fails when there is no active child', async () => {
    h.get.mockResolvedValue(null);
    const { result } = renderHook(() => useActiveChild());
    await waitFor(() => expect(result.current.status).toBe('failed'));
  });
});
