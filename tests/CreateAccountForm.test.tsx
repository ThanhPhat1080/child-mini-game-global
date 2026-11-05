import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreateAccountForm } from '@/components/admin/CreateAccountForm';

afterEach(cleanup);

describe('CreateAccountForm (N5, U8)', () => {
  it('offers parent and Super Admin but no child option or parent picker', () => {
    render(<CreateAccountForm roles={['parent', 'super_admin']} onCreated={vi.fn()} onError={vi.fn()} />);
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Parent', 'Super Admin']);
    expect(screen.queryByLabelText('Parent')).toBeNull();
    expect(screen.queryByText(/child/i)).toBeNull();
  });
});
