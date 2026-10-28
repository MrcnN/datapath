import React from 'react';
import { useApi } from '../../../lib/useApi';
import { getDatabases } from '../../../lib/api';
import { formatMB, formatDate } from '../../../lib/utils';
import DataTable from '../../../components/ui/DataTable';
import StatusBadge from '../../../components/ui/StatusBadge';
import type { Database } from '../../../lib/types';
import type { BadgeStatus } from '../../../components/ui/StatusBadge';

function stateToStatus(state: string): BadgeStatus {
  if (state === 'ONLINE') return 'success';
  if (state === 'OFFLINE' || state === 'SUSPECT') return 'error';
  if (state === 'RESTORING' || state === 'RECOVERING') return 'warning';
  return 'neutral';
}

export default function DatabaseTable() {
  const { data, loading, error, refetch } = useApi(getDatabases);

  const columns = [
    { key: 'name', label: 'Veritabanı', sortable: true },
    {
      key: 'state',
      label: 'Durum',
      render: (row: Database) => {
        const stateStr = row.state_desc ?? row.state ?? 'ONLINE';
        return <StatusBadge status={stateToStatus(stateStr)} label={stateStr} />;
      },
    },
    {
      key: 'recovery_model',
      label: 'Kurtarma Modeli',
      sortable: true,
      render: (row: Database) => row.recovery_model_desc ?? row.recovery_model ?? 'FULL',
    },
    {
      key: 'size_mb',
      label: 'Boyut',
      sortable: true,
      render: (row: Database) => formatMB(row.size_mb ?? 0),
    },
    {
      key: 'compatibility_level',
      label: 'Uyumluluk Düzeyi',
      sortable: true,
      render: (row: Database) => row.compatibility_level ?? '—',
    },
    {
      key: 'create_date',
      label: 'Oluşturulma',
      secondary: true,
      render: (row: Database) => formatDate(row.create_date ?? ''),
    },
  ];

  if (error) {
    return (
      <div style={{ padding: '16px', color: 'var(--status-error)', fontSize: '13px' }}>
        Veritabanı listesi alınamadı: {error}{' '}
        <button
          type="button"
          onClick={refetch}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent)',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Tekrar Dene
        </button>
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={data ?? []}
      loading={loading}
      emptyMessage="Veritabanı bulunamadı."
      emptyTitle="Veritabanı Yok"
    />
  );
}
