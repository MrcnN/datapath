import React, { useState, ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';
import styles from './DataTable.module.css';

export interface Column<T> {
  key: string;
  label: string;
  width?: string;
  sortable?: boolean;
  secondary?: boolean;
  render?: (row: T) => ReactNode;
}

export interface DataTableProps<T extends Record<string, any>> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  emptyTitle?: string;
  keyField?: string;
}

export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  emptyMessage = 'Gösterilecek kayıt bulunamadı.',
  emptyTitle = 'Veri Yok',
  keyField,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortDir === 'asc' ? av - bv : bv - av;
    }
    const as = String(av);
    const bs = String(bv);
    return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
  });

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner message="Kayıtlar yükleniyor..." />
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={col.sortable ? styles.sortableTh : undefined}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <div className={styles.thContent}>
                  <span>{col.label}</span>
                  {col.sortable && (
                    <span className={styles.sortIcon}>
                      {sortKey === col.key ? (
                        sortDir === 'asc' ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )
                      ) : (
                        <ChevronsUpDown size={14} />
                      )}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const key = keyField && row[keyField] !== undefined ? String(row[keyField]) : String(i);
            return (
              <tr key={key} className={styles.row}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={col.secondary ? styles.secondaryCell : undefined}
                  >
                    {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
