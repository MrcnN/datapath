import React, { useState, useEffect } from 'react';
import {
  Activity,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Server,
  Zap,
  ArrowRight,
  FileCode,
  Copy,
  Check,
  Database,
  Radio,
} from 'lucide-react';
import { getAGLagTelemetry } from '../../../lib/api';
import type { AGLagAnalysisResponse, AGTelemetrySummary, AGReplicaLagMetric } from '../../../lib/types';
import DataTable, { type Column } from '../../../components/ui/DataTable';
import styles from './AGLagTelemetryViewer.module.css';

export default function AGLagTelemetryViewer() {
  const [data, setData] = useState<AGLagAnalysisResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAGLagTelemetry();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'AlwaysOn gecikme ve telemetri verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCopy = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          AlwaysOn Replikasyon Gecikmesi &amp; RPO/RTO Telemetrisi taranıyor...
        </div>
      </div>
    );
  }

  if (error || !data || data.groups.length === 0) {
    return null;
  }

  const group = data.groups[0];

  const columns: Column<AGReplicaLagMetric>[] = [
    {
      key: 'replica_name',
      label: 'Replika Sunucu',
      render: (m) => (
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{m.replica_name}</div>
          <div style={{ fontSize: '11px', color: m.role === 'PRIMARY' ? 'var(--accent)' : 'var(--text-muted)' }}>
            {m.role === 'PRIMARY' ? 'BİRİNCİL (PRIMARY)' : 'İKİNCİL (SECONDARY)'}
          </div>
        </div>
      ),
    },
    {
      key: 'database_name',
      label: 'Veritabanı',
      render: (m) => <strong>{m.database_name}</strong>,
    },
    {
      key: 'availability_mode',
      label: 'Replikasyon Modu',
      render: (m) => (
        <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
          {m.availability_mode === 'SYNCHRONOUS_COMMIT' ? 'Senkron (Sync)' : 'Asenkron (Async)'}
        </span>
      ),
    },
    {
      key: 'log_send_queue_size_kb',
      label: 'Log Gönderim Kuyruğu',
      sortable: true,
      render: (m) => {
        const mb = m.log_send_queue_size_kb / 1024.0;
        return (
          <div>
            <span
              style={{
                fontFamily: 'monospace',
                fontWeight: 600,
                color: mb > 20 ? '#ef4444' : mb > 0 ? '#f59e0b' : '#10b981',
              }}
            >
              {mb.toFixed(1)} MB
            </span>
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
              {m.log_send_rate_kb_sec > 0 ? `${(m.log_send_rate_kb_sec / 1024).toFixed(1)} MB/sn` : '—'}
            </div>
          </div>
        );
      },
    },
    {
      key: 'redo_queue_size_kb',
      label: 'Redo Kuyruğu (İşleme)',
      sortable: true,
      render: (m) => {
        const mb = m.redo_queue_size_kb / 1024.0;
        return (
          <div>
            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: mb > 20 ? '#f59e0b' : 'inherit' }}>
              {mb.toFixed(1)} MB
            </span>
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
              {m.redo_rate_kb_sec > 0 ? `${(m.redo_rate_kb_sec / 1024).toFixed(1)} MB/sn` : '—'}
            </div>
          </div>
        );
      },
    },
    {
      key: 'estimated_data_loss_sec',
      label: 'Veri Kaybı Riski (RPO)',
      sortable: true,
      render: (m) => {
        if (m.role === 'PRIMARY') return <span style={{ color: 'var(--text-muted)' }}>—</span>;
        const rpo = m.estimated_data_loss_sec;
        return (
          <span
            style={{
              fontFamily: 'monospace',
              fontWeight: 700,
              color: rpo > 10 ? '#ef4444' : rpo > 0 ? '#f59e0b' : '#10b981',
            }}
          >
            {rpo === 0 ? '0.0s (Sıfır Kayıp ✓)' : `${rpo.toFixed(1)} saniye`}
          </span>
        );
      },
    },
    {
      key: 'failover_readiness',
      label: 'Failover Hazırlığı',
      render: (m) => {
        if (m.role === 'PRIMARY') return <span style={{ color: 'var(--text-muted)' }}>Aktif Birincil</span>;
        const isReady = m.failover_readiness === 'READY_NO_DATA_LOSS';
        const isWarn = m.failover_readiness === 'POTENTIAL_DATA_LOSS';
        return (
          <span
            className={`${styles.readyBadge} ${
              isReady ? styles.readySuccess : isWarn ? styles.readyWarning : styles.readyDanger
            }`}
          >
            {isReady
              ? 'Planlı Geçişe Hazır (0 Kayıp)'
              : isWarn
              ? 'Asenkron Kuyruk (RPO Riski)'
              : 'Askıda (Geçiş Yapılamaz)'}
          </span>
        );
      },
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <Radio className={styles.titleIcon} size={20} />
          <div>
            <h3 className={styles.title}>AlwaysOn Replikasyon Gecikmesi &amp; RPO/RTO Telemetrisi</h3>
            <p className={styles.subtitle}>
              sys.dm_hadr_database_replica_states üzerinden birincil ve ikincil replikalar arasındaki log kuyruğu, ağ aktarım hızı ve ani kaza anındaki veri kaybı süresi (RPO) hesaplanır.
            </p>
          </div>
        </div>

        <div>
          <span
            className={`${styles.healthBadge} ${
              group.overall_health === 'OPTIMAL'
                ? styles.healthOptimal
                : group.overall_health === 'LAG_WARNING'
                ? styles.healthWarning
                : styles.healthCritical
            }`}
          >
            {group.overall_health === 'OPTIMAL'
              ? 'Replikasyon Sağlıklı ✓'
              : group.overall_health === 'LAG_WARNING'
              ? 'Kuyruk / Gecikme Uyarısı!'
              : 'Kritik Senkronizasyon Kaybı!'}
          </span>
        </div>
      </div>

      {/* Warning Box */}
      {group.warnings.length > 0 && (
        <div className={styles.warningBox}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            {group.warnings.map((w, idx) => (
              <div key={idx} style={{ marginBottom: idx < group.warnings.length - 1 ? '4px' : '0' }}>
                • {w}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Executive KPI Grid */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Maksimum Veri Kaybı Açığı (RPO)</span>
          <span className={styles.kpiVal} style={{ color: group.max_rpo_seconds > 10 ? '#ef4444' : '#10b981' }}>
            ~{group.max_rpo_seconds.toFixed(1)} Saniye
          </span>
          <span className={styles.kpiSub}>Birincil çökerse kaybedilecek veri</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Toplam Bekleyen Log Kuyruğu</span>
          <span className={styles.kpiVal} style={{ color: group.total_log_send_queue_mb > 50 ? '#f59e0b' : '#ffffff' }}>
            {group.total_log_send_queue_mb.toFixed(1)} MB
          </span>
          <span className={styles.kpiSub}>Ağ hattında aktarım bekleyen loglar</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Redo Kuyruğu (İşleme Süresi / RTO)</span>
          <span className={styles.kpiVal}>{group.total_redo_queue_mb.toFixed(1)} MB (~{group.max_rto_seconds.toFixed(1)}s)</span>
          <span className={styles.kpiSub}>İkincilde diske yazılmayı bekleyen log</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Kullanılabilirlik Grubu</span>
          <span className={styles.kpiVal} style={{ fontSize: '15px' }}>{group.ag_name}</span>
          <span className={styles.kpiSub}>Birincil Düğüm: {group.primary_replica}</span>
        </div>
      </div>

      {/* Replica Telemetry Table */}
      <div style={{ marginTop: 'var(--space-2)' }}>
        <DataTable
          columns={columns}
          data={group.replica_metrics}
          emptyMessage="Replika telemetrisi bulunamadı."
        />
      </div>

      {/* Failover Script */}
      {group.remediation_sql && (
        <div className={styles.scriptCard}>
          <div className={styles.scriptHeader}>
            <div className={styles.scriptTitle}>
              <FileCode size={14} color="var(--accent)" />
              [Review-Only] AlwaysOn Kontrollü Failover (Yük Devretme) T-SQL Reçetesi
            </div>
            <button className={styles.copyBtn} onClick={() => handleCopy(group.remediation_sql)}>
              {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              {copied ? 'Kopyalandı!' : 'T-SQL Betiğini Kopyala'}
            </button>
          </div>
          <pre className={styles.codeArea}>{group.remediation_sql}</pre>
        </div>
      )}
    </div>
  );
}
