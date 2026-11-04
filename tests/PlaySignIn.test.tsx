import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ signIn: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({ auth: { signInWithPassword: h.signIn } }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push, refresh: h.refresh }) }));

import PlaySignIn from '@/app/play/sign-in/page';

beforeEach(() => {
  h.signIn.mockReset().mockResolvedValue({ data: {}, error: null });
  h.push.mockReset();
  h.refresh.mockReset();
});
afterEach(cleanup);

function submit() {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'mum@example.com' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'longenough1' } });
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
}

describe('Child sign-in page (U9)', () => {
  it('signs in and goes to /games', async () => {
    render(<PlaySignIn />);
    submit();
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/games'));
    expect(h.signIn).toHaveBeenCalledWith({ email: 'mum@example.com', password: 'longenough1' });
    expect(h.refresh).toHaveBeenCalled();
  });

  it('shows a friendly message on wrong credentials', async () => {
    h.signIn.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials', code: 'invalid_credentials' } });
    render(<PlaySignIn />);
    submit();
    expect((await screen.findByRole('alert')).textContent).toMatch(/email or password/i);
    expect(h.push).not.toHaveBeenCalled();
  });

  it('does not leak raw error text', async () => {
    h.signIn.mockResolvedValue({ data: {}, error: { message: 'GoTrue xyz-secret failure', code: 'unexpected_failure' } });
    render(<PlaySignIn />);
    submit();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toMatch(/xyz-secret|GoTrue/);
    expect(document.body.textContent).not.toMatch(/xyz-secret/);
  });
});
