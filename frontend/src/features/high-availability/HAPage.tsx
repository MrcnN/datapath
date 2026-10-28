import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, ShieldAlert } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import DataTable, { type Column } from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import { getHAStatus } from '../../lib/api';
import type { HAStatus, AGReplica, AGDatabase } from '../../lib/types';
import styles from './HAPage.module.css';

export default function HAPage() {
  const [status, setStatus] = useState<HAStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const data = await getHAStatus();
        setStatus(data);
      } catch (err: any) {
        setError(err.message || 'Yüksek erişilebilirlik verisi alınamadı');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const replicaColumns: Column<AGReplica>[] = [
    {
      key: 'name',
      label: 'Replika Sunucu',
      sortable: true,
      render: (r) => <strong>{r.name}</strong>,
    },
    {
      key: 'role',
      label: 'Rol',
      render: (r) => {
        const isPrimary = r.role?.toLowerCase() === 'primary';
        return (
          <StatusBadge
            variant={isPrimary ? 'info' : 'neutral'}
            label={isPrimary ? 'Birincil (PRIMARY)' : 'İkincil (SECONDARY)'}
          />
        );
      },
    },
    {
      key: 'availability_mode',
      label: 'Kullanılabilirlik Modu',
      render: (r) => r.availability_mode || '—',
    },
    {
      key: 'failover_mode',
      label: 'Failover Modu',
      render: (r) => r.failover_mode || '—',
    },
    {
      key: 'synchronization_health',
      label: 'Senkronizasyon Sağlığı',
      render: (r) => {
        const isHealthy = r.synchronization_health?.toLowerCase().includes('healthy');
        return (
          <StatusBadge
            variant={isHealthy ? 'success' : 'warning'}
            label={r.synchronization_health || 'Bilinmiyor'}
          />
        );
      },
    },
  ];

  const dbColumns: Column<AGDatabase>[] = [
    {
      key: 'name',
      label: 'Veritabanı',
      render: (d) => <strong>{d.name}</strong>,
    },
    {
      key: 'sync_state',
      label: 'Senkronizasyon Durumu',
      render: (d) => (
        <StatusBadge
          variant={d.sync_state?.toLowerCase().includes('synch') ? 'success' : 'warning'}
          label={d.sync_state || '—'}
        />
      ),
    },
    {
      key: 'is_suspended',
      label: 'Askıya Alındı mı?',
      render: (d) => (
        <StatusBadge
          variant={d.is_suspended ? 'error' : 'success'}
          label={d.is_suspended ? 'Askıda (Suspended)' : 'Aktif'}
        />
      ),
    },
    {
      key: 'redo_queue_size_kb',
      label: 'Redo Kuyruğu (KB)',
      render: (d) => `${d.redo_queue_size_kb ?? 0} KB`,
    },
  ];

  return (
    <div className={styles.container}>
      <PageHeader
        title="Yüksek Erişilebilirlik (Always On High Availability)"
        subtitle="Always On kullanılabilirlik grupları, birincil/ikincil replikalar ve senkronizasyon sağlığı"
      />

      {loading && <LoadingSpinner message="Always On AG durumu denetleniyor..." />}
      {error && <ErrorState message={error} onRetry={() => setLoading(true)} />}

      {!loading && status && !status.available && (
        <EmptyState
          title="Always On Aktif Değil"
          message={status.reason || 'Bu SQL Server sunucusunda Always On High Availability özelliği yapılandırılmamış.'}
        />
      )}

      {!loading && status && status.available && status.groups.length === 0 && (
        <EmptyState
          title="Kullanılabilirlik Grubu Bulunamadı"
          message={status.reason || 'Always On özelliği sunucuda açık ancak henüz yapılandırılmış bir AG grubu bulunmuyor.'}
        />
      )}

      {!loading && status && status.available && status.groups.map((group) => (
        <div key={group.ag_name} className={styles.agCard}>
          <div className={styles.agHeader}>
            <div className={styles.agTitle}>
              <Activity size={20} color="var(--accent)" />
              <span>Grup: {group.ag_name}</span>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <StatusBadge
                variant={group.sync_health?.toLowerCase().includes('healthy') ? 'success' : 'warning'}
                label={`Senkronizasyon: ${group.sync_health || 'Normal'}`}
              />
              <StatusBadge
                variant="info"
                label={`Birincil: ${group.primary_replica || '—'}`}
              />
            </div>
          </div>

          <div className={styles.replicaSection}>
            <span className={styles.sectionTitle}>Replikalar ({group.replicas.length})</span>
            <DataTable
              columns={replicaColumns}
              data={group.replicas}
              emptyMessage="Replika bulunamadı."
            />
          </div>

          <div className={styles.dbSection}>
            <span className={styles.sectionTitle}>Grup İçi Veritabanları ({group.databases.length})</span>
            <DataTable
              columns={dbColumns}
              data={group.databases}
              emptyMessage="Gruba eklenmiş veritabanı yok."
            />
          </div>
        </div>
      ))}
    </div>
  );
}
