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
