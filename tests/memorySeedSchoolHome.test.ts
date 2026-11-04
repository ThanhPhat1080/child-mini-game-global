import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { checkSvg } from '@/lib/quizImport';

const root = process.cwd();
const WORDS = [
  'ruler', 'pencil', 'pen', 'eraser', 'book',
  'scissors', 'backpack', 'cup', 'chair', 'clock',
];
const sql = readFileSync(
  join(root, 'supabase/migrations/20261030000000_memory_cards_school_home.sql'),
  'utf8',
);
const firstSql = readFileSync(
  join(root, 'supabase/migrations/20261029100000_memory_cards.sql'),
  'utf8',
);
const rows = (text: string) =>
  [...text.matchAll(/\('([a-z]+)',\s*'(seed\/[a-z0-9-]+\.svg)'\)/g)].map((m) => ({
    word: m[1],
    path: m[2],
  }));

describe('school and home sample cards migration', () => {
  it('inserts exactly the ten words with seed/<word>.svg', () => {
    expect(rows(sql)).toEqual(WORDS.map((w) => ({ word: w, path: `seed/${w}.svg` })));
    expect(sql).toMatch(/insert into public\.memory_cards \(word, image_path, audio_path, active\)/i);
    expect(sql).toMatch(/select v\.word, v\.image_path, null, true/i);
  });

  it('is idempotent', () => {
    expect(sql).toMatch(
      /where not exists \(\s*select 1 from public\.memory_cards c where c\.image_path = v\.image_path\s*\)/i,
    );
  });

  it('has no DDL', () => {
    expect(sql).not.toMatch(/\b(create|alter|drop)\s+(table|policy)\b/i);
  });

  it('does not collide with the first migration and keeps word length 1..40', () => {
    const first = rows(firstSql);
    expect(first).toHaveLength(21);
    for (const r of rows(sql)) {
      expect(first.map((f) => f.word)).not.toContain(r.word);
      expect(first.map((f) => f.path)).not.toContain(r.path);
      expect(r.word.length).toBeGreaterThanOrEqual(1);
      expect(r.word.length).toBeLessThanOrEqual(40);
    }
  });
});

describe.each(WORDS)('seed picture %s', (word) => {
  const file = join(root, 'public/seed', `${word}.svg`);

  it('exists and is small', () => {
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeLessThan(4000);
  });

  it('passes the app SVG safety check', () => {
    expect(checkSvg(readFileSync(file, 'utf8'))).not.toHaveProperty('error');
  });

  it('has a viewBox, xmlns and no text', () => {
    const svg = readFileSync(file, 'utf8');
    expect(svg).toMatch(/viewBox="0 0 100 100"/);
    expect(svg).toMatch(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).not.toMatch(/<text/i);
  });
});
