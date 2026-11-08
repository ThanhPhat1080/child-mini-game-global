import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Spec A35: the Puzzle Pairs seed reuses four existing drawings.
const root = process.cwd();
const sql = readFileSync(join(root, 'supabase/migrations/20261108000000_puzzle_pictures.sql'), 'utf8');

describe('puzzle_pictures migration seed (A35)', () => {
  it('seeds exactly fish, triangle, house and apple with their seed drawings', () => {
    const rows = [...sql.matchAll(/\('([a-z]+)',\s*'seed\/([a-z0-9-]+)\.svg'/g)].map((m) => [m[1], m[2]]);
    expect(rows.map((r) => r[0]).sort()).toEqual(['apple', 'fish', 'house', 'triangle']);
    for (const [word, file] of rows) {
      expect(file).toBe(word);
      expect(existsSync(join(root, 'public/seed', `${file}.svg`)), file).toBe(true);
    }
  });

  it('skips a seed row whose picture is already listed', () => {
    expect(sql).toMatch(/where not exists \(select 1 from public\.puzzle_pictures p where p\.image_path = v\.image_path\)/);
  });
});

describe('puzzle_pictures extra seed (switched off)', () => {
  const more = readFileSync(join(root, 'supabase/migrations/20261108200000_puzzle_pictures_more_seed.sql'), 'utf8');
  const rows = [...more.matchAll(/\('([a-z]+)',\s*'seed\/([a-z0-9-]+)\.svg',\s*(\d+)\)/g)].map((m) => ({ word: m[1], file: m[2], order: Number(m[3]) }));

  it('adds the 31 new drawings, one row each, with a word equal to the file name', () => {
    expect(rows).toHaveLength(31);
    expect(new Set(rows.map((r) => r.word)).size).toBe(31);
    for (const r of rows) {
      expect(r.file).toBe(r.word);
      expect(existsSync(join(root, 'public/seed', `${r.file}.svg`)), r.file).toBe(true);
    }
  });

  it('inserts them switched off, after the first four, and skips ones already listed', () => {
    expect(more).toMatch(/select v\.word, v\.image_path, false, v\.sort_order, null/);
    expect(Math.min(...rows.map((r) => r.order))).toBe(4);
    expect(more).toMatch(/where not exists \(select 1 from public\.puzzle_pictures p where p\.image_path = v\.image_path\)/);
  });
});

