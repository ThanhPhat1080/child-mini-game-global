import { vi } from 'vitest';

/** What a query looked like when it was awaited. */
export type QueryState = {
  table: string;
  op: 'select' | 'update' | 'insert' | 'delete';
  columns?: string;
  options?: { count?: string; head?: boolean };
  payload?: unknown;
  filters: [string, unknown][];
  single: boolean;
};

export type QueryResult = { data?: unknown; error?: unknown; count?: number | null };

/**
 * A chainable stand-in for `client.from(table)`. Every builder method records itself and returns the
 * builder; awaiting it (or calling maybeSingle/single) asks `resolve` for the result.
 */
export function fakeFrom(resolve: (q: QueryState) => QueryResult | Promise<QueryResult>) {
  const queries: QueryState[] = [];
  const from = vi.fn((table: string) => {
    const q: QueryState = { table, op: 'select', filters: [], single: false };
    const run = () => {
      queries.push(q);
      return Promise.resolve(resolve(q)).then((r) => ({ data: null, error: null, ...r }));
    };
    const b: Record<string, unknown> = {
      select(columns?: string, options?: QueryState['options']) {
        if (q.op === 'select') {
          q.columns = columns;
          q.options = options;
        }
        return b;
      },
      update(payload: unknown) {
        q.op = 'update';
        q.payload = payload;
        return b;
      },
      insert(payload: unknown) {
        q.op = 'insert';
        q.payload = payload;
        return b;
      },
      delete() {
        q.op = 'delete';
        return b;
      },
      eq(col: string, val: unknown) {
        q.filters.push([col, val]);
        return b;
      },
      maybeSingle() {
        q.single = true;
        return run();
      },
      single() {
        q.single = true;
        return run();
      },
      then(onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) {
        return run().then(onOk, onErr);
      },
    };
    return b;
  });
  return { from, queries };
}
