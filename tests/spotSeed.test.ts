import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkDifferences } from '../lib/spot/validate';

const root = process.cwd();
const sql = readFileSync(
  join(root, 'supabase/migrations/20261030100000_spot_levels.sql'),
  'utf8',
);

describe('spot_levels migration', () => {
  it('creates the table with its columns and the differences length check', () => {
    expect(sql).toMatch(/create table (if not exists )?public\.spot_levels/i);
    for (const col of ['id uuid primary key', 'image_a_path text not null', 'image_b_path text not null', 'active boolean not null default true', 'sort_order int not null default 0', 'created_at timestamptz not null default now()']) {
      expect(sql).toContain(col);
    }
    expect(sql).toMatch(
      /differences jsonb not null check \(jsonb_typeof\(differences\) = 'array' and jsonb_array_length\(differences\) between 3 and 10\)/i,
    );
  });

  it('enables RLS with an active-only read policy and an admin-all policy', () => {
    expect(sql).toMatch(/alter table public\.spot_levels enable row level security/i);
    expect(sql).toMatch(
      /create policy spot_levels_read_active on public\.spot_levels for select to anon, authenticated\s+using \(active\)/i,
    );
    expect(sql).toMatch(
      /create policy spot_levels_admin_all on public\.spot_levels for all to authenticated\s+using \(public\.is_admin\(\)\) with check \(public\.is_admin\(\)\)/i,
    );
  });

  it('seeds levels whose differences are valid', () => {
    const lists = [...sql.matchAll(/'(\[[^']*\])'::jsonb/g)].map((m) => JSON.parse(m[1]));
    expect(lists.length).toBeGreaterThanOrEqual(3);
    for (const list of lists) {
      expect(checkDifferences(list)).toBeNull();
      for (const d of list) {
        expect(d.x).toBeGreaterThan(0);
        expect(d.x).toBeLessThan(1);
        expect(d.y).toBeGreaterThan(0);
        expect(d.y).toBeLessThan(1);
      }
    }
  });

  it('seeds pairs of pictures that exist and differ', () => {
    const pairs = [...sql.matchAll(/'seed\/spot\/([a-z0-9-]+-a)\.svg',\s*'seed\/spot\/([a-z0-9-]+-b)\.svg'/g)];
    expect(pairs.length).toBeGreaterThanOrEqual(3);
    for (const [, a, b] of pairs) {
      const pa = join(root, 'public/seed/spot', `${a}.svg`);
      const pb = join(root, 'public/seed/spot', `${b}.svg`);
      expect(existsSync(pa), a).toBe(true);
      expect(existsSync(pb), b).toBe(true);
      expect(readFileSync(pa, 'utf8')).not.toBe(readFileSync(pb, 'utf8'));
    }
  });
});
