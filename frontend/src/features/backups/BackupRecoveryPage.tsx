import React, { useState, useEffect } from 'react';
import { ShieldCheck, History, HeartPulse, Copy, Check, AlertTriangle, Code2 } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import DataTable, { type Column } from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import { getBackupHistory, getRecoveryReadiness, getDatabaseIntegrityChecks } from '../../lib/api';
import type { BackupEntry, RecoveryReadiness, DatabaseIntegrityCheck } from '../../lib/types';
import styles from './BackupRecoveryPage.module.css';

function formatAge(hours?: number | null, dateStr?: string | null): string {
  if (!dateStr && (hours === undefined || hours === null)) return 'Hiç alınmadı!';
  if (hours === undefined || hours === null) return 'Hiç alınmadı!';
  if (hours <= 0 || hours < 0.05) return 'Az önce';
  if (hours < 1) {
    const mins = Math.max(1, Math.round(hours * 60));
    return `${mins} dakika önce`;
  }
  if (hours < 24) {
    return `${hours.toFixed(1)} saat önce`;
  }
  const days = (hours / 24).toFixed(1);
  return `${days} gün önce`;
}

export default function BackupRecoveryPage() {
  const [activeTab, setActiveTab] = useState<'history' | 'readiness' | 'integrity'>('history');
  const [history, setHistory] = useState<BackupEntry[]>([]);
  const [readiness, setReadiness] = useState<RecoveryReadiness[]>([]);
  const [integrityList, setIntegrityList] = useState<DatabaseIntegrityCheck[]>([]);
  const [daysBack, setDaysBack] = useState<number>(30);
  const [backupType, setBackupType] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCheckdbSql, setSelectedCheckdbSql] = useState<{ dbName: string; sql: string } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const [histData, readyData, intData] = await Promise.all([
          getBackupHistory({ days_back: daysBack, backup_type: backupType }).catch(() => []),
          getRecoveryReadiness().catch(() => []),
          getDatabaseIntegrityChecks().catch(() => []),
        ]);
        setHistory(histData);
        setReadiness(readyData);
        setIntegrityList(intData);
      } catch (err: any) {
        setError(err.message || 'Yedekleme ve bütünlük verileri alınamadı');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [daysBack, backupType]);

  const handleCopy = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const historyColumns: Column<BackupEntry>[] = [
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

  const integrityColumns: Column<DatabaseIntegrityCheck>[] = [
    {
      key: 'database_name',
      label: 'Veritabanı',
      sortable: true,
      render: (item) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{item.database_name}</strong>
            {item.is_read_only && (
              <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}>
                Salt Okunur (Read Only)
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'last_clean_checkdb',
      label: 'Son Temiz CHECKDB Tarihi',
      sortable: true,
      render: (item) => (
        <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600 }}>
          {item.last_clean_checkdb}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Bütünlük Durumu',
      sortable: true,
      render: (item) => {
        const isCrit = item.status === 'CRITICAL';
        const isWarn = item.status === 'WARNING';
        const badgeBg = isCrit ? 'rgba(239, 68, 68, 0.15)' : isWarn ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.15)';
        const badgeColor = isCrit ? 'var(--status-danger)' : isWarn ? '#eab308' : 'var(--status-success)';
        const labelText = isCrit ? 'Kritik (> 14 gün / Hiç)' : isWarn ? 'Uyarı (8-14 gün)' : 'Sağlıklı (≤ 7 gün)';
        return (
          <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '4px', background: badgeBg, color: badgeColor, fontWeight: 600 }}>
            {labelText}
          </span>
        );
      },
    },
    {
      key: 'page_verify_option',
      label: 'Sayfa Doğrulama Modu',
      sortable: true,
      render: (item) => {
        const isChecksum = item.page_verify_option === 'CHECKSUM';
        return (
          <span style={{ color: isChecksum ? 'var(--status-success)' : 'var(--status-danger)', fontWeight: 600 }}>
            {item.page_verify_option} {!isChecksum && '(Riskli!)'}
          </span>
        );
      },
    },
    {
      key: 'integrity_check_sql',
      label: 'İşlem',
      render: (item) => (
        <button
          className={styles.actionBtn}
          onClick={() => setSelectedCheckdbSql({ dbName: item.database_name, sql: item.integrity_check_sql })}
        >
          <Code2 size={13} /> CHECKDB Betiği
        </button>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <PageHeader
        title="Yedekleme ve Bütünlük (Backup & Integrity)"
        subtitle="Veritabanı yedekleme geçmişi, RPO kurtarma hazırlığı ve DBCC CHECKDB bütünlük doğrulaması"
      />

      {/* Tabs */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'history' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <History size={16} /> Yedekleme Geçmişi ({history.length})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'readiness' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('readiness')}
        >
          <HeartPulse size={16} /> Kurtarma Hazırlığı (RPO / RTO) ({readiness.length})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'integrity' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('integrity')}
        >
          <ShieldCheck size={16} /> Veritabanı Bütünlüğü &amp; DBCC CHECKDB ({integrityList.length})
        </button>
      </div>

      {/* Tab 1: Backup History */}
      {activeTab === 'history' && (
        <>
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
              columns={historyColumns}
              data={history}
              emptyMessage="Yedek kaydı bulunamadı."
            />
          )}
        </>
      )}

      {/* Tab 2: Recovery Readiness */}
      {activeTab === 'readiness' && (
        <section>
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
                    <span>{formatAge(item.full_backup_age_hours, item.last_full_backup)}</span>
                  </div>
                  {item.recovery_model === 'FULL' && (
                    <div className={styles.detailRow}>
                      <span>Son Log Yedeği:</span>
                      <span>{formatAge(item.log_backup_age_hours, item.last_log_backup)}</span>
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

      {/* Tab 3: Database Integrity & DBCC CHECKDB */}
      {activeTab === 'integrity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className={styles.alertBox}>
            <ShieldCheck size={20} style={{ color: 'var(--accent-blue)', display: 'inline', marginRight: '8px', verticalAlign: '-3px' }} />
            <strong>DBCC CHECKDB Bütünlük Kuralı:</strong> Bozuk (corrupted) bir veritabanının yedeği de bozuktur. Kurumsal DBA standartları ve ISO/KVKK denetimleri gereği veritabanlarında en az haftada bir kez DBCC CHECKDB başarıyla tamamlanmış olmalıdır.
          </div>

          <DataTable
            columns={integrityColumns}
            data={integrityList}
            emptyMessage="Bütünlük kontrolü verisi bulunamadı."
          />
        </div>
      )}

      {/* T-SQL Review Modal */}
      {selectedCheckdbSql && (
        <div className={styles.modalOverlay} onClick={() => setSelectedCheckdbSql(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3>DBCC CHECKDB Bütünlük Doğrulama Komutu</h3>
                <p>
                  <strong>{selectedCheckdbSql.dbName}</strong> veritabanı için önerilen T-SQL kodu:
                </p>
              </div>
              <button className={styles.closeBtn} onClick={() => setSelectedCheckdbSql(null)}>✕</button>
            </div>

            <div className={styles.sqlCodeBox}>
              <pre>{selectedCheckdbSql.sql}</pre>
            </div>

            <div className={styles.modalFooter}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                * Güvenlik prensibi: CHECKDB yoğun I/O oluşturabileceğinden iş saatleri dışında SSMS üzerinden çalıştırılmalıdır.
              </span>
              <button
                className={styles.copyBtn}
                onClick={() => handleCopy(selectedCheckdbSql.sql)}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Kopyalandı!' : 'Kodu Kopyala'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
