import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ELevel } from '@/lib/spot/adminLevels';
import type { Crop } from '@/lib/crop/geometry';

const h = vi.hoisted(() => ({ libraryProps: [] as Array<{ label: string; startCrop?: Crop; onCropped?: (c: Crop) => void }> }));

vi.mock('@/components/admin/LibraryButton', () => ({
  LibraryButton: (props: { label: string; startCrop?: Crop; onCropped?: (c: Crop) => void }) => {
    h.libraryProps.push(props);
    return <button type="button" aria-label={`library ${props.label}`}>library</button>;
  },
}));

vi.mock('@/lib/media', async (orig) => ({ ...(await orig<typeof import('@/lib/media')>()), mediaUrl: () => null }));

import { SpotLevelPanel } from '@/components/admin/SpotLevelPanel';

afterEach(() => {
  cleanup();
  h.libraryProps.length = 0;
});

const level = { id: 'L1', a: 'spot/a.png', b: 'spot/b.png', differences: [], active: true, isNew: false } as unknown as ELevel;
const crop: Crop = { x: 0.1, y: 0.1, w: 0.5, h: 0.75, ratio: 1.5 };

function renderPanel(onCropped = vi.fn(), startCrop?: Crop) {
  render(
    <SpotLevelPanel
      l={level} n={1} message={null} shapeWarning={false}
      startCrop={startCrop} onCropped={onCropped}
      onEdit={() => undefined} onChooseLibrary={() => undefined} onSvg={() => undefined}
      onAskDelete={() => undefined}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Expand level 1' })); // a saved level starts collapsed
  return onCropped;
}

describe('SpotLevelPanel crop hand-off between picture A and B (A25)', () => {
  it('picture B starts from the crop given to the panel', () => {
    renderPanel(vi.fn(), crop);
    const b = h.libraryProps.find((p) => p.label === 'level 1 picture B');
    expect(b?.startCrop).toBe(crop);
  });

  it('picture A starts from nothing, and reports its crop as side a', () => {
    const onCropped = renderPanel();
    const a = h.libraryProps.find((p) => p.label === 'level 1 picture A');
    expect(a?.startCrop).toBeUndefined();
    a?.onCropped?.(crop);
    expect(onCropped).toHaveBeenCalledWith('a', crop);
  });

  it('picture B reports its crop as side b', () => {
    const onCropped = renderPanel(vi.fn(), crop);
    h.libraryProps.find((p) => p.label === 'level 1 picture B')?.onCropped?.(crop);
    expect(onCropped).toHaveBeenCalledWith('b', crop);
  });

  it('the picture A and B buttons exist', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: 'library level 1 picture A' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'library level 1 picture B' })).toBeTruthy();
  });
});
