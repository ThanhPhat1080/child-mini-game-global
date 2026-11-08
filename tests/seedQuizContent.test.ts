// @vitest-environment jsdom
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkSvg } from '@/lib/quizImport';

const MIGRATION = 'supabase/migrations/20261108000000_seed_quiz_body_home_clothes_furniture.sql';
const sql = readFileSync(MIGRATION, 'utf8');
const sets = sql.split(/\n  if not exists/).slice(1);
const NEW_PICTURES = ['eye', 'ear', 'nose', 'mouth', 'hand', 'foot', 'hair', 'tooth', 'spoon', 'bowl', 'toothbrush', 'key', 'lamp', 'umbrella', 'towel', 'broom',
  'shirt', 'pants', 'dress', 'hat', 'socks', 'shoes', 'jacket', 'gloves', 'bed', 'table', 'sofa', 'wardrobe', 'tv', 'mirror', 'shelf'];

describe('seed quiz sets: Body, Home, Clothes, Furniture', () => {
  it('adds four global sets, each published and inserted only once', () => {
    expect(sets).toHaveLength(4);
    for (const s of sets) {
      expect(s).toMatch(/insert into public\.quiz_sets .* 'global'\) returning id into s;/);
      expect(s).toContain("update public.quiz_sets set status = 'published' where id = s;");
    }
    expect(sets.map((s) => /title = '([^']+)'/.exec(s)![1])).toEqual(['Body', 'Home', 'Clothes', 'Furniture']);
  });

  it('every referenced picture exists and is safe SVG', () => {
    const paths = new Set([...sql.matchAll(/'seed\/([\w-]+\.svg)'/g)].map((m) => m[1]));
    expect(paths.size).toBeGreaterThan(30);
    for (const p of paths) {
      expect(existsSync(`public/seed/${p}`), p).toBe(true);
      const r = checkSvg(readFileSync(`public/seed/${p}`, 'utf8'));
      expect('error' in r ? r.error : '', p).toBe('');
    }
  });

  it('every new picture is used by a question', () => {
    for (const n of NEW_PICTURES) expect(sql, n).toContain(`'seed/${n}.svg'`);
    expect(readdirSync('public/seed')).toEqual(expect.arrayContaining(['cover-body.svg', 'cover-home.svg', 'cover-clothes.svg', 'cover-furniture.svg']));
  });

  it('each set has 8 complete questions: 3 different answers, exactly one right, matching the prompt picture', () => {
    for (const s of sets) {
      const questions = s.split('insert into public.questions').slice(1);
      expect(questions).toHaveLength(8);
      for (const q of questions) {
        const prompt = /values \(s, \d+, '[^']+', '(seed\/[\w-]+\.svg)'\)/.exec(q)![1];
        const answers = [...q.matchAll(/\(qid, (\d), '(seed\/[\w-]+\.svg)', (true|false)\)/g)].map((m) => ({ slot: +m[1], path: m[2], right: m[3] === 'true' }));
        expect(answers.map((a) => a.slot)).toEqual([1, 2, 3]);
        expect(new Set(answers.map((a) => a.path)).size).toBe(3);
        expect(answers.filter((a) => a.right)).toHaveLength(1);
        expect(answers.find((a) => a.right)!.path).toBe(prompt);
      }
    }
  });
});
