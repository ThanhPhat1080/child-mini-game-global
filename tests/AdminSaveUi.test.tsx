// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RevertButton, SaveButton } from '@/components/admin/SaveButtons';
import { Toast, useToast, type ToastKind } from '@/components/admin/Toast';

function Harness({ kind, text = 'Saved' }: { kind: ToastKind; text?: string }) {
  const { toast, show, close } = useToast();
  return (<><button type="button" onClick={() => show(kind, text)}>go</button><Toast toast={toast} onClose={close} /></>);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('SaveButton / RevertButton', () => {
  it('shows Saving… and is disabled while saving, and Revert is disabled too', () => {
    render(<><RevertButton saving dirty onClick={() => {}} /><SaveButton saving enabled onClick={() => {}} /></>);
    const save = screen.getByRole('button', { name: 'Saving…' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(save.getAttribute('aria-busy')).toBe('true');
    expect((screen.getByRole('button', { name: 'Revert' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('is enabled when there is something to save and not saving', () => {
    const onSave = vi.fn(); const onRevert = vi.fn();
    render(<><RevertButton saving={false} dirty onClick={onRevert} /><SaveButton saving={false} enabled onClick={onSave} /></>);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Revert' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onRevert).toHaveBeenCalledTimes(1);
  });
  it('disables both when nothing changed', () => {
    render(<><RevertButton saving={false} dirty={false} onClick={() => {}} /><SaveButton saving={false} enabled={false} onClick={() => {}} /></>);
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Revert' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Toast', () => {
  it.each([['success', 'status', '#2F6B3C'], ['warning', 'status', '#7A5410'], ['error', 'alert', '#A8484F']] as const)('%s toast: role %s, icon, text, close button in that order, one colour', (kind, role, fg) => {
    render(<Harness kind={kind} text="Hello" />);
    fireEvent.click(screen.getByText('go'));
    const t = screen.getByRole(role);
    expect(t.textContent).toBe('Hello');
    expect(t.getAttribute('data-toast')).toBe(kind);
    const kids = Array.from(t.children);
    expect(kids[0].getAttribute('data-toast-icon')).toBe(kind);
    expect(kids[1].textContent).toBe('Hello');
    expect(kids[2].getAttribute('aria-label')).toBe('Close message');
    const st = (t as HTMLElement).style;
    expect(st.color).toBe(hex(fg));
    expect(st.borderColor).toBe(hex(fg));
  });
  it('closes with the × button', () => {
    render(<Harness kind="success" />);
    fireEvent.click(screen.getByText('go'));
    fireEvent.click(screen.getByRole('button', { name: 'Close message' }));
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('closes itself after a while, errors later than success', () => {
    render(<Harness kind="success" />);
    fireEvent.click(screen.getByText('go'));
    act(() => { vi.advanceTimersByTime(3900); });
    expect(screen.queryByRole('status')).not.toBeNull();
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.queryByRole('status')).toBeNull();
    cleanup();
    render(<Harness kind="error" />);
    fireEvent.click(screen.getByText('go'));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.queryByRole('alert')).not.toBeNull();
    act(() => { vi.advanceTimersByTime(2100); });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

function hex(h: string): string {
  const n = parseInt(h.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
}
