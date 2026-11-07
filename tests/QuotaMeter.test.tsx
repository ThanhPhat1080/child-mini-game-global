import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { QuotaMeter } from '@/components/admin/QuotaMeter';

afterEach(cleanup);
const MB = 1024 * 1024;

describe('QuotaMeter (N4, Q4)', () => {
  it('formats used / quota in MB', () => {
    render(<QuotaMeter used={12 * MB} quota={50 * MB} />);
    expect(screen.getByText('Storage: 12 / 50 MB')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('24');
    expect(screen.getByRole('progressbar').getAttribute('data-warn')).toBe('false');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('rounds to one decimal', () => {
    render(<QuotaMeter used={1.26 * MB} quota={50 * MB} />);
    expect(screen.getByText('Storage: 1.3 / 50 MB')).toBeTruthy();
  });

  it('warns at 90% and above, not below', () => {
    const { rerender } = render(<QuotaMeter used={44.9 * MB} quota={50 * MB} />);
    expect(screen.getByRole('progressbar').getAttribute('data-warn')).toBe('false');
    rerender(<QuotaMeter used={45 * MB} quota={50 * MB} />);
    expect(screen.getByRole('progressbar').getAttribute('data-warn')).toBe('true');
    expect(screen.getByRole('status').textContent).toMatch(/Almost full/);
  });

  it('shows the total of all families and no bar for a Super Admin', () => {
    render(<QuotaMeter used={12 * MB} quota={null} />);
    expect(screen.getByText('Storage, all families: 12 MB')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('caps the bar at 100% and treats a zero quota as full', () => {
    const { rerender } = render(<QuotaMeter used={60 * MB} quota={50 * MB} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
    rerender(<QuotaMeter used={0} quota={0} />);
    expect(screen.getByRole('progressbar').getAttribute('data-warn')).toBe('true');
  });
});
