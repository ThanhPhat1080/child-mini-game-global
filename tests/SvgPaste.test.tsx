import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SvgPaste } from '@/components/admin/SvgPaste';

afterEach(cleanup);

describe('SvgPaste (A11, quiz sets)', () => {
  it('passes the pasted code up and clears the box', () => {
    const onUse = vi.fn();
    render(<SvgPaste label="answer 2 image" onUse={onUse} />);
    const use = screen.getByRole('button', { name: 'Use SVG for answer 2 image' }) as HTMLButtonElement;
    expect(use.disabled).toBe(true);
    const box = screen.getByRole('textbox', { name: 'SVG code for answer 2 image' }) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: '<svg></svg>' } });
    expect(use.disabled).toBe(false);
    fireEvent.click(use);
    expect(onUse).toHaveBeenCalledWith('<svg></svg>');
    expect(box.value).toBe('');
  });
});
