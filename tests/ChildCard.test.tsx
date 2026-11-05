import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null | undefined) => (p ? `/media/${p}` : null) }));

import { ChildCard } from '@/components/admin/ChildCard';
import { GENDER_THEME } from '@/lib/childTheme';
import type { Child } from '@/lib/children';

const base: Child = { id: 'c1', parent_id: 'p', child_name: 'mia01', display_name: 'Mia', avatar_path: null, gender: 'female', age_band: '2-5', pin: 'ab12' };
afterEach(cleanup);

describe('ChildCard (KU1, KU2)', () => {
  it('shows a boy with male colors', () => {
    render(<ChildCard child={{ ...base, gender: 'male', display_name: 'Bao', child_name: 'bao' }} onEdit={() => {}} onRemove={() => {}} />);
    expect(screen.getByText('Bao')).toBeTruthy();
    expect(screen.getByText('@bao')).toBeTruthy();
    expect(screen.getByText('2-5')).toBeTruthy();
    expect(screen.getByText('♂')).toBeTruthy();
    const card = screen.getByTestId('child-card');
    expect(card.style.background).not.toBe('');
    expect(card.getAttribute('style')).toContain('rgb(220, 232, 241)');
  });
  it('shows a girl with female colors', () => {
    render(<ChildCard child={base} onEdit={() => {}} onRemove={() => {}} />);
    expect(screen.getByText('♀')).toBeTruthy();
    expect(screen.getByTestId('child-card').getAttribute('style')).toContain('rgb(248, 220, 223)');
    expect(GENDER_THEME.female.bg).toBe('#F8DCDF');
  });
  it('edit and remove buttons have names and tooltips, and call back', () => {
    const onEdit = vi.fn(); const onRemove = vi.fn();
    render(<ChildCard child={base} onEdit={onEdit} onRemove={onRemove} />);
    screen.getByRole('button', { name: 'Edit Mia' }).click();
    screen.getByRole('button', { name: 'Remove Mia' }).click();
    expect(onEdit).toHaveBeenCalled(); expect(onRemove).toHaveBeenCalled();
    expect(screen.getByText('Edit', { selector: '[role=tooltip]' })).toBeTruthy();
    expect(screen.getByText('Remove', { selector: '[role=tooltip]' })).toBeTruthy();
  });
});
