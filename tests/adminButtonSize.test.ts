import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx|ts)$/.test(n) ? [p] : [];
  });

describe('admin buttons share one size (medium)', () => {
  it('every inline button style is 40px high with 18px side padding and a 10px radius', () => {
    const bad: string[] = [];
    for (const f of [...walk('app/admin'), ...walk('components/admin')]) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        // a button style: a height, a "0 Npx" side padding and a button radius on one line (inputs and selects excluded)
        if (!/height: \d+/.test(line) || !/padding: '0 \d+px'/.test(line) || /<input|<select|inputStyle|chip|const input|selectArrowStyle/.test(line)) return;
        if (!/borderRadius: 1[02]\b/.test(line) && /borderRadius/.test(line)) return;
        if (!/height: 40,/.test(line) || !/padding: '0 18px'/.test(line) || !/borderRadius: 10/.test(line)) bad.push(`${f}:${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });
});
