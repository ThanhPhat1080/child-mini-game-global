import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { EGroup } from '@/lib/memory/adminCards';
import { CARD_IMPORT_MAX, WORD_MAX, parseCardImport } from '@/lib/memory/import';

const c = (over: Record<string, unknown> = {}) => ({ word: 'apple', image: '', audio: '', active: true, ...over });
const run = (cards: unknown) => parseCardImport(JSON.stringify({ cards }));
const SEED: EGroup[] = ['food', 'animals', 'shapes', 'school', 'home', 'nature'].map((name) => ({ id: `id-${name}`, isNew: false, name }));
const FRUIT: EGroup[] = [{ id: 'g-fruit', isNew: false, name: 'Fruit' }];
const SVG = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'><circle cx='4' cy='4' r='3'/></svg>";

describe('parseCardImport', () => {
  it('limits', () => {
    expect(CARD_IMPORT_MAX).toBe(100);
    expect(WORD_MAX).toBe(40);
  });

  it('accepts the shipped template with no errors and no groups supplied', () => {
    const r = parseCardImport(readFileSync('public/memory-cards-template.json', 'utf8'));
    expect(r.errors).toEqual([]);
    expect(r.cards.length).toBeGreaterThanOrEqual(3);
    expect(r.cards.every((x) => x.groupId === null)).toBe(true);
  });

  it('the shipped template also imports cleanly with the seed groups', () => {
    const r = parseCardImport(readFileSync('public/memory-cards-template.json', 'utf8'), SEED);
    expect(r.errors).toEqual([]);
  });

  it('a custom file naming known groups tags every card with the right id', () => {
    const withSeed = parseCardImport(JSON.stringify({ cards: [c({ word: 'apple', group: 'food' }), c({ word: 'cat', group: ' Animals ' }), c({ word: 'ball', group: 'SHAPES' })] }), SEED);
    expect(withSeed.errors).toEqual([]);
    expect(withSeed.cards.map((x) => x.groupId)).toEqual(['id-food', 'id-animals', 'id-shapes']);
  });

  it('maps a valid card: new, active by default, blank image and audio are null', () => {
    const r = run([{ word: 'apple' }, c({ word: 'pear', active: false })]);
    expect(r.errors).toEqual([]);
    expect(r.cards).toHaveLength(2);
    expect(r.cards[0]).toMatchObject({ isNew: true, word: 'apple', image: null, audio: null, active: true });
    expect(r.cards[1].active).toBe(false);
    expect(r.cards[0].id).not.toBe(r.cards[1].id);
  });

  it('accepts a bare array and trims words', () => {
    const r = parseCardImport(JSON.stringify([c({ word: '  lion  ' })]));
    expect(r.errors).toEqual([]);
    expect(r.cards[0].word).toBe('lion');
  });

  it('ignores keys that start with _', () => {
    const r = parseCardImport(JSON.stringify({ _readme: ['x'], _other: 1, cards: [c()] }));
    expect(r.errors).toEqual([]);
    expect(r.cards).toHaveLength(1);
  });

  it('keeps https image and audio links', () => {
    const r = run([c({ image: ' https://example.com/a.svg ', audio: 'https://example.com/a.mp3' })]);
    expect(r.errors).toEqual([]);
    expect(r.cards[0].image).toBe('https://example.com/a.svg');
    expect(r.cards[0].audio).toBe('https://example.com/a.mp3');
  });

  it('accepts raw SVG code (normalized) and rejects unsafe SVG with the card number', () => {
    const ok = run([c({ image: SVG })]);
    expect(ok.errors).toEqual([]);
    expect(ok.cards[0].image?.startsWith('<svg')).toBe(true);
    const bad = run([c(), c({ image: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>' })]);
    expect(bad.errors).toHaveLength(1);
    expect(bad.errors[0]).toMatch(/^Card 2: .*scripts/);
    expect(bad.cards).toEqual([]);
  });

  it('rejects http:// images and audio, and other text', () => {
    expect(run([c({ image: 'http://x.com/a.png' })]).errors[0]).toMatch(/^Card 1: image link must start with https:\/\//);
    expect(run([c({ audio: 'http://x.com/a.mp3' })]).errors[0]).toMatch(/^Card 1: audio link must start with https:\/\//);
    expect(run([c({ audio: 'seed/a.mp3' })]).errors[0]).toMatch(/^Card 1: audio must be blank or a link starting with https:\/\//);
    expect(run([c({ audio: 5 })]).errors[0]).toMatch(/^Card 1: audio/);
    expect(run([c({ image: 'seed/apple.svg' })]).errors[0]).toMatch(/^Card 1: image/);
    expect(run([c({ audio: 'https://x.com/' + 'a'.repeat(2000) })]).errors[0]).toMatch(/^Card 1: audio link is too long/);
  });

  it('rejects a non-boolean active', () => {
    expect(run([c({ active: 'yes' })]).errors).toEqual(['Card 1: active must be true or false']);
  });

  it('word errors: missing, empty, spaces only, number, too long', () => {
    expect(run([{ image: '' }]).errors).toEqual(['Card 1: word is required (the English word read aloud).']);
    expect(run([c({ word: '' })]).errors[0]).toMatch(/^Card 1: word is required/);
    expect(run([c({ word: '   ' })]).errors[0]).toMatch(/^Card 1: word is required/);
    expect(run([c({ word: 5 })]).errors).toEqual(['Card 1: word must be text.']);
    expect(run([c({ word: 'a'.repeat(41) })]).errors).toEqual(['Card 1: word is longer than 40 characters.']);
    expect(run([c({ word: 'a'.repeat(40) })]).errors).toEqual([]);
  });

  it('lists every problem with its card number and returns no cards', () => {
    const r = run([c({ word: '' }), c(), 'oops', c({ active: 1, audio: 'nope' })]);
    expect(r.cards).toEqual([]);
    expect(r.errors.map((e) => e.slice(0, 7))).toEqual(['Card 1:', 'Card 3:', 'Card 4:', 'Card 4:']);
  });

  it('file-level errors', () => {
    expect(parseCardImport('{nope').errors[0]).toMatch(/^This is not valid JSON/);
    expect(parseCardImport('{}').errors).toEqual(['The file needs a "cards" list.']);
    expect(parseCardImport('{"cards":[]}').errors).toEqual(['The "cards" list is empty.']);
    const many = run(Array.from({ length: 101 }, () => c()));
    expect(many.errors).toEqual(['Too many cards (101). Import up to 100 at a time.']);
    expect(many.cards).toEqual([]);
    expect(run(Array.from({ length: 100 }, () => c())).errors).toEqual([]);
  });

  describe('group', () => {
    const withGroup = (g: unknown) => parseCardImport(JSON.stringify({ cards: [c({ group: g })] }), FRUIT);

    it('a known name gives the id, in any case and with spaces', () => {
      for (const g of ['Fruit', 'fruit', 'FRUIT', '  fRuIt  ']) {
        const r = withGroup(g);
        expect(r.errors).toEqual([]);
        expect(r.cards[0].groupId).toBe('g-fruit');
      }
    });

    it('missing, null, blank and spaces-only give no group', () => {
      for (const cards of [[c()], [c({ group: null })], [c({ group: '' })], [c({ group: '   ' })]]) {
        const r = parseCardImport(JSON.stringify({ cards }), FRUIT);
        expect(r.errors).toEqual([]);
        expect(r.cards[0].groupId).toBeNull();
      }
    });

    it('without a groups argument a blank group is fine', () => {
      expect(run([c({ group: '' })]).cards[0].groupId).toBeNull();
    });

    it('an unknown name names the card and the name as written (trimmed)', () => {
      const r = parseCardImport(JSON.stringify({ cards: [c(), c({ group: '  Birds ' })] }), FRUIT);
      expect(r.cards).toEqual([]);
      expect(r.errors).toEqual(['Card 2: group "Birds" does not exist. Create it under Groups first.']);
    });

    it('a name is unknown when there are no groups at all', () => {
      expect(run([c({ group: 'Fruit' })]).errors).toEqual(['Card 1: group "Fruit" does not exist. Create it under Groups first.']);
    });

    it('a non-string group is refused', () => {
      for (const g of [5, true, [], {}]) {
        expect(withGroup(g).errors).toEqual(['Card 1: group must be text.']);
      }
    });

    it('over 40 characters is refused, 40 is fine to look up', () => {
      expect(withGroup('x'.repeat(41)).errors).toEqual(['Card 1: group is longer than 40 characters.']);
      expect(withGroup(`  ${'x'.repeat(40)}  `).errors).toEqual([`Card 1: group "${'x'.repeat(40)}" does not exist. Create it under Groups first.`]);
    });

    it('one bad group blocks the whole import and all errors are listed', () => {
      const r = parseCardImport(JSON.stringify({ cards: [c({ group: 'Fruit' }), c({ group: 'Nope' }), c({ group: 7 })] }), FRUIT);
      expect(r.cards).toEqual([]);
      expect(r.errors).toHaveLength(2);
    });

    it('cards without group import exactly as before', () => {
      const r = parseCardImport(JSON.stringify({ cards: [c(), c({ word: 'pear' })] }), FRUIT);
      expect(r.errors).toEqual([]);
      expect(r.cards.map((x) => x.groupId)).toEqual([null, null]);
    });
  });
});
