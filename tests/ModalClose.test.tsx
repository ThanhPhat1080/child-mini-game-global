import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModalClose } from '@/components/ModalClose';

afterEach(cleanup);

describe('ModalClose (FA4)', () => {
  it('is a button named Close that calls onClick', () => {
    const onClick = vi.fn();
    render(<ModalClose onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it('does nothing while disabled', () => {
    const onClick = vi.fn();
    render(<ModalClose onClick={onClick} disabled />);
    const b = screen.getByRole('button', { name: 'Close' }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
    fireEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
  });
  it('defaults to the admin size and accepts the child size', () => {
    const { rerender } = render(<ModalClose onClick={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Close' }).getAttribute('data-size')).toBe('admin');
    rerender(<ModalClose onClick={() => undefined} size="child" />);
    expect(screen.getByRole('button', { name: 'Close' }).getAttribute('data-size')).toBe('child');
  });
});
