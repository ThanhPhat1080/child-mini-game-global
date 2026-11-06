// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AvatarSay, avatarSay } from '@/components/AvatarSay';

afterEach(cleanup);

describe('AvatarSay', () => {
  it('says hi with the display name', () => {
    expect(avatarSay('Mia')).toBe("Hi I'm Mia. Let's play together!");
    expect(avatarSay('  ')).toBe("Let's play together!");
  });

  it('shows the bubble on tap, blue for a boy and pink for a girl', () => {
    render(<AvatarSay avatar={null} initials="LO" name="Leo" gender="male" />);
    fireEvent.click(screen.getByRole('button', { name: 'Hear from the avatar' }));
    const bubble = screen.getByRole('status');
    expect(bubble.textContent).toContain("Hi I'm Leo. Let's play together!");
    expect(bubble.getAttribute('style')).toContain('#8FB3D1');
    cleanup();
    render(<AvatarSay avatar={null} initials="MI" name="Mia" gender="female" />);
    fireEvent.click(screen.getByRole('button', { name: 'Hear from the avatar' }));
    expect(screen.getByRole('status').getAttribute('style')).toContain('#EBC4C8');
  });
});
