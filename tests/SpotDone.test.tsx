import { cleanup, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ applause: vi.fn(), speakKid: vi.fn(), playFile: vi.fn(), push: vi.fn(), stop: vi.fn(), cancel: vi.fn() }));
vi.mock('@/lib/sfx', () => ({ applause: h.applause, speakKid: h.speakKid, playFile: h.playFile }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

import { SpotDone } from '@/components/spot/SpotDone';

const ui = (url: string | null = null) => <SpotDone childName="Mi" completeUrl={url} onAgain={() => {}} levelsHref="/games/spot" />;

beforeEach(() => {
  for (const f of Object.values(h)) f.mockReset();
  h.applause.mockReturnValue({ stop: h.stop, ms: 4000 });
  h.playFile.mockReturnValue({ stop: h.stop, ms: 0 });
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { cancel: h.cancel } });
});
afterEach(() => {
  cleanup();
  // @ts-expect-error test cleanup of the stub
  delete window.speechSynthesis;
});

describe('SpotDone sounds (S9)', () => {
  it('plays applause and the greeting once; unmount stops the handle and cancels speech', () => {
    const r = render(ui());
    expect(h.applause).toHaveBeenCalledTimes(1);
    expect(h.speakKid).toHaveBeenCalledTimes(1);
    expect(h.stop).not.toHaveBeenCalled();
    r.unmount();
    expect(h.stop).toHaveBeenCalledTimes(1);
    expect(h.cancel).toHaveBeenCalled();
  });

  it('a custom completion sound is stopped on unmount', () => {
    const r = render(ui('/media/done.mp3'));
    expect(h.playFile).toHaveBeenCalledTimes(1);
    expect(h.applause).not.toHaveBeenCalled();
    r.unmount();
    expect(h.stop).toHaveBeenCalledTimes(1);
  });

  it('strict-mode re-run leaves one sound still playing', () => {
    const r = render(<StrictMode>{ui()}</StrictMode>);
    expect(h.applause.mock.calls.length - h.stop.mock.calls.length).toBe(1);
    r.unmount();
    expect(h.stop.mock.calls.length).toBe(h.applause.mock.calls.length);
  });
});
