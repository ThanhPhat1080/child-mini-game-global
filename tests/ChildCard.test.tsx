import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null | undefined) => (p ? `/media/${p}` : null) }));

import { ChildCard } from '@/components/admin/ChildCard';
import { GENDER_THEME } from '@/lib/childTheme';
import type { Child } from '@/lib/children';

const base: Child = { id: 'c1', parent_id: 'p', child_name: 'mia01', display_name: 'Mia', avatar_path: null, gender: 'female', age_band: '2-5', pin: 'ab12' };
afterEach(cleanup);

describe('ChildCard size and footer (N15)', () => {
  it('size lg makes the card larger and keeps the same content', () => {
    render(<ChildCard child={base} size="lg" onEdit={() => {}} onRemove={() => {}} />);
    const card = screen.getByTestId('child-card');
    expect(card.getAttribute('data-size')).toBe('lg');
    expect(screen.getByText('Mia')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit Mia' })).toBeTruthy();
  });
  it('the default size is not lg', () => {
    render(<ChildCard child={base} onEdit={() => {}} onRemove={() => {}} />);
    expect(screen.getByTestId('child-card').getAttribute('data-size')).toBe('md');
  });
  it('without edit or remove handlers the card is read-only (N11)', () => {
    render(<ChildCard child={base} />);
    expect(screen.getByText('Mia')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit Mia' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove Mia' })).toBeNull();
  });
  it('renders a footer inside the card, below the name', () => {
    render(<ChildCard child={base} onEdit={() => {}} onRemove={() => {}} footer={<a href="/admin/parents/p">Lan</a>} />);
    const link = screen.getByRole('link', { name: 'Lan' });
    expect(screen.getByTestId('child-card').contains(link)).toBe(true);
  });
});

describe('ChildCard (KU1, KU2)', () => {
  it('shows a boy with male colors', () => {
    render(<ChildCard child={{ ...base, gender: 'male', display_name: 'Bao', child_name: 'bao' }} onEdit={() => {}} onRemove={() => {}} />);
    expect(screen.getByText('Bao')).toBeTruthy();
    expect(screen.getByText('@bao')).toBeTruthy();
    expect(screen.getByText('2-5')).toBeTruthy();
    expect(screen.getByText('♂')).toBeTruthy();
    const card = screen.getByTestId('child-card');
    expect(card.style.background).not.toBe('');
    expect(card.getAttribute('style')).toContain('rgb(255 252 242)'); // same pale yellow for both
    expect(card.getAttribute('style')).toContain('rgb(143, 179, 209)'); // blue border
  });
  it('shows a girl with female colors', () => {
    render(<ChildCard child={base} onEdit={() => {}} onRemove={() => {}} />);
    expect(screen.getByText('♀')).toBeTruthy();
    expect(screen.getByTestId('child-card').getAttribute('style')).toContain('rgb(229, 154, 161)'); // pink border
    expect(GENDER_THEME.female.bg).toBe(GENDER_THEME.male.bg);
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
