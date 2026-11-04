import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const sql = readFileSync(
  join(root, 'supabase/migrations/20261030110000_card_groups.sql'),
  'utf8',
);

const GROUPS: Record<string, string[]> = {
  food: ['apple', 'banana', 'berry', 'grapes', 'cookie'],
  animals: ['bird', 'cat', 'duck', 'fish'],
  shapes: ['circle', 'heart', 'square', 'star', 'triangle'],
  school: ['ruler', 'pencil', 'pen', 'eraser', 'book', 'scissors', 'backpack'],
  home: ['cup', 'chair', 'clock', 'house'],
  nature: ['flower', 'moon', 'sun', 'tree'],
};
const expectedPairs = Object.entries(GROUPS).flatMap(([g, words]) =>
  words.map((w) => ({ group: g, path: `seed/${w}.svg` })),
);
const pairs = [...sql.matchAll(/\('([a-z]+)',\s*'(seed\/[a-z0-9-]+\.svg)'\)/g)].map((m) => ({
  group: m[1],
  path: m[2],
}));

describe('card groups migration: table', () => {
  it('creates card_groups with a 1-40 char name check', () => {
    expect(sql).toMatch(/create table if not exists public\.card_groups/i);
    expect(sql).toMatch(/id uuid primary key default gen_random_uuid\(\)/i);
    expect(sql).toMatch(/name text not null check \(char_length\(btrim\(name\)\) between 1 and 40\)/i);
    expect(sql).toMatch(/created_at timestamptz not null default now\(\)/i);
  });

  it('has a unique index on lower(btrim(name))', () => {
    expect(sql).toMatch(
      /create unique index if not exists \w+\s+on public\.card_groups \(lower\(btrim\(name\)\)\)/i,
    );
  });

  it('adds memory_cards.group_id with on delete set null', () => {
    expect(sql).toMatch(
      /alter table public\.memory_cards\s+add column if not exists group_id uuid null references public\.card_groups\(id\) on delete set null/i,
    );
  });
});

describe('card groups migration: RLS', () => {
  it('enables RLS', () => {
    expect(sql).toMatch(/alter table public\.card_groups enable row level security/i);
  });

  it('has admin-only select, insert, update and delete policies', () => {
    for (const op of ['select', 'insert', 'update', 'delete']) {
      const re = new RegExp(
        `create policy \\w+ on public\\.card_groups for ${op} to authenticated\\s+(using \\(public\\.is_admin\\(\\)\\)|with check \\(public\\.is_admin\\(\\)\\))`,
        'i',
      );
      expect(sql).toMatch(re);
    }
    expect(sql.match(/create policy/gi)).toHaveLength(4);
  });

  it('grants nothing to anon or public', () => {
    expect(sql).not.toMatch(/\banon\b/i);
    expect(sql).not.toMatch(/\bpublic\s*(,|\n|;)?\s*(using|with)/i);
    expect(sql).not.toMatch(/\bto\s+(public|anon)\b/i);
    expect(sql).not.toMatch(/\bgrant\b/i);
  });

  it('does not touch the memory_cards policies', () => {
    expect(sql).not.toMatch(/policy \w+ on public\.memory_cards/i);
  });
});

describe('card groups migration: seed', () => {
  it('seeds the six groups only where the name does not exist', () => {
    expect(sql).toMatch(/insert into public\.card_groups \(name\)/i);
    for (const g of Object.keys(GROUPS)) expect(sql).toContain(`('${g}')`);
    expect(sql).toMatch(
      /where not exists \(\s*select 1 from public\.card_groups g where lower\(btrim\(g\.name\)\) = lower\(btrim\(v\.name\)\)\s*\)/i,
    );
  });

  it('maps every spec word to its group through seed/<word>.svg', () => {
    expect(pairs).toEqual(expectedPairs);
    expect(pairs).toHaveLength(29);
  });

  it('only fills group_id where it is still null', () => {
    expect(sql).toMatch(/update public\.memory_cards c\s+set group_id = g\.id/i);
    expect(sql).toMatch(/c\.group_id is null/i);
    expect(sql).toMatch(/c\.image_path = v\.image_path/i);
  });

  it('leaves ball and car without a group', () => {
    expect(sql).not.toMatch(/\bball\b/i);
    expect(sql).not.toMatch(/\bcar\b/i);
  });

  it('every seeded picture exists in public/seed', () => {
    for (const p of pairs) expect(existsSync(join(root, 'public', p.path))).toBe(true);
  });
});
