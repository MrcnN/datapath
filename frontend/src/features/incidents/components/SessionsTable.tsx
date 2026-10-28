import React, { useState, useMemo } from 'react';
import { useApi } from '../../../lib/useApi';
import { getSessions } from '../../../lib/api';
import { formatDuration, formatDate } from '../../../lib/utils';
import DataTable from '../../../components/ui/DataTable';
import StatusBadge from '../../../components/ui/StatusBadge';
import ErrorState from '../../../components/ui/ErrorState';
import type { Session } from '../../../lib/types';
import type { BadgeStatus } from '../../../components/ui/StatusBadge';
import styles from '../IncidentCenterPage.module.css';

function sessionStatus(status: string): BadgeStatus {
  if (status === 'running') return 'success';
  if (status === 'sleeping') return 'neutral';
  if (status === 'blocked') return 'error';
  return 'info';
}

interface SessionsTableProps {
  activeOnly?: boolean;
  onToggleActive?: () => void;
  sessions?: Session[];
  onRefresh?: () => void;
}

export default function SessionsTable({
  activeOnly = true,
  sessions: initialSessions,
  onRefresh,
}: SessionsTableProps) {
  const [filter, setFilter] = useState('');
  const { data, loading, error, refetch } = useApi(
    () => getSessions({ active_only: activeOnly }),
    [activeOnly]
  );

  const sessionList = initialSessions ?? data ?? [];

  const filtered = useMemo(() => {
    if (!filter.trim()) return sessionList;
    const q = filter.toLowerCase();
    return sessionList.filter(
      (s) =>
        (s.login_name ?? '').toLowerCase().includes(q) ||
        (s.host_name ?? '').toLowerCase().includes(q) ||
        (s.db_name ?? (s as any).database_name ?? '').toLowerCase().includes(q) ||
        String(s.session_id).includes(q)
    );
  }, [sessionList, filter]);

  const columns = [
    { key: 'session_id', label: 'Oturum ID', sortable: true, width: '90px' },
    { key: 'login_name', label: 'Login', sortable: true },
    { key: 'host_name', label: 'Host', sortable: true },
    {
      key: 'db_name',
      label: 'Veritabanı',
      sortable: true,
      render: (s: Session) => s.db_name ?? (s as any).database_name ?? '—',
    },
    {
      key: 'status',
      label: 'Durum',
      render: (s: Session) => (
        <StatusBadge
          status={sessionStatus(s.status ?? '')}
          label={s.status ?? 'unknown'}
        />
      ),
    },
    {
      key: 'command',
      label: 'Komut',
      secondary: true,
      render: (s: Session) => s.command ?? '—',
    },
    {
      key: 'wait_type',
      label: 'Bekleme Türü',
      render: (s: Session) =>
        s.wait_type ? (
          <span>
            {s.wait_type} ({formatDuration(s.wait_time_ms ?? (s as any).wait_time ?? 0)})
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'blocking_session_id',
      label: 'Engelleyen SPID',
      render: (s: Session) =>
        s.blocking_session_id && s.blocking_session_id > 0 ? (
          <span style={{ color: 'var(--status-error)', fontWeight: 600 }}>
            SPID {s.blocking_session_id}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'last_request_start_time',
      label: 'Başlangıç',
      render: (s: Session) => formatDate(s.last_request_start_time ?? ''),
    },
  ];

  if (error && !initialSessions) {
    return <ErrorState message={error} onRetry={onRefresh || refetch} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Oturumlarda ara (SPID, login, host, db)..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            padding: '6px 12px',
            fontSize: '13px',
            width: '320px',
          }}
        />
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              padding: '6px 12px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Yenile
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading && !initialSessions}
        emptyMessage="Aktif kullanıcı oturumu bulunamadı."
        emptyTitle="Oturum Yok"
      />
    </div>
  );
}
