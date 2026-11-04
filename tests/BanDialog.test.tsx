import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BanDialog } from '@/components/admin/BanDialog';
import { BAN_REASONS } from '@/lib/policy/reasons';

afterEach(cleanup);

describe('BanDialog (N9, U15)', () => {
  it('offers exactly the eight policy reasons and keeps Ban off until one is chosen', () => {
    const onConfirm = vi.fn();
    render(<BanDialog name="Lan" onCancel={vi.fn()} onConfirm={onConfirm} />);
    const options = Array.from(screen.getByLabelText('Reason').querySelectorAll('option')).filter((o) => o.value);
    expect(options.map((o) => o.value)).toEqual(BAN_REASONS.map((r) => r.code));
    expect(options).toHaveLength(8);
    const ban = screen.getByRole('button', { name: 'Ban' }) as HTMLButtonElement;
    expect(ban.disabled).toBe(true);
    fireEvent.click(ban);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms with the chosen code and the trimmed note', () => {
    const onConfirm = vi.fn();
    render(<BanDialog name="Lan" onCancel={vi.fn()} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'hate' } });
    fireEvent.change(screen.getByLabelText(/Note for the parent/), { target: { value: '  bullying text  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ban' }));
    expect(onConfirm).toHaveBeenCalledWith('hate', 'bullying text');
  });

  it('the note is optional and Cancel closes without confirming', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<BanDialog name="Lan" onCancel={onCancel} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'other' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ban' }));
    expect(onConfirm).toHaveBeenCalledWith('other', '');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
