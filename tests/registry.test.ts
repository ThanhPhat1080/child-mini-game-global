import { describe, expect, it } from 'vitest';
import { GAMES } from '@/lib/games/registry';

describe('game registry', () => {
  it('has unique ids', () => {
    expect(new Set(GAMES.map((g) => g.id)).size).toBe(GAMES.length);
  });
  it('lists quiz, memory, listen, sort, spot, find in that order', () => {
    expect(GAMES.map((g) => g.id)).toEqual(['quiz', 'memory', 'listen', 'sort', 'spot', 'find']);
  });
  it('marks every game ready', () => {
    const ready = Object.fromEntries(GAMES.map((g) => [g.id, g.ready]));
    expect(ready).toEqual({ quiz: true, memory: true, listen: true, sort: true, spot: true, find: true });
  });
  it('points to the game routes', () => {
    const href = Object.fromEntries(GAMES.map((g) => [g.id, g.href]));
    expect(href.quiz).toBe('/games/quiz');
    expect(href.memory).toBe('/games/memory');
    expect(href.listen).toBe('/games/listen');
    expect(href.sort).toBe('/games/sort');
    expect(href.spot).toBe('/games/spot');
    expect(href.find).toBe('/games/find');
  });
  it('has no hasHelp flag any more (help opens inside the games)', () => {
    expect(GAMES.some((g) => 'hasHelp' in g)).toBe(false);
  });
});
