// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/games' }));
vi.mock('@/components/MusicButton', () => ({ MusicButton: () => <button type="button">music</button> }));
vi.mock('@/components/auth/LeaveGameButton', () => ({ default: () => <button type="button">leave</button> }));
vi.mock('@/components/auth/LogoutButton', () => ({ default: () => <button type="button">logout</button> }));

import { BACK_CORNER, ChildScreen, CornerBack, WindowCorners } from '@/components/ChildScreen';

afterEach(cleanup);

describe('ChildScreen: one place for the corner controls', () => {
  it('puts Back in the shared top-left corner and shows only the controls asked for', () => {
    render(<ChildScreen back={{ href: '/games', label: 'Back to games' }} music><p>page</p></ChildScreen>);
    const wrap = screen.getByRole('link', { name: 'Back to games' }).parentElement as HTMLElement;
    expect(wrap.style.top).toBe(`${BACK_CORNER.top}px`);
    expect(wrap.style.left).toBe(`${BACK_CORNER.left}px`);
    expect(screen.getByText('music')).toBeTruthy();
    expect(screen.queryByText('leave')).toBeNull();
    expect(screen.queryByText('logout')).toBeNull();
    expect(screen.getByText('page')).toBeTruthy();
  });

  it('shows Leave and sign-out when asked', () => {
    render(<ChildScreen leave logout />);
    expect(screen.getByText('leave')).toBeTruthy();
    expect(screen.getByText('logout')).toBeTruthy();
  });

  it('CornerBack and WindowCorners use the same corner', () => {
    render(<><CornerBack href="/x" label="One" /><WindowCorners back={{ href: '/y', label: 'Two' }} /></>);
    const a = screen.getByRole('link', { name: 'One' }).parentElement as HTMLElement;
    const b = screen.getByRole('link', { name: 'Two' }).parentElement as HTMLElement;
    expect([a.style.top, a.style.left]).toEqual([b.style.top, b.style.left]);
  });
});
