import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ rows: [] as unknown[], rpc: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'me' } } } }) },
    rpc: h.rpc,
    from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: h.rows, error: null }) }) }) }),
  }),
}));
vi.mock('@/lib/media', async (orig) => ({ ...(await orig<typeof import('@/lib/media')>()), mediaUrl: (p: string | null) => (p ? `/media/${p}` : null) }));

import { CardPanel } from '@/components/admin/CardPanel';
import { GlobalContent } from '@/components/admin/GlobalContent';
import type { ECard } from '@/lib/memory/adminCards';

beforeEach(() => {
  h.rpc.mockReset().mockResolvedValue({ error: null });
});
afterEach(cleanup);

const card = (visibility?: ECard['visibility'], isNew = false): ECard => ({ id: 'c1', isNew, word: 'cat', image: 'x.png', audio: null, active: true, groupId: null, visibility });
const noop = () => undefined;
const panel = (c: ECard) => (
  <CardPanel c={c} n={1} duplicate={false} message={null} autoFocus={false} groups={[]} weakGroup={false}
    onEdit={noop} onChooseLibrary={noop} onSvg={noop} onPlay={noop} onAskDelete={noop} />
);

describe('row panels follow the sharing state (V1-V3, N4)', () => {
  it('a private card is editable and offers Share', () => {
    render(panel(card('private')));
    expect(screen.getByLabelText('Word for card 1').matches(':disabled')).toBe(false);
    expect(screen.getByText('Private')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Share with all children' })).toBeTruthy();
  });

  it('a card under review is read-only and says so, with no Share switch', () => {
    render(panel(card('pending')));
    expect(screen.getByLabelText('Word for card 1').matches(':disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Delete card 1' }).matches(':disabled')).toBe(true);
    expect(screen.getByRole('status').textContent).toMatch(/Under review/);
    expect(screen.queryByRole('switch', { name: 'Share with all children' })).toBeNull();
  });

  it('a global card is read-only and offers Request edit', () => {
    render(panel(card('global')));
    expect(screen.getByLabelText('Word for card 1').matches(':disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Request edit' }).matches(':disabled')).toBe(false);
  });

  it('a card not saved yet has no sharing row', () => {
    render(panel(card('private', true)));
    expect(screen.queryByText('Private')).toBeNull();
  });
});

describe('Global tab content (N3)', () => {
  it("lists other families' approved cards read-only, without my own", async () => {
    h.rows = [
      { id: 'a', owner_id: 'other', word: 'zebra', image_path: 'z.png' },
      { id: 'b', owner_id: 'me', word: 'mine', image_path: 'm.png' },
    ];
    render(<GlobalContent table="memory_cards" />);
    expect(await screen.findByText('zebra')).toBeTruthy();
    expect(screen.queryByText('mine')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  it('shows a friendly line when nothing is shared yet', async () => {
    h.rows = [];
    render(<GlobalContent table="spot_levels" />);
    await waitFor(() => expect(screen.getByText(/Nothing has been shared/)).toBeTruthy());
  });
});
