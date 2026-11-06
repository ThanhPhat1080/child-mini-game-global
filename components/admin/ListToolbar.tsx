import styles from '@/app/admin/admin.module.css';
import s from './admin-ui.module.css';
import type { SortOrder } from '@/lib/people';
import type { ReactNode } from 'react';

const DEFAULT_SORT: { value: SortOrder; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'az', label: 'A–Z' },
];

/** Search box, sort select and a slot for extra buttons, shared by the people pages (N10, N15, N17). */
export function ListToolbar({ query, onQuery, searchLabel, placeholder, sort, onSort, sortOptions = DEFAULT_SORT, children }: {
  query: string; onQuery: (q: string) => void; searchLabel: string; placeholder: string;
  sort: SortOrder; onSort: (s: SortOrder) => void; sortOptions?: { value: SortOrder; label: string }[]; children?: ReactNode;
}) {
  return (
    <div className={s.toolbar}>
      <input
        type="search"
        className={styles.input}
        style={{ flex: '1 1 260px', minWidth: 0 }}
        aria-label={searchLabel}
        placeholder={placeholder}
        value={query}
        onChange={(e) => onQuery(e.target.value)}
      />
      <select aria-label="Sort" className={styles.input} value={sort} onChange={(e) => onSort(e.target.value as SortOrder)}>
        {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {children}
    </div>
  );
}
