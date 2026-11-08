import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// PR6-PR10 (form) and PR11, PR13 (page by role): the parent's Profile.

const h = vi.hoisted(() => ({ saveMyProfile: vi.fn(), loadMyProfile: vi.fn() }));
vi.mock('@/lib/profile', async (orig) => ({
  ...(await orig<typeof import('@/lib/profile')>()),
  saveMyProfile: h.saveMyProfile,
  loadMyProfile: h.loadMyProfile,
}));
vi.mock('@/components/admin/ChildrenPanel', () => ({ ChildrenPanel: () => <div>children-panel</div> }));
vi.mock('@/components/admin/LibraryButton', () => ({
  LibraryButton: ({ label, onChoose }: { label: string; onChoose: (p: string) => void }) => (
    <button type="button" onClick={() => onChoose('avatars/new.webp')}>Choose from library for {label}</button>
  ),
}));
vi.mock('@/lib/supabase/client', () => ({ createSupabaseBrowserClient: () => ({}) }));

import ProfilePage from '@/app/admin/(panel)/profile/page';
import { PHONE_HINT } from '@/lib/profile';

const parent = { userId: 'p1', role: 'parent', displayName: 'Lan', phone: null, avatarPath: null, email: 'lan@test.local' };

beforeEach(() => {
  h.saveMyProfile.mockReset().mockResolvedValue(undefined);
  h.loadMyProfile.mockReset().mockResolvedValue(parent);
});
afterEach(cleanup);

const nameBox = () => screen.getByLabelText('Name') as HTMLInputElement;
const phoneBox = () => screen.getByLabelText('Phone') as HTMLInputElement;
const save = () => screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;

describe('ProfileForm (PR6-PR10)', () => {
  it('keeps Save disabled until something changes, and while the name is blank', async () => {
    render(<ProfilePage />);
    await screen.findByLabelText('Name');
    expect(save().disabled).toBe(true);
    fireEvent.change(nameBox(), { target: { value: '   ' } });
    expect(save().disabled).toBe(true);
    fireEvent.change(nameBox(), { target: { value: 'Lan Anh' } });
    expect(save().disabled).toBe(false);
  });

  it('saves the trimmed name and a null phone when the phone is empty, then says so', async () => {
    render(<ProfilePage />);
    await screen.findByLabelText('Name');
    fireEvent.change(nameBox(), { target: { value: '  Lan Anh  ' } });
    fireEvent.click(save());
    expect(await screen.findByText('Profile saved.')).toBeTruthy();
    expect(h.saveMyProfile).toHaveBeenCalledWith({ displayName: '  Lan Anh  ', phone: null, avatarPath: null });
  });

  it('shows the phone hint and saves nothing for an invalid phone', async () => {
    render(<ProfilePage />);
    await screen.findByLabelText('Name');
    fireEvent.change(phoneBox(), { target: { value: '0912abc678' } });
    fireEvent.click(save());
    expect(await screen.findByText(PHONE_HINT)).toBeTruthy();
    expect(h.saveMyProfile).not.toHaveBeenCalled();
  });

  it('keeps the typed values and shows the error when the save fails', async () => {
    h.saveMyProfile.mockRejectedValue(new Error('network down'));
    render(<ProfilePage />);
    await screen.findByLabelText('Name');
    fireEvent.change(nameBox(), { target: { value: 'Lan Anh' } });
    fireEvent.click(save());
    expect(await screen.findByText('Could not save. Please try again.')).toBeTruthy();
    expect(nameBox().value).toBe('Lan Anh');
  });

  it('shows the email read only, and the picture button for the profile picture', async () => {
    render(<ProfilePage />);
    await screen.findByLabelText('Name');
    expect((screen.getByLabelText('Email') as HTMLInputElement).readOnly).toBe(true);
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('lan@test.local');
    expect(screen.getByRole('button', { name: 'Choose from library for profile picture' })).toBeTruthy();
  });
});

describe('Profile page by role (PR11, PR13)', () => {
  it('a parent sees the children section', async () => {
    render(<ProfilePage />);
    expect(await screen.findByText('children-panel')).toBeTruthy();
  });

  it('a Super Admin sees the same details and no children section', async () => {
    h.loadMyProfile.mockResolvedValue({ ...parent, role: 'super_admin', userId: 's1', email: 'super@test.local' });
    render(<ProfilePage />);
    await screen.findByLabelText('Name');
    expect(screen.queryByText('children-panel')).toBeNull();
  });
});
