import React, { useState } from 'react';
import { Search } from 'lucide-react';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import EmptyState from '../../../components/ui/EmptyState';
import type { ErrorLogEntry } from '../../../lib/types';
import styles from './ErrorLogViewer.module.css';

interface ErrorLogViewerProps {
  entries: ErrorLogEntry[];
  loading?: boolean;
}

export default function ErrorLogViewer({ entries, loading }: ErrorLogViewerProps) {
  const [filter, setFilter] = useState('');

  const filtered = entries.filter((e) => {
    const text = (e.message_text ?? e.text ?? '').toLowerCase();
    const proc = (e.process_info ?? '').toLowerCase();
    const q = filter.toLowerCase();
    return text.includes(q) || proc.includes(q);
  });

  return (
    <div className={styles.container}>
      <div className={styles.searchBar}>
        <Search size={16} color="var(--text-muted)" />
        <input
          type="text"
          placeholder="Hata günlüğünde metin veya process ara..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {loading && <LoadingSpinner message="Hata günlüğü okunuyor..." />}

      {!loading && filtered.length === 0 && (
        <EmptyState
          title="Kayıt Bulunamadı"
          message="Arama kriterine uyan bir hata günlüğü kaydı bulunamadı."
        />
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ overflowX: 'auto', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <table className={styles.logTable}>
            <tbody>
              {filtered.map((item, idx) => (
                <tr
                  key={idx}
                  className={`${styles.logRow} ${item.is_error ? styles.logRowError : ''}`}
                >
                  <td className={styles.cellDate}>
                    {new Date(item.log_date).toLocaleString('tr-TR')}
                  </td>
                  <td className={styles.cellProcess}>
                    [{item.process_info || 'spid'}]
                  </td>
                  <td className={styles.cellText}>
                    {item.message_text ?? item.text}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
