import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const sql = readFileSync(
  join(root, 'supabase/migrations/20261030120000_find_levels.sql'),
  'utf8',
);

describe('find_levels migration', () => {
  it('creates the table with its columns and the objects checks', () => {
    expect(sql).toMatch(/create table if not exists public\.find_levels/i);
    for (const col of [
      'id uuid primary key',
      'image_path text not null',
      'objects jsonb not null',
      'active boolean not null default true',
      'sort_order int not null default 0',
      'created_at timestamptz not null default now()',
    ]) {
      expect(sql).toContain(col);
    }
    expect(sql).toMatch(/jsonb_typeof\(objects\) = 'array'/i);
    expect(sql).toMatch(/jsonb_array_length\(objects\) between 2 and 12/i);
  });

  it('enables RLS with an active-only read policy and an admin-all policy', () => {
    expect(sql).toMatch(/alter table public\.find_levels enable row level security/i);
    expect(sql).toMatch(
      /create policy find_levels_read_active on public\.find_levels for select to anon, authenticated\s+using \(active\)/i,
    );
    expect(sql).toMatch(
      /create policy find_levels_admin_all on public\.find_levels for all to authenticated\s+using \(public\.is_admin\(\)\) with check \(public\.is_admin\(\)\)/i,
    );
  });

  it('guards the policies so a rerun does not fail', () => {
    expect(sql).toMatch(/drop policy if exists find_levels_read_active on public\.find_levels/i);
    expect(sql).toMatch(/drop policy if exists find_levels_admin_all on public\.find_levels/i);
  });

  it('inserts no rows', () => {
    expect(sql).not.toMatch(/\binsert\s+into\b/i);
  });
});
