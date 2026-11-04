import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ELevel } from '@/lib/spot/adminLevels';
import type { Crop } from '@/lib/crop/geometry';

const h = vi.hoisted(() => ({
  loadLevels: vi.fn(),
  naturalSize: vi.fn(),
  /** The props the page last gave to each level panel, by level number. */
  panels: {} as Record<number, { startCrop?: Crop; onCropped: (side: 'a' | 'b', c: Crop) => void }>,
}));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({ from: () => { throw new Error('the page must not touch the database directly'); } }),
}));
vi.mock('@/lib/spot/adminLevels', async (orig) => ({
  ...(await orig<typeof import('@/lib/spot/adminLevels')>()),
  loadLevels: h.loadLevels,
  saveLevels: vi.fn(),
}));
vi.mock('@/lib/spot/imageSize', () => ({ naturalSize: h.naturalSize }));
vi.mock('@/lib/media/library', () => ({ listLibrary: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/media', async (orig) => ({
  ...(await orig<typeof import('@/lib/media')>()),
  clearPending: vi.fn(),
  mediaUrl: (p: string | null) => (p ? `/media/${p}` : null),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => '/admin/spot' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('@/components/admin/SpotLevelPanel', () => ({
  SpotLevelPanel: (p: { n: number; startCrop?: Crop; onCropped: (side: 'a' | 'b', c: Crop) => void }) => {
    h.panels[p.n] = { startCrop: p.startCrop, onCropped: p.onCropped };
    return <article aria-label={`Level ${p.n}`} />;
  },
}));

import SpotPage from '@/app/admin/(panel)/spot/page';

const three = [{ x: 0.2, y: 0.2, r: 0.06 }, { x: 0.5, y: 0.5, r: 0.06 }, { x: 0.8, y: 0.8, r: 0.06 }];
const level: ELevel = { id: 'l1', isNew: false, a: 'spot/1a.png', b: 'spot/1b.png', differences: three, active: true };
const crop: Crop = { x: 0.1, y: 0.2, w: 0.5, h: 0.75, ratio: 1.5 };

beforeEach(() => {
  for (const k of Object.keys(h.panels)) delete h.panels[Number(k)];
  h.loadLevels.mockResolvedValue([level]);
  h.naturalSize.mockResolvedValue({ w: 400, h: 300 });
});
afterEach(cleanup);

describe('Spot page hands picture A\'s crop to picture B (A25)', () => {
  it('after picture A is cropped, the panel for the level is given that crop as its start for B', async () => {
    render(<SpotPage />);
    await screen.findByRole('button', { name: 'Add level' });
    expect(h.panels[1]?.startCrop).toBeUndefined();
    act(() => h.panels[1].onCropped('a', crop));
    expect(h.panels[1]?.startCrop).toBe(crop);
  });
});
