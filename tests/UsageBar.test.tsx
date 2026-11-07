import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { UsageBar } from '@/components/admin/UsageBar';

const MB = 1024 * 1024;
afterEach(cleanup);

describe('UsageBar (N10)', () => {
  it('shows whole megabytes and the level', () => {
    render(<UsageBar used={12.4 * MB} quota={50 * MB} />);
    expect(screen.getByText('12 / 50 MB')).toBeTruthy();
    const bar = screen.getByRole('progressbar', { name: 'Storage used' });
    expect(bar.getAttribute('aria-valuenow')).toBe('25');
    expect(bar.getAttribute('data-level')).toBe('ok');
  });

  it('is orange from 70% and red above 85%', () => {
    const { unmount } = render(<UsageBar used={36 * MB} quota={50 * MB} />);
    expect(screen.getByRole('progressbar').getAttribute('data-level')).toBe('warn');
    expect(screen.getByRole('progressbar').querySelector('div')?.style.background).toBe('rgb(194, 122, 26)');
    unmount();
    render(<UsageBar used={45 * MB} quota={50 * MB} />);
    expect(screen.getByRole('progressbar').getAttribute('data-level')).toBe('high');
    expect(screen.getByRole('progressbar').querySelector('div')?.style.background).toBe('rgb(168, 72, 79)');
  });

  it('a full bar stops at 100%', () => {
    render(<UsageBar used={80 * MB} quota={50 * MB} />);
    expect(screen.getByRole('progressbar').querySelector('div')?.style.width).toBe('100%');
  });
});
