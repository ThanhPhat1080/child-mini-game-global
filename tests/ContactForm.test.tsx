import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// IN4, IN5: one contact form for the suspended page and the Inbox.

const h = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({ from: () => ({ insert: h.insert }) }),
}));

import { ContactForm } from '@/components/admin/ContactForm';

beforeEach(() => {
  h.insert.mockReset().mockResolvedValue({ error: null });
});
afterEach(cleanup);

const send = () => fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

describe('ContactForm (IN4, IN5)', () => {
  it('keeps Send disabled while the message is blank', () => {
    render(<ContactForm />);
    const button = screen.getByRole('button', { name: 'Send message' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Contact the Super Admin'), { target: { value: 'Hello' } });
    expect(button.disabled).toBe(false);
  });

  it('sends the trimmed text, shows the success line, clears the box and calls onSent', async () => {
    const onSent = vi.fn();
    render(<ContactForm onSent={onSent} />);
    const box = screen.getByLabelText('Contact the Super Admin') as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: '  The sound is loud  ' } });
    send();
    expect(await screen.findByText('Message sent. The Super Admin will read it.')).toBeTruthy();
    expect(h.insert).toHaveBeenCalledWith({ body: 'The sound is loud' });
    expect(box.value).toBe('');
    expect(onSent).toHaveBeenCalledTimes(1);
  });

  it('shows the rate-limit text, and turns the form off, when the database says rate_limited', async () => {
    h.insert.mockResolvedValue({ error: { message: 'rate_limited: at most 5 messages per day' } });
    render(<ContactForm />);
    fireEvent.change(screen.getByLabelText('Contact the Super Admin'), { target: { value: 'One more' } });
    send();
    expect(await screen.findByText('You can send 5 messages a day. Please try again tomorrow.')).toBeTruthy();
    await waitFor(() => expect((screen.getByLabelText('Contact the Super Admin') as HTMLTextAreaElement).disabled).toBe(true));
  });

  it('shows the generic error for any other failure', async () => {
    h.insert.mockResolvedValue({ error: { message: 'network down' } });
    render(<ContactForm />);
    fireEvent.change(screen.getByLabelText('Contact the Super Admin'), { target: { value: 'Hello' } });
    send();
    expect(await screen.findByText('Could not send the message. Please try again.')).toBeTruthy();
  });

  it('starts turned off when the parent has already used the 5 messages of today', () => {
    render(<ContactForm initiallyLimited />);
    expect((screen.getByLabelText('Contact the Super Admin') as HTMLTextAreaElement).disabled).toBe(true);
  });
});
