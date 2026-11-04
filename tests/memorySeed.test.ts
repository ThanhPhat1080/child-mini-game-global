import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const sql = readFileSync(
  join(root, 'supabase/migrations/20261029100000_memory_cards.sql'),
  'utf8',
);

describe('memory_cards migration', () => {
  it('creates the table and enables RLS', () => {
    expect(sql).toMatch(/create table (if not exists )?public\.memory_cards/i);
    expect(sql).toMatch(/alter table public\.memory_cards enable row level security/i);
    expect(sql).toMatch(/char_length\(btrim\(word\)\) between 1 and 40/i);
  });

  it('lets anon read only active rows', () => {
    expect(sql).toMatch(
      /create policy memory_cards_read_active on public\.memory_cards for select to anon, authenticated\s+using \(active\)/i,
    );
  });

  it('gives the admin full access via is_admin()', () => {
    expect(sql).toMatch(
      /create policy memory_cards_admin_all on public\.memory_cards for all to authenticated\s+using \(public\.is_admin\(\)\) with check \(public\.is_admin\(\)\)/i,
    );
  });

  it('seeds at least 18 distinct cards whose drawings exist', () => {
    const paths = [...sql.matchAll(/'seed\/([a-z0-9-]+)\.svg'/g)].map((m) => m[1]);
    const words = [...sql.matchAll(/\('([a-z]+)',\s*'seed\//g)].map((m) => m[1]);
    expect(new Set(words).size).toBeGreaterThanOrEqual(18);
    expect(new Set(paths).size).toBe(new Set(words).size);
    for (const name of paths) {
      expect(existsSync(join(root, 'public/seed', `${name}.svg`)), name).toBe(true);
    }
    expect(paths.some((p) => p.startsWith('cover-'))).toBe(false);
  });
});
