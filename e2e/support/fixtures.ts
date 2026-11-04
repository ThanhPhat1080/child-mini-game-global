import type { Page } from '@playwright/test';

// playwright.config.ts sets STANDIN_PORT before the workers start.
export const STANDIN = `http://127.0.0.1:${process.env.STANDIN_PORT ?? 54391}`;

export type MemoryCardRow = {
  id: string;
  word: string;
  image_path: string;
  active: boolean;
  position: number;
  created_at: string;
  group_id?: string | null;
};

export type SpotLevelRow = {
  id: string;
  image_a_path: string;
  image_b_path: string;
  differences: { x: number; y: number; r: number }[];
  active: boolean;
  sort_order: number;
  created_at: string;
};

export type FindLevelRow = {
  id: string;
  image_path: string;
  objects: { x: number; y: number; r: number; word: string; audio_path: string | null }[];
  active: boolean;
  sort_order: number;
  created_at: string;
};

export type Row = Record<string, unknown>;

export type StandinState = {
  memory_cards: Row[];
  card_groups: Row[];
  spot_levels: Row[];
  find_levels: Row[];
  child_settings: Row[];
  quiz_sets: Row[];
  questions: Row[];
  answers: Row[];
  profiles: Row[];
  support_messages: Row[];
  review_events: Row[];
  /** Paths of files already in the media bucket (empty placeholders). */
  storage: string[];
};

/** Replaces the whole stand-in state; with no argument it restores the default (18 cards, settings, no sets). */
export async function reset(state: Partial<StandinState> = {}): Promise<void> {
  const res = await fetch(`${STANDIN}/__reset`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(state),
  });
  if (!res.ok) throw new Error(`reset failed: ${res.status}`);
}

export async function getState(): Promise<StandinState> {
  const res = await fetch(`${STANDIN}/__state`);
  if (!res.ok) throw new Error(`getState failed: ${res.status}`);
  return (await res.json()) as StandinState;
}

/** n memory cards with words word1..wordN, all using the bundled apple art. */
export function makeCards(n: number, active = true): MemoryCardRow[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    word: `word${i + 1}`,
    image_path: 'seed/apple.svg',
    active,
    position: i + 1,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
  }));
}

/** The fixed uuid of the `index`-th (0-based) group of makeGroupedCards. */
export const groupUuid = (index: number) => `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;

/**
 * Sort It cards: for each group name, `count` active cards with words <group>1..<group>N and the bundled apple art.
 * `group_id` is a fixed uuid per group (by the order of the names, see groupUuid).
 */
export function makeGroupedCards(groups: Record<string, number>): MemoryCardRow[] {
  const rows: MemoryCardRow[] = [];
  Object.entries(groups).forEach(([name, count], g) => {
    for (let n = 1; n <= count; n++) {
      const i = rows.length;
      rows.push({
        id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
        word: `${name}${n}`,
        image_path: 'seed/apple.svg',
        active: true,
        position: i + 1,
        created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
        group_id: groupUuid(g),
      });
    }
  });
  return rows;
}

/** n spot levels (garden art, 3 valid differences each), ids ...a000-00000000000N. */
export function makeSpotLevels(n: number, active = true): SpotLevelRow[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `00000000-0000-4000-a000-${String(i + 1).padStart(12, '0')}`,
    image_a_path: 'seed/spot/garden-a.svg',
    image_b_path: 'seed/spot/garden-b.svg',
    differences: [
      { x: 0.25, y: 0.3, r: 0.06 },
      { x: 0.5, y: 0.6, r: 0.06 },
      { x: 0.75, y: 0.4, r: 0.06 },
    ],
    active,
    sort_order: i + 1,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
  }));
}

/** n Find It levels (apple art, 3 objects each with distinct words), ids ...b000-00000000000N. */
export function makeFindLevels(n: number, objectsPer = 3, active = true): FindLevelRow[] {
  const words = ['apple', 'ball', 'cat', 'duck', 'fish', 'star', 'sun', 'tree', 'house', 'moon', 'book', 'car'];
  return Array.from({ length: n }, (_, i) => ({
    id: `00000000-0000-4000-b000-${String(i + 1).padStart(12, '0')}`,
    image_path: 'seed/apple.svg',
    objects: Array.from({ length: objectsPer }, (_, k) => ({
      x: 0.2 + 0.3 * k,
      y: 0.3 + 0.2 * ((k + i) % 3),
      r: 0.08,
      word: words[(i * objectsPer + k) % words.length],
      audio_path: null,
    })),
    active,
    sort_order: i + 1,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
  }));
}

export const ACCOUNTS = {
  super: { email: 'super@test.local', password: 'secret', id: '11111111-1111-4111-8111-111111111111' },
  parent: { email: 'admin@test.local', password: 'secret', id: '22222222-2222-4222-8222-222222222222' },
  child: { email: 'child@test.local', password: 'secret', id: '33333333-3333-4333-8333-333333333333' },
} as const;

/** Signs in through the real admin form as the parent (admin@test.local / secret); a parent lands on /admin/children. */
export async function signInAsAdmin(page: Page): Promise<void> {
  await signInAdminForm(page, ACCOUNTS.parent);
  await page.waitForURL('**/admin/children');
}

/** Signs in through the real admin form as the Super Admin; the landing page is the review queue. */
export async function signInAsSuper(page: Page): Promise<void> {
  await signInAdminForm(page, ACCOUNTS.super);
  await page.waitForURL('**/admin/queue');
}

async function signInAdminForm(page: Page, who: { email: string; password: string }): Promise<void> {
  await page.goto('/admin/sign-in');
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password').fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** Signs in on the child's device (/play/sign-in) and waits for the game list. */
export async function signInAsChild(page: Page, who: { email: string; password: string } = ACCOUNTS.child): Promise<void> {
  await page.goto('/play/sign-in');
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password').fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/games');
}

/** Clears the browser session (use `test.use({ storageState: SIGNED_OUT })` to start a file signed out). */
export const SIGNED_OUT = { cookies: [], origins: [] };
