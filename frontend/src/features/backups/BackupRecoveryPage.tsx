import React, { useState, useEffect } from 'react';
import PageHeader from '../../components/layout/PageHeader';
import DataTable, { type Column } from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import { getBackupHistory, getRecoveryReadiness } from '../../lib/api';
import type { BackupEntry, RecoveryReadiness } from '../../lib/types';
import styles from './BackupRecoveryPage.module.css';

export default function BackupRecoveryPage() {
  const [history, setHistory] = useState<BackupEntry[]>([]);
  const [readiness, setReadiness] = useState<RecoveryReadiness[]>([]);
  const [daysBack, setDaysBack] = useState<number>(30);
  const [backupType, setBackupType] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const [histData, readyData] = await Promise.all([
          getBackupHistory({ days_back: daysBack, backup_type: backupType }),
          getRecoveryReadiness().catch(() => []),
        ]);
        setHistory(histData);
        setReadiness(readyData);
      } catch (err: any) {
        setError(err.message || 'Yedekleme verileri alınamadı');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [daysBack, backupType]);

  const columns: Column<BackupEntry>[] = [
    {
      key: 'database_name',
      label: 'Veritabanı',
      sortable: true,
      render: (b) => <strong>{b.database_name}</strong>,
    },
    {
      key: 'backup_type',
      label: 'Yedek Türü',
      render: (b) => {
        const typeMap: Record<string, { label: string; variant: 'info' | 'warning' | 'neutral' }> = {
          D: { label: 'Tam (Full)', variant: 'info' },
          I: { label: 'Fark (Diff)', variant: 'warning' },
          L: { label: 'Log (İşlem Günlüğü)', variant: 'neutral' },
        };
        const mapped = typeMap[b.backup_type] || { label: b.backup_type_desc || b.backup_type, variant: 'neutral' };
        return <StatusBadge variant={mapped.variant} label={mapped.label} />;
      },
    },
    {
      key: 'backup_start_date',
      label: 'Başlangıç',
      sortable: true,
      render: (b) => (b.backup_start_date ? new Date(b.backup_start_date).toLocaleString('tr-TR') : '—'),
    },
    {
      key: 'duration_seconds',
      label: 'Süre (sn)',
      render: (b) => `${b.duration_seconds ?? 0}s`,
    },
    {
      key: 'backup_size_gb',
      label: 'Boyut (GB)',
      sortable: true,
      render: (b) => (b.backup_size_gb ? `${b.backup_size_gb.toFixed(2)} GB` : '—'),
    },
    {
      key: 'compression_ratio',
      label: 'Sıkıştırma Oranı',
      render: (b) => (b.compression_ratio ? `${b.compression_ratio.toFixed(1)}x` : '—'),
    },
  ];

  return (
    <div className={styles.container}>
      <PageHeader
        title="Yedekleme ve Kurtarma (Backup & Recovery)"
        subtitle="Veritabanı yedekleme geçmişi, RPO kurtarma hazırlığı ve felaket senaryosu kontrol listesi"
      />

      {readiness.length > 0 && (
        <section>
          <h2 style={{ fontSize: 16, marginBottom: 12, color: 'var(--text-primary)' }}>
            Kurtarma Hazırlığı Durumu (Recovery Readiness)
          </h2>
          <div className={styles.readinessGrid}>
            {readiness.map((item) => {
              const riskVariant =
                item.recovery_point_objective_risk === 'low'
                  ? 'success'
                  : item.recovery_point_objective_risk === 'medium'
                  ? 'warning'
                  : 'error';

              return (
                <div key={item.database_name} className={styles.readinessCard}>
                  <div className={styles.cardHeader}>
                    <span className={styles.dbName}>{item.database_name}</span>
                    <StatusBadge
                      variant={riskVariant}
                      label={`Risk: ${item.recovery_point_objective_risk.toUpperCase()}`}
                    />
                  </div>
                  <div className={styles.detailRow}>
                    <span>Kurtarma Modeli:</span>
                    <span>{item.recovery_model}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Son Tam Yedek:</span>
                    <span>
                      {item.last_full_backup
                        ? `${item.full_backup_age_hours ?? 0} saat önce`
                        : 'Hiç alınmadı!'}
                    </span>
                  </div>
                  {item.recovery_model === 'FULL' && (
                    <div className={styles.detailRow}>
                      <span>Son Log Yedeği:</span>
                      <span>
                        {item.last_log_backup
                          ? `${item.log_backup_age_hours ?? 0} saat önce`
                          : 'Hiç alınmadı!'}
                      </span>
                    </div>
                  )}
                  {item.issues && item.issues.length > 0 && (
                    <ul className={styles.issueList}>
                      {item.issues.map((iss, i) => (
                        <li key={i}>{iss}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className={styles.controls}>
        <div className={styles.selectGroup}>
          <label className={styles.label}>Zaman Aralığı</label>
          <select
            className={styles.select}
            value={daysBack}
            onChange={(e) => setDaysBack(Number(e.target.value))}
          >
            <option value={7}>Son 7 Gün</option>
            <option value={14}>Son 14 Gün</option>
            <option value={30}>Son 30 Gün</option>
            <option value={90}>Son 90 Gün</option>
          </select>
        </div>

        <div className={styles.selectGroup}>
          <label className={styles.label}>Yedek Türü Filtresi</label>
          <select
            className={styles.select}
            value={backupType}
            onChange={(e) => setBackupType(e.target.value)}
          >
            <option value="all">Tüm Yedekler</option>
            <option value="D">Yalnızca Tam (Full)</option>
            <option value="I">Yalnızca Fark (Differential)</option>
            <option value="L">Yalnızca İşlem Günlüğü (Log)</option>
          </select>
        </div>
      </div>

      {loading && <LoadingSpinner message="Yedekleme geçmişi alınıyor..." />}
      {error && <ErrorState message={error} onRetry={() => setDaysBack(daysBack)} />}

      {!loading && !error && history.length === 0 && (
        <EmptyState
          title="Yedekleme Kaydı Bulunamadı"
          message="Seçilen zaman aralığında bu kriterlere uyan bir yedekleme kaydı bulunamadı."
        />
      )}

      {!loading && !error && history.length > 0 && (
        <DataTable
          columns={columns}
          data={history}
          emptyMessage="Yedek kaydı bulunamadı."
        />
      )}
    </div>
  );
}
