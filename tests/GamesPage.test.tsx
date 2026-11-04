import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { child_name: 'Ha My', avatar_path: null } }) }) }) }),
  }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }), usePathname: () => '/games' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('@/lib/media', () => ({ mediaUrl: (p: string | null) => (p ? `/media/${p}` : null) }));
vi.mock('@/components/MusicButton', () => ({ MusicButton: () => null }));

import Games from '@/app/games/page';
import { FIND_PEACH, LISTEN_PURPLE, MEMORY_GREEN, MEMORY_ICON, SORT_GOLD, SPOT_BLUE } from '@/components/games/GameArt';

const icon = (id: string) => document.querySelector(`[data-game-icon="${id}"]`) as HTMLElement;
const frame = (name: string) => screen.getByRole('link', { name }) as HTMLElement;

beforeEach(() => h.push.mockReset());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('games list decorative icons', () => {
  it('has no help buttons and no dialog; clicking an icon never opens a popup', () => {
    render(<Games />);
    expect(screen.queryAllByRole('button', { name: /What is/ })).toHaveLength(0);
    fireEvent.click(icon('quiz'));
    fireEvent.click(icon('memory'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('every game card (Quiz, Memory, Listen, Sort, Spot, Find) has a decorative 130 px icon at the same spot', () => {
    render(<Games />);
    for (const id of ['quiz', 'memory', 'listen', 'sort', 'spot', 'find']) {
      const el = icon(id);
      expect(el).toBeTruthy();
      expect(el.getAttribute('aria-hidden')).toBe('true');
      expect(el.style.pointerEvents).toBe('none');
      expect(el.tagName).not.toBe('BUTTON');
      expect(el.hasAttribute('tabindex')).toBe(false);
      expect(el.style.width).toBe('130px');
      expect(el.style.height).toBe('130px');
      expect(el.querySelector('svg')).toBeTruthy();
    }
    expect(icon('memory').style.left).toBe(icon('quiz').style.left);
    expect(icon('memory').style.top).toBe(icon('quiz').style.top);
    expect(icon('listen').style.left).toBe(icon('quiz').style.left);
    expect(icon('listen').style.top).toBe(icon('quiz').style.top);
    expect(icon('sort').style.left).toBe(icon('quiz').style.left);
    expect(icon('sort').style.top).toBe(icon('quiz').style.top);
    expect(icon('spot').style.left).toBe(icon('quiz').style.left);
    expect(icon('spot').style.top).toBe(icon('quiz').style.top);
    expect(icon('find').style.left).toBe(icon('quiz').style.left);
    expect(icon('find').style.top).toBe(icon('quiz').style.top);
    expect(document.querySelectorAll('[data-game-icon]')).toHaveLength(6);
  });

  it('the Memory icon is two flower cards, different from the Quiz question mark', () => {
    render(<Games />);
    expect(icon('memory').querySelectorAll('ellipse').length).toBeGreaterThanOrEqual(10);
    expect(icon('quiz').querySelectorAll('ellipse')).toHaveLength(0);
  });

  it('the Memory icon cards (rotated corners) fit inside the circle, and the circle is drawn', () => {
    render(<Games />);
    const circle = icon('memory').querySelector('circle') as SVGCircleElement;
    expect(circle.getAttribute('fill')).toBe('#EAF3EC');
    expect(Number(circle.getAttribute('r'))).toBe(10);
    for (const { dx, dy, rot } of MEMORY_ICON.cards) {
      const t = (rot * Math.PI) / 180;
      for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const px = (x * MEMORY_ICON.w) / 2, py = (y * MEMORY_ICON.h) / 2;
        const cx = dx + px * Math.cos(t) - py * Math.sin(t), cy = dy + px * Math.sin(t) + py * Math.cos(t);
        expect(Math.hypot(cx, cy)).toBeLessThanOrEqual(MEMORY_ICON.maxR);
      }
    }
  });

  it('the Memory icon is green and uses the same green as the Memory title; Quiz icon stays rose', () => {
    render(<Games />);
    expect(MEMORY_GREEN).toBe('#5E8F69');
    const titleColor = ((frame('Play Memory Match').lastElementChild as HTMLElement).style.color);
    const probe = document.createElement('span');
    probe.style.color = MEMORY_GREEN;
    expect(titleColor).toBe(probe.style.color);
    const svg = icon('memory');
    expect(svg.querySelector('circle')!.getAttribute('stroke')).toBe(MEMORY_GREEN);
    expect(svg.querySelector('circle')!.getAttribute('stroke-width')).toBe('2');
    const rects = svg.querySelectorAll('rect');
    expect(rects).toHaveLength(2);
    rects.forEach((r) => {
      expect(r.getAttribute('fill')).toBe('#C9DFCE');
      expect(r.getAttribute('stroke')).toBe(MEMORY_GREEN);
      expect(r.getAttribute('stroke-width')).toBe('0.7');
    });
    const petals = svg.querySelectorAll('ellipse');
    expect(petals).toHaveLength(10);
    petals.forEach((p) => expect(p.getAttribute('fill')).toBe('#fff'));
    const centers = Array.from(svg.querySelectorAll('circle')).slice(1);
    expect(centers).toHaveLength(2);
    centers.forEach((c) => expect(c.getAttribute('fill')).toBe('#EED79A'));
    const quiz = icon('quiz').querySelector('svg')!;
    expect(quiz.getAttribute('stroke')).toBe('#B8737B');
    expect(quiz.querySelector('circle')!.getAttribute('fill')).toBe('#F8DCDF');
  });

  it('the icons are not in the Tab order (only card links, arrows, dots)', () => {
    render(<Games />);
    expect(document.querySelectorAll('[data-game-icon] a, [data-game-icon] button, [data-game-icon] [tabindex]')).toHaveLength(0);
  });

  it('Memory Match has sage border and title; Quiz stays rose; Spot stays sky', () => {
    render(<Games />);
    expect(frame('Play Memory Match').style.border).toContain('rgb(169, 205, 177)');
    expect(frame('Play Quiz').style.border).toContain('rgb(235, 183, 188)');
    expect(frame('Play Memory Match').style.borderColor).not.toBe(frame('Play Quiz').style.borderColor);
    const title = (name: string) => frame(name).lastElementChild as HTMLElement;
    expect(title('Play Memory Match').textContent).toBe('Memory Match');
    expect(title('Play Memory Match').style.color).toBe('rgb(94, 143, 105)');
    expect(title('Play Quiz').style.color).toBe('rgb(184, 115, 123)');
  });

  it('Listen & Pick has a lavender border, purple title and a purple speaker icon; distinct from the others', () => {
    render(<Games />);
    expect(LISTEN_PURPLE).toBe('#7B6BAE');
    const listen = frame('Play Listen & Pick');
    expect(listen.style.border).toContain('rgb(201, 191, 228)');
    const title = listen.lastElementChild as HTMLElement;
    expect(title.textContent).toBe('Listen & Pick');
    expect(title.style.color).toBe('rgb(123, 107, 174)');
    for (const other of ['Play Quiz', 'Play Memory Match']) {
      expect(listen.style.borderColor).not.toBe(frame(other).style.borderColor);
      expect(title.style.color).not.toBe((frame(other).lastElementChild as HTMLElement).style.color);
    }
    expect(listen.style.borderColor).not.toBe(frame('Play Spot the Differences').style.borderColor);
    const circle = icon('listen').querySelector('circle')!;
    expect(circle.getAttribute('stroke')).toBe('#7B6BAE');
    expect(circle.getAttribute('fill')).toBe('#F0ECF8');
    expect(circle.getAttribute('stroke-width')).toBe('2');
  });

  it('Sort It has a butter border, gold title and a gold icon with two baskets; distinct from the others', () => {
    render(<Games />);
    expect(SORT_GOLD).toBe('#A8842F');
    const sort = frame('Play Sort It');
    expect(sort.getAttribute('href')).toBe('/games/sort');
    expect(sort.style.border).toContain('rgb(234, 217, 160)');
    const title = sort.lastElementChild as HTMLElement;
    expect(title.textContent).toBe('Sort It');
    expect(title.style.color).toBe('rgb(168, 132, 47)');
    for (const other of ['Play Quiz', 'Play Memory Match', 'Play Listen & Pick', 'Play Spot the Differences']) {
      expect(sort.style.borderColor).not.toBe(frame(other).style.borderColor);
      expect(title.style.color).not.toBe((frame(other).lastElementChild as HTMLElement).style.color);
    }
    const circle = icon('sort').querySelector('circle')!;
    expect(circle.getAttribute('stroke')).toBe('#A8842F');
    expect(circle.getAttribute('fill')).toBe('#FBF3D9');
    expect(circle.getAttribute('stroke-width')).toBe('2');
    expect(icon('sort').querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('Spot the Differences is a playable link with a decorative sky-blue icon and no coming-soon image', () => {
    render(<Games />);
    expect(SPOT_BLUE).toBe('#5F86A8');
    const link = frame('Play Spot the Differences');
    expect(link.getAttribute('href')).toBe('/games/spot');
    expect(screen.queryByRole('img', { name: /coming soon/ })).toBeNull();
    const el = icon('spot');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelectorAll('a, button, [tabindex]')).toHaveLength(0);
    const circle = el.querySelector('circle')!;
    expect(circle.getAttribute('fill')).toBe('#EEF3F7');
    expect(circle.getAttribute('stroke')).toBe(SPOT_BLUE);
    expect((link.lastElementChild as HTMLElement).style.color).toBe('rgb(95, 134, 168)');
    expect(link.style.border).toContain('rgb(169, 198, 222)');
  });

  it('Find It has a peach border and title, a peach magnifier icon with a cream circle; distinct from the others', () => {
    render(<Games />);
    expect(FIND_PEACH).toBe('#B5703A');
    const find = frame('Play Find It');
    expect(find.getAttribute('href')).toBe('/games/find');
    expect(find.style.border).toContain('rgb(242, 201, 168)');
    const title = find.lastElementChild as HTMLElement;
    expect(title.textContent).toBe('Find It');
    expect(title.style.color).toBe('rgb(181, 112, 58)');
    for (const other of ['Play Quiz', 'Play Memory Match', 'Play Listen & Pick', 'Play Sort It', 'Play Spot the Differences']) {
      expect(find.style.borderColor).not.toBe(frame(other).style.borderColor);
      expect(title.style.color).not.toBe((frame(other).lastElementChild as HTMLElement).style.color);
    }
    const svg = icon('find').querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.querySelectorAll('a, button, [tabindex]')).toHaveLength(0);
    const circle = svg.querySelector('circle')!;
    expect(circle.getAttribute('fill')).toBe('#FCEFE2');
    expect(circle.getAttribute('stroke')).toBe(FIND_PEACH);
  });

  it('Enter on the focused carousel opens a ready game', () => {
    render(<Games />);
    const view = document.querySelector('.hm-view') as HTMLElement;
    fireEvent.keyDown(view, { key: 'Enter' });
    expect(h.push).toHaveBeenCalledWith('/games/quiz');
  });
});
