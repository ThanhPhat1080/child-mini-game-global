import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { BanDialog } from '@/components/admin/BanDialog';
import { ImportDialog } from '@/components/admin/ImportDialog';
import { CardImportDialog } from '@/components/admin/CardImportDialog';
import AdultCheck from '@/components/auth/AdultCheck';

afterEach(cleanup);
const close = () => screen.getByRole('button', { name: 'Close' }) as HTMLButtonElement;

describe('dialogs have a top-right Close (FA5)', () => {
  it.each([
    ['ConfirmDialog', (c: () => void) => <ConfirmDialog title="t" body="b" button="Delete" onCancel={c} onConfirm={vi.fn()} />],
    ['BanDialog', (c: () => void) => <BanDialog name="n" onCancel={c} onConfirm={vi.fn()} />],
    ['ImportDialog', (c: () => void) => <ImportDialog onCancel={c} onImport={vi.fn()} />],
    ['CardImportDialog', (c: () => void) => <CardImportDialog onCancel={c} onImport={vi.fn()} />],
    ['AdultCheck', (c: () => void) => <AdultCheck open onPass={vi.fn()} onCancel={c} />],
  ])('%s: Close does what Cancel does', (_name, make) => {
    const onCancel = vi.fn();
    render(make(onCancel));
    fireEvent.click(close());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Close is disabled while a dialog is busy', () => {
    render(<ConfirmDialog title="t" body="b" button="Delete" busy onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(close().disabled).toBe(true);
  });
});
