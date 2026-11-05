import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ signUp: vi.fn() }));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({ auth: { signUp: h.signUp } }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

import SignUpPage from '@/app/sign-up/page';
import { POLICY_VERSION } from '@/lib/policy/slides';

beforeEach(() => {
  h.signUp.mockReset();
  h.signUp.mockResolvedValue({ data: {}, error: null });
});
afterEach(() => {
  cleanup();
  window.history.pushState({}, '', '/sign-up');
});

function fill(email = 'mum@example.com', password = 'longenough1') {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: password } });
}
const submit = () => fireEvent.click(screen.getByRole('button', { name: /create account/i }));
async function acceptPolicy() {
  submit();
  for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole('button', { name: /next/i }));
  fireEvent.click(screen.getByRole('button', { name: /register/i }));
}

describe('Sign-up page (U7, U16)', () => {
  it('Create account opens the carousel and does not call signUp', () => {
    render(<SignUpPage />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fill();
    submit();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(h.signUp).not.toHaveBeenCalled();
  });

  it('onAccept calls supabase.auth.signUp with options.data exactly { policy_version: POLICY_VERSION }', async () => {
    render(<SignUpPage />);
    fill();
    await acceptPolicy();
    await waitFor(() => expect(h.signUp).toHaveBeenCalledTimes(1));
    const arg = h.signUp.mock.calls[0][0];
    expect(arg.email).toBe('mum@example.com');
    expect(arg.password).toBe('longenough1');
    expect(arg.options.data).toEqual({ policy_version: POLICY_VERSION });
    expect(arg.options.emailRedirectTo).toBe(`${location.origin}/admin/sign-in`);
  });

  it('shows validation messages for bad email and short password and does not open the carousel', () => {
    render(<SignUpPage />);
    fill('not-an-email', 'short');
    submit();
    expect(screen.getByText(/valid email/i)).toBeTruthy();
    expect(screen.getByText(/at least 8/i)).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.signUp).not.toHaveBeenCalled();
  });

  it('shows the check-your-email state after success', async () => {
    render(<SignUpPage />);
    fill();
    await acceptPolicy();
    expect(await screen.findByText(/check your email to confirm your account/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /sign in/i }).getAttribute('href')).toBe('/admin/sign-in');
  });

  it('maps an already-registered error to a friendly message', async () => {
    h.signUp.mockResolvedValue({ data: {}, error: { message: 'User already registered', code: 'user_already_exists' } });
    render(<SignUpPage />);
    fill();
    await acceptPolicy();
    expect(await screen.findByText(/already has an account/i)).toBeTruthy();
    expect(screen.queryByText(/User already registered/)).toBeNull();
  });

  it('shows a generic message for unknown errors without leaking the raw text', async () => {
    h.signUp.mockResolvedValue({ data: {}, error: { message: 'database exploded xyz' } });
    render(<SignUpPage />);
    fill();
    await acceptPolicy();
    expect(await screen.findByText(/something went wrong/i)).toBeTruthy();
    expect(screen.queryByText(/exploded/)).toBeNull();
  });

  it('shows the generic message for a "Password sign-ups are disabled" error', async () => {
    h.signUp.mockResolvedValue({ data: {}, error: { message: 'Password sign-ups are disabled', code: 'signup_disabled' } });
    render(<SignUpPage />);
    fill();
    await acceptPolicy();
    expect(await screen.findByText(/something went wrong/i)).toBeTruthy();
    expect(screen.queryByText(/too weak/i)).toBeNull();
  });

  it.each([
    ['email_address_invalid', 'Email address "a@b.co" is invalid', /not valid/i],
    ['email_exists', 'Email already exists', /already has an account/i],
    ['email_address_not_authorized', 'Email address not authorized', /cannot send mail/i],
  ])('shows the %s error under the email field', async (code, message, expected) => {
    h.signUp.mockResolvedValue({ data: {}, error: { message, code } });
    const { container } = render(<SignUpPage />);
    fill();
    await acceptPolicy();
    const alert = await screen.findByText(expected);
    expect(alert.closest('div')?.querySelector('#su-email')).toBeTruthy();
    expect(container.textContent).not.toContain(message);
  });

  it('shows the generic message and re-enables the button when signUp throws', async () => {
    h.signUp.mockRejectedValue(new Error('network down'));
    render(<SignUpPage />);
    fill();
    await acceptPolicy();
    expect(await screen.findByText(/something went wrong/i)).toBeTruthy();
    const btn = screen.getByRole('button', { name: /create account/i });
    expect(btn.hasAttribute('disabled')).toBe(false);
  });

  it('maps weak_password to the weak-password message', async () => {
    h.signUp.mockResolvedValue({ data: {}, error: { message: 'x', code: 'weak_password' } });
    render(<SignUpPage />);
    fill();
    await acceptPolicy();
    expect(await screen.findByText(/too weak/i)).toBeTruthy();
  });
});

describe('sign-up from the play area (FS6)', () => {
  it('from=play sends every sign-in path to the play area', async () => {
    window.history.pushState({}, '', '/sign-up?from=play');
    render(<SignUpPage />);
    expect(await screen.findByText('childPlayer')).toBeTruthy();
    expect(screen.getByRole('link', { name: /sign in/i }).getAttribute('href')).toBe('/play/sign-in');
    fill();
    await acceptPolicy();
    expect((await screen.findAllByRole('link', { name: /sign in/i }))[0].getAttribute('href')).toBe('/play/sign-in');
    expect(h.signUp.mock.calls[0][0].options.emailRedirectTo).toBe(`${location.origin}/play/sign-in`);
  });
});
