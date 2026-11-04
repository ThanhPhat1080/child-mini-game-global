import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CelebrationScene } from '@/components/CelebrationScene';

afterEach(cleanup);

describe('CelebrationScene', () => {
  it('renders the greeting, 3 stars and both characters', () => {
    render(<CelebrationScene greeting="You did it, Mi!"><button>a</button></CelebrationScene>);
    expect(screen.getByRole('heading').textContent).toBe('You did it, Mi!');
    expect(screen.getByRole('img', { name: '3 stars earned' })).toBeTruthy();
    const srcs = [...document.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    expect(srcs).toEqual(['/images/girl.webp', '/images/girl-beret.webp']);
  });

  it('renders the extra node and the children', () => {
    render(<CelebrationScene greeting="Hi" extra={<p data-x>extra</p>}><button>one</button><a href="/x">two</a></CelebrationScene>);
    expect(document.querySelector('[data-x]')?.textContent).toBe('extra');
    expect(screen.getByRole('button', { name: 'one' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'two' })).toBeTruthy();
  });

  it('renders no extra node when omitted', () => {
    render(<CelebrationScene greeting="Hi"><button>one</button></CelebrationScene>);
    expect(document.querySelector('[data-x]')).toBeNull();
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });
});
