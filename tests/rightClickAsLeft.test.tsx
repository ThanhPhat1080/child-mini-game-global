import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import RightClickAsLeft from '@/components/RightClickAsLeft';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function setPath(path: string) {
  window.history.replaceState(null, '', path);
}

describe('RightClickAsLeft', () => {
  it('cancels the context menu and counts the right-click as a click on the target', () => {
    setPath('/games/quiz');
    const onClick = vi.fn();
    const { getByRole } = render(
      <>
        <RightClickAsLeft />
        <button onClick={onClick}>pick</button>
      </>,
    );
    const button = getByRole('button');
    const notCancelled = button.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(notCancelled).toBe(false);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('leaves the context menu alone on the admin pages', () => {
    setPath('/admin/cards');
    const onClick = vi.fn();
    const { getByRole } = render(
      <>
        <RightClickAsLeft />
        <button onClick={onClick}>edit</button>
      </>,
    );
    const notCancelled = getByRole('button').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(notCancelled).toBe(true);
    expect(onClick).not.toHaveBeenCalled();
    setPath('/');
  });
});
