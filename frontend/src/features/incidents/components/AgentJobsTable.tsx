import React from 'react';
import DataTable, { type Column } from '../../../components/ui/DataTable';
import StatusBadge from '../../../components/ui/StatusBadge';
import EmptyState from '../../../components/ui/EmptyState';
import type { AgentJob } from '../../../lib/types';

interface AgentJobsTableProps {
  jobs: AgentJob[];
  loading?: boolean;
}

export default function AgentJobsTable({ jobs, loading }: AgentJobsTableProps) {
  const columns: Column<AgentJob>[] = [
    {
      key: 'job_name',
      label: 'İş Adı (Job Name)',
      sortable: true,
      render: (job) => <strong>{job.job_name}</strong>,
    },
    {
      key: 'step_name',
      label: 'Adım (Step)',
      render: (job) => job.step_name || '—',
    },
    {
      key: 'status',
      label: 'Durum',
      render: (job) => {
        const isFailed = job.status === 'failed' || job.status === 'Hata';
        return (
          <StatusBadge
            variant={isFailed ? 'error' : 'success'}
            label={job.status}
          />
        );
      },
    },
    {
      key: 'run_date',
      label: 'Çalışma Zamanı',
      sortable: true,
      render: (job) => {
        if (!job.run_date) return '—';
        return new Date(job.run_date).toLocaleString('tr-TR');
      },
    },
    {
      key: 'run_duration_seconds',
      label: 'Süre (sn)',
      render: (job) => `${job.run_duration_seconds ?? 0}s`,
    },
    {
      key: 'message',
      label: 'Sonuç Mesajı',
      render: (job) => {
        const msg = (job as any).outcome_message || job.message || '—';
        return (
          <span
            title={msg !== '—' ? msg : undefined}
            style={{
              maxWidth: 300,
              display: 'inline-block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'var(--text-secondary)',
            }}
          >
            {msg}
          </span>
        );
      },
    },
  ];

  if (!loading && jobs.length === 0) {
    return (
      <EmptyState
        title="Başarısız İş Bulunamadı"
        message="Seçilen tarih aralığında başarısız olmuş bir SQL Server Agent görevi bulunmuyor."
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      data={jobs}
      loading={loading}
      emptyMessage="Agent iş geçmişi bulunamadı."
    />
  );
}
