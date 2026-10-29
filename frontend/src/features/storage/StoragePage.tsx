import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Database,
  FileText,
  AlertTriangle,
  CheckCircle,
  Copy,
  Check,
  Search,
  Activity,
  Calendar,
  TrendingUp,
  Layers,
  Code2,
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import DataTable, { type Column } from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';
import DemoDataBanner from '../../components/ui/DemoDataBanner';
import { getStorageSummary } from '../../lib/api';
import type {
  StorageSummary,
  DatabaseFile,
  LogSpaceUsage,
  AutogrowthEvent,
  FileIOLatency,
  DriveIOSummary,
  DatabaseGrowthForecast,
  DatabaseVLFInfo,
} from '../../lib/types';
import styles from './StoragePage.module.css';

const LOG_REUSE_EXPLANATIONS: Record<string, string> = {
  NOTHING: 'Log alanı şu an yeniden kullanılabilir durumda. Aktif engel yok.',
  CHECKPOINT: 'Checkpoint bekleniyor (Simple Recovery modelinde normaldir).',
  LOG_BACKUP: 'Transaction Log yedeği alınması gerekiyor (Full Recovery modelinde zorunludur).',
  ACTIVE_TRANSACTION: 'Açık kalmış uzun bir transaction log alanının serbest kalmasını engelliyor.',
  ACTIVE_BACKUP_OR_RESTORE: 'Veritabanı yedeği veya geri yükleme işlemi devam ediyor.',
  DATABASE_MIRRORING: 'Mirroring / Veri aynalama replikasyon aktarımı bekleniyor.',
  AVAILABILITY_GROUP: 'Always On Availability Group ikincil replika senkronizasyonu bekleniyor.',
  REPLICATION: 'Snapshot veya Transactional Replication dağıtımı bekleniyor.',
  DATABASE_SNAPSHOT_CREATION: 'Veritabanı anlık görüntüsü (Snapshot) oluşturuluyor.',
};

export default function StoragePage() {
  const [summary, setSummary] = useState<StorageSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'files' | 'io' | 'logs' | 'trace' | 'growth' | 'vlfs'>('files');
  const [search, setSearch] = useState<string>('');
  const [selectedFileForSql, setSelectedFileForSql] = useState<DatabaseFile | null>(null);
  const [selectedVlfForSql, setSelectedVlfForSql] = useState<DatabaseVLFInfo | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const data = await getStorageSummary();
        setSummary(data);
      } catch (err: any) {
        setError(err.message || 'Depolama bilgileri alınırken hata oluştu.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleCopySql = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredFiles = (summary?.files || []).filter((f) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      f.database_name.toLowerCase().includes(term) ||
      f.name.toLowerCase().includes(term) ||
      f.file_type.toLowerCase().includes(term) ||
      f.physical_name.toLowerCase().includes(term)
    );
  });

  const fileColumns: Column<DatabaseFile>[] = [
    {
      key: 'name',
      label: 'Dosya & Veritabanı',
      sortable: true,
      render: (f) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.name}</span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '4px',
                background: f.file_type === 'ROWS' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                color: f.file_type === 'ROWS' ? 'var(--accent-blue)' : '#eab308',
                fontWeight: 600,
              }}
            >
              {f.file_type}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {f.database_name} • <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{f.physical_name}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'size_mb',
      label: 'Toplam Boyut',
      sortable: true,
      render: (f) => (
        <span style={{ fontWeight: 600 }}>
          {f.size_mb >= 1024 ? `${(f.size_mb / 1024).toFixed(2)} GB` : `${f.size_mb.toFixed(1)} MB`}
        </span>
      ),
    },
    {
      key: 'free_percent',
      label: 'Doluluk Oranı',
      sortable: true,
      render: (f) => {
        const usedPct = 100 - f.free_percent;
        const barColor = usedPct > 90 ? 'var(--status-danger)' : usedPct > 75 ? 'var(--status-warning)' : 'var(--status-success)';
        return (
          <div style={{ minWidth: '130px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
              <span>{usedPct.toFixed(1)}% Dolu</span>
              <span style={{ color: 'var(--text-muted)' }}>{f.free_percent.toFixed(1)}% Boş</span>
            </div>
            <div className={styles.progressBarBg}>
              <div
                className={styles.progressBarFill}
                style={{ width: `${Math.min(100, usedPct)}%`, background: barColor }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: 'growth',
      label: 'Büyüme Ayarı (Autogrowth)',
      sortable: true,
      render: (f) => {
        if (f.is_percent_growth) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className={styles.dangerBadge}>
                <AlertTriangle size={12} /> {f.growth} (Yüzdesel Risk!)
              </span>
              <button
                className={styles.fixBtn}
                onClick={() => setSelectedFileForSql(f)}
                title="T-SQL Düzeltme Kodunu İncele"
              >
                Düzelt
              </button>
            </div>
          );
        }
        return <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{f.growth} (Sabit)</span>;
      },
    },
    {
      key: 'max_size',
      label: 'Maks. Boyut',
      sortable: true,
      render: (f) => <span style={{ color: 'var(--text-secondary)' }}>{f.max_size}</span>,
    },
  ];

  const logColumns: Column<LogSpaceUsage>[] = [
    {
      key: 'database_name',
      label: 'Veritabanı',
      sortable: true,
      render: (l) => <strong style={{ color: 'var(--text-primary)' }}>{l.database_name}</strong>,
    },
    {
      key: 'log_size_mb',
      label: 'Log Dosyası Boyutu',
      sortable: true,
      render: (l) => (
        <span>{l.log_size_mb >= 1024 ? `${(l.log_size_mb / 1024).toFixed(2)} GB` : `${l.log_size_mb.toFixed(1)} MB`}</span>
      ),
    },
    {
      key: 'log_space_used_percent',
      label: 'Log Doluluğu',
      sortable: true,
      render: (l) => {
        const barColor = l.log_space_used_percent > 85 ? 'var(--status-danger)' : l.log_space_used_percent > 65 ? 'var(--status-warning)' : 'var(--status-success)';
        return (
          <div style={{ minWidth: '140px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
              <span style={{ fontWeight: 600 }}>{l.log_space_used_percent.toFixed(1)}%</span>
            </div>
            <div className={styles.progressBarBg}>
              <div
                className={styles.progressBarFill}
                style={{ width: `${Math.min(100, l.log_space_used_percent)}%`, background: barColor }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: 'log_reuse_wait_desc',
      label: 'Log Boşaltma Beklemesi (log_reuse_wait)',
      sortable: true,
      render: (l) => {
        const isProblem = l.log_reuse_wait_desc !== 'NOTHING';
        const expl = LOG_REUSE_EXPLANATIONS[l.log_reuse_wait_desc] || l.log_reuse_wait_desc;
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: isProblem ? '#eab308' : 'var(--status-success)',
                }}
              >
                {l.log_reuse_wait_desc}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{expl}</div>
          </div>
        );
      },
    },
  ];

  const ioColumns: Column<FileIOLatency>[] = [
    {
      key: 'file_name',
      label: 'Dosya & Veritabanı',
      sortable: true,
      render: (item) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.file_name}</span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '4px',
                background: item.file_type === 'ROWS' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                color: item.file_type === 'ROWS' ? 'var(--accent-blue)' : '#eab308',
                fontWeight: 600,
              }}
            >
              {item.file_type}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
            {item.database_name} • {item.physical_name}
          </div>
        </div>
      ),
    },
    {
      key: 'drive_letter',
      label: 'Sürücü',
      sortable: true,
      render: (item) => (
        <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
          {item.drive_letter}
        </span>
      ),
    },
    {
      key: 'read_latency_ms',
      label: 'Okuma Gecikmesi',
      sortable: true,
      render: (item) => (
        <span style={{ fontWeight: 600, color: item.read_latency_ms > 20 ? 'var(--status-danger)' : 'var(--text-primary)' }}>
          {item.read_latency_ms.toFixed(1)} ms
        </span>
      ),
    },
    {
      key: 'write_latency_ms',
      label: 'Yazma Gecikmesi',
      sortable: true,
      render: (item) => (
        <span style={{ fontWeight: 600, color: item.write_latency_ms > 20 ? 'var(--status-danger)' : 'var(--text-primary)' }}>
          {item.write_latency_ms.toFixed(1)} ms
        </span>
      ),
    },
    {
      key: 'overall_latency_ms',
      label: 'Toplam Gecikme & Durum',
      sortable: true,
      render: (item) => {
        const isCrit = item.status === 'CRITICAL';
        const isWarn = item.status === 'WARNING';
        const isNorm = item.status === 'NORMAL';
        const badgeColor = isCrit ? 'var(--status-danger)' : isWarn ? '#eab308' : isNorm ? 'var(--accent-blue)' : 'var(--status-success)';
        const badgeBg = isCrit ? 'rgba(239, 68, 68, 0.15)' : isWarn ? 'rgba(234, 179, 8, 0.15)' : isNorm ? 'rgba(59, 130, 246, 0.15)' : 'rgba(34, 197, 94, 0.15)';
        const labelText = isCrit ? 'Kritik Darboğaz' : isWarn ? 'Yüksek Gecikme' : isNorm ? 'Normal' : 'Mükemmel';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '13px' }}>{item.overall_latency_ms.toFixed(1)} ms</span>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: badgeBg,
                color: badgeColor,
                fontWeight: 600,
              }}
            >
              {labelText}
            </span>
          </div>
        );
      },
    },
    {
      key: 'num_of_reads',
      label: 'İşlem Sayısı (Read / Write)',
      sortable: true,
      render: (item) => (
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {item.num_of_reads.toLocaleString()} okuma / {item.num_of_writes.toLocaleString()} yazma
        </span>
      ),
    },
    {
      key: 'io_stall_ms',
      label: 'Toplam Stall Süresi',
      sortable: true,
      render: (item) => (
        <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          {(item.io_stall_ms / 1000).toFixed(1)} sn
        </span>
      ),
    },
  ];

  const traceColumns: Column<AutogrowthEvent>[] = [
    {
      key: 'start_time',
      label: 'Zaman Damgası',
      sortable: true,
      render: (t) => (
        <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
          <Calendar size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
          {t.start_time}
        </span>
      ),
    },
    {
      key: 'database_name',
      label: 'Veritabanı',
      sortable: true,
      render: (t) => <strong>{t.database_name}</strong>,
    },
    {
      key: 'file_name',
      label: 'Dosya Adı & Türü',
      sortable: true,
      render: (t) => (
        <div>
          <span>{t.file_name}</span>
          <span
            style={{
              marginLeft: '8px',
              fontSize: '11px',
              padding: '1px 5px',
              borderRadius: '4px',
              background: t.file_type === 'Data' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(234, 179, 8, 0.15)',
              color: t.file_type === 'Data' ? 'var(--accent-blue)' : '#eab308',
            }}
          >
            {t.file_type}
          </span>
        </div>
      ),
    },
    {
      key: 'growth_mb',
      label: 'Büyüme Miktarı',
      sortable: true,
      render: (t) => <span style={{ fontWeight: 600 }}>+{t.growth_mb.toFixed(1)} MB</span>,
    },
    {
      key: 'duration_ms',
      label: 'Büyüme Süresi',
      sortable: true,
      render: (t) => {
        const isSlow = t.duration_ms > 1000;
        return (
          <span style={{ color: isSlow ? 'var(--status-danger)' : 'var(--text-secondary)', fontWeight: isSlow ? 600 : 400 }}>
            {t.duration_ms.toFixed(0)} ms {isSlow && '(Yavaş Disk I/O)'}
          </span>
        );
      },
    },
  ];

  const growthColumns: Column<DatabaseGrowthForecast>[] = [
    {
      key: 'database_name',
      label: 'Veritabanı & Durum',
      sortable: true,
      render: (g) => {
        const isCritical = g.status === 'CRITICAL_CAPACITY';
        const isRapid = g.status === 'RAPID_GROWTH';
        const isMod = g.status === 'MODERATE';
        const bg = isCritical
          ? 'rgba(239, 68, 68, 0.15)'
          : isRapid
          ? 'rgba(245, 158, 11, 0.15)'
          : isMod
          ? 'rgba(59, 130, 246, 0.15)'
          : 'rgba(34, 197, 94, 0.15)';
        const color = isCritical
          ? 'var(--status-danger)'
          : isRapid
          ? '#fbbf24'
          : isMod
          ? 'var(--accent-blue)'
          : 'var(--status-success)';
        const label = isCritical
          ? 'Kapasite Riski'
          : isRapid
          ? 'Hızlı Büyüme'
          : isMod
          ? 'Dengeli'
          : 'Sabit';

        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{g.database_name}</strong>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: bg,
                  color: color,
                }}
              >
                {label}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Sürücü {g.drive_letter} • Boş: {formatSize(g.drive_free_space_mb)}
            </div>
          </div>
        );
      },
    },
    {
      key: 'current_size_mb',
      label: 'Mevcut Boyut',
      sortable: true,
      render: (g) => <span style={{ fontWeight: 600 }}>{formatSize(g.current_size_mb)}</span>,
    },
    {
      key: 'growth_last_30_days_mb',
      label: 'Son 30 Gün Büyüme',
      sortable: true,
      render: (g) => (
        <div>
          <span style={{ fontWeight: 700, color: g.growth_last_30_days_mb > 0 ? 'var(--status-warning, #f59e0b)' : 'var(--text-muted)' }}>
            +{formatSize(g.growth_last_30_days_mb)}
          </span>
          {g.growth_percent_30_days > 0 && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
              (+{g.growth_percent_30_days.toFixed(1)}%)
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'daily_growth_mb',
      label: 'Günlük Büyüme Hızı',
      sortable: true,
      render: (g) => (
        <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          {g.daily_growth_mb >= 1024
            ? `${(g.daily_growth_mb / 1024).toFixed(2)} GB/gün`
            : `${g.daily_growth_mb.toFixed(1)} MB/gün`}
        </span>
      ),
    },
    {
      key: 'projected_size_90_days_mb',
      label: '90 Günlük Tahmin',
      sortable: true,
      render: (g) => (
        <span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>
          {formatSize(g.projected_size_90_days_mb)}
        </span>
      ),
    },
    {
      key: 'days_until_disk_full',
      label: 'Disk Dolum Süresi (Runway)',
      sortable: true,
      render: (g) => {
        if (g.days_until_disk_full === null || g.days_until_disk_full === undefined) {
          return <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>— (Sabit)</span>;
        }
        if (g.days_until_disk_full < 60) {
          return (
            <span className={styles.runwayBadgeCritical}>
              <AlertTriangle size={12} /> {g.days_until_disk_full} Gün Kaldı!
            </span>
          );
        }
        if (g.days_until_disk_full < 180) {
          return <span className={styles.runwayBadgeWarning}>{g.days_until_disk_full} Gün</span>;
        }
        return <span className={styles.runwayBadgeOk}>{g.days_until_disk_full} Gün</span>;
      },
    },
    {
      key: 'history_points',
      label: '90 Günlük Trend',
      render: (g) => {
        if (!g.history_points || g.history_points.length === 0) {
          return <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Veri yok</span>;
        }
        const maxVal = Math.max(...g.history_points.map((p) => p.size_mb), 1);
        return (
          <div className={styles.sparklineWrap} title="Geçmiş 90 günlük yedek boyutu trendi">
            {g.history_points.map((pt, idx) => {
              const hPct = Math.max(15, Math.round((pt.size_mb / maxVal) * 100));
              return (
                <div
                  key={idx}
                  className={styles.sparklineBar}
                  style={{ height: `${hPct}%` }}
                  title={`${pt.date}: ${formatSize(pt.size_mb)}`}
                />
              );
            })}
          </div>
        );
      },
    },
  ];

  const vlfColumns: Column<DatabaseVLFInfo>[] = [
    {
      key: 'database_name',
      label: 'Veritabanı',
      sortable: true,
      render: (v) => (
        <div>
          <strong style={{ color: '#ffffff' }}>{v.database_name}</strong>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Model: <span style={{ color: 'var(--accent)' }}>{v.recovery_model}</span> • Bekleme: <span style={{ color: '#f59e0b' }}>{v.log_reuse_wait_desc}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'vlf_count',
      label: 'Toplam VLF Sayısı',
      sortable: true,
      render: (v) => {
        const isCrit = v.status === 'CRITICAL';
        const isWarn = v.status === 'WARNING';
        const color = isCrit ? '#ef4444' : isWarn ? '#f59e0b' : 'var(--status-success)';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color }}>
              {v.vlf_count.toLocaleString()}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>VLF</span>
          </div>
        );
      },
    },
    {
      key: 'active_vlf_count',
      label: 'Aktif / İnaktif VLF',
      render: (v) => (
        <div style={{ fontSize: '12px' }}>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{v.active_vlf_count} Aktif</span>
          <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>/</span>
          <span style={{ color: 'var(--text-secondary)' }}>{v.inactive_vlf_count} İnaktif</span>
        </div>
      ),
    },
    {
      key: 'log_size_mb',
      label: 'Log / Ort. VLF Boyutu',
      sortable: true,
      render: (v) => (
        <div style={{ fontSize: '12px' }}>
          <strong style={{ color: '#ffffff' }}>
            {v.log_size_mb >= 1024 ? `${(v.log_size_mb / 1024).toFixed(1)} GB` : `${v.log_size_mb.toFixed(0)} MB`}
          </strong>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Ort: {v.avg_vlf_size_mb.toFixed(1)} MB / VLF
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Parçalanma Durumu',
      sortable: true,
      render: (v) => {
        const isCrit = v.status === 'CRITICAL';
        const isWarn = v.status === 'WARNING';
        return (
          <StatusBadge
            variant={isCrit ? 'error' : isWarn ? 'warning' : 'success'}
            label={isCrit ? 'Aşırı Parçalanma (>1.000 VLF)' : isWarn ? 'Orta Parçalanma (250-1.000 VLF)' : 'Sağlıklı (<250 VLF)'}
          />
        );
      },
    },
    {
      key: 'recommendation',
      label: 'Teşhis & Öneri',
      render: (v) => (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '380px' }}>
          {v.recommendation}
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'İşlem',
      render: (v) => (
        <button
          type="button"
          className={styles.copyBtn}
          style={{ padding: '4px 10px', fontSize: '11px', height: 'auto' }}
          onClick={() => setSelectedVlfForSql(v)}
        >
          <Code2 size={13} />
          Düzeltme Kodu
        </button>
      ),
    },
  ];

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  const formatSize = (mb: number) => {
    if (mb >= 1024 * 1024) return `${(mb / (1024 * 1024)).toFixed(2)} TB`;
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb.toFixed(0)} MB`;
  };

  return (
    <div className={styles.container}>
      <PageHeader
        title="Depolama & Dosyalar"
        subtitle="Veritabanı dosyaları (MDF/NDF/LDF), disk doluluk oranları, yüzdesel büyüme uyarıları ve Default Trace büyüme olayları."
      />

      {summary?.is_demo && <DemoDataBanner />}

      {/* Metric Cards */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricIconWrap} style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)' }}>
            <Database size={22} />
          </div>
          <div>
            <div className={styles.metricLabel}>Toplam Veri Boyutu (Data)</div>
            <div className={styles.metricValue}>{formatSize(summary?.total_data_size_mb || 0)}</div>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricIconWrap} style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}>
            <FileText size={22} />
          </div>
          <div>
            <div className={styles.metricLabel}>Toplam Log Boyutu (LDF)</div>
            <div className={styles.metricValue}>{formatSize(summary?.total_log_size_mb || 0)}</div>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricIconWrap} style={{ background: 'rgba(34, 197, 94, 0.15)', color: 'var(--status-success)' }}>
            <CheckCircle size={22} />
          </div>
          <div>
            <div className={styles.metricLabel}>Tahmini Boş Alan</div>
            <div className={styles.metricValue}>{formatSize(summary?.total_free_space_mb || 0)}</div>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div
            className={styles.metricIconWrap}
            style={{
              background: (summary?.files_with_percent_growth_count || 0) > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
              color: (summary?.files_with_percent_growth_count || 0) > 0 ? 'var(--status-danger)' : 'var(--status-success)',
            }}
          >
            <AlertTriangle size={22} />
          </div>
          <div>
            <div className={styles.metricLabel}>Yüzdesel Büyüme (Riskli)</div>
            <div className={styles.metricValue} style={{ color: (summary?.files_with_percent_growth_count || 0) > 0 ? 'var(--status-danger)' : 'inherit' }}>
              {summary?.files_with_percent_growth_count || 0} Dosya
            </div>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div
            className={styles.metricIconWrap}
            style={{
              background: (summary?.critical_vlf_dbs_count || 0) > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
              color: (summary?.critical_vlf_dbs_count || 0) > 0 ? 'var(--status-danger)' : 'var(--status-success)',
            }}
          >
            <Layers size={22} />
          </div>
          <div>
            <div className={styles.metricLabel}>Kritik VLF Parçalanması</div>
            <div className={styles.metricValue} style={{ color: (summary?.critical_vlf_dbs_count || 0) > 0 ? 'var(--status-danger)' : 'inherit' }}>
              {summary?.critical_vlf_dbs_count || 0} Veritabanı
            </div>
          </div>
        </div>
      </div>

      {/* Warning Alert if Percent Growth Exists */}
      {(summary?.files_with_percent_growth_count || 0) > 0 && (
        <div className={styles.alertBanner}>
          <AlertTriangle size={20} className={styles.alertIcon} />
          <div>
            <strong>Yüzdesel Otomatik Büyüme (Percent Autogrowth) Uyarısı:</strong> Sistemde yüzdesel büyüyen dosyalar bulundu.
            Veritabanı boyutu büyüdükçe (örn. 500GB olduğunda %10 büyüme tek seferde 50GB tahsis etmeye çalışır) disk ani kilitlenmelere ve sorgu zaman aşımlarına yol açar.
            SQL Server best practice olarak sabit MB (örn. 512MB veya 1024MB) ile büyütülmelidir.
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'files' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('files')}
        >
          <HardDrive size={16} /> Veritabanı Dosyaları ({summary?.files?.length || 0})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'io' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('io')}
        >
          <Activity size={16} /> Disk I/O Gecikmesi ({summary?.file_io_latencies?.length || 0})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'growth' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('growth')}
        >
          <TrendingUp size={16} /> Kapasite & Büyüme Trendi ({summary?.growth_forecasts?.length || 0})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'logs' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          <Activity size={16} /> Transaction Log Doluluğu ({summary?.log_spaces?.length || 0})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'trace' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('trace')}
        >
          <Calendar size={16} /> Default Trace Büyüme Geçmişi ({summary?.autogrowth_events?.length || 0})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'vlfs' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('vlfs')}
        >
          <Layers size={16} /> Sanal Log (VLF) Sağlığı ({summary?.vlf_infos?.length || 0})
        </button>
      </div>

      {/* Tab 1: Files */}
      {activeTab === 'files' && (
        <div className={styles.tableCard}>
          <div className={styles.filterBar}>
            <div className={styles.searchWrap}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Veritabanı veya dosya adına göre ara..."
                className={styles.searchInput}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <DataTable
            data={filteredFiles}
            columns={fileColumns}
            emptyMessage="Eşleşen dosya bulunamadı."
          />
        </div>
      )}

      {/* Tab: Disk I/O Latency */}
      {activeTab === 'io' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Drive Summary Cards */}
          <div className={styles.driveGrid}>
            {(summary?.drive_io_summaries || []).map((d) => {
              const isCrit = d.status === 'CRITICAL';
              const isWarn = d.status === 'WARNING';
              const cardBorder = isCrit ? 'rgba(239, 68, 68, 0.4)' : isWarn ? 'rgba(234, 179, 8, 0.4)' : 'var(--border-card)';
              return (
                <div key={d.drive_letter} className={styles.driveCard} style={{ borderColor: cardBorder }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {d.drive_letter} Sürücüsü
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: isCrit ? 'rgba(239, 68, 68, 0.15)' : isWarn ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                        color: isCrit ? 'var(--status-danger)' : isWarn ? '#eab308' : 'var(--status-success)',
                        fontWeight: 600,
                      }}
                    >
                      {d.status === 'CRITICAL' ? 'I/O Darboğazı' : d.status === 'WARNING' ? 'Yüksek Gecikme' : d.status === 'NORMAL' ? 'Normal' : 'Mükemmel'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ort. Okuma</div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: d.avg_read_latency_ms > 20 ? 'var(--status-danger)' : 'var(--text-primary)' }}>
                        {d.avg_read_latency_ms.toFixed(1)} ms
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ort. Yazma</div>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: d.avg_write_latency_ms > 20 ? 'var(--status-danger)' : 'var(--text-primary)' }}>
                        {d.avg_write_latency_ms.toFixed(1)} ms
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    {d.file_count} dosya • {((d.total_reads + d.total_writes)).toLocaleString()} toplam I/O
                  </div>
                </div>
              );
            })}
          </div>

          {/* Latency Threshold Guide */}
          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-surface)', padding: '10px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <span><strong>Gecikme Eşikleri:</strong></span>
            <span style={{ color: 'var(--status-success)' }}>● &lt;5 ms: Mükemmel (SSD / NVMe)</span>
            <span style={{ color: 'var(--accent-blue)' }}>● 5-15 ms: Normal</span>
            <span style={{ color: '#eab308' }}>● 15-25 ms: Yüksek Gecikme</span>
            <span style={{ color: 'var(--status-danger)' }}>● &gt;25 ms: Kritik I/O Darboğazı</span>
          </div>

          <div className={styles.tableCard}>
            <DataTable
              data={summary?.file_io_latencies || []}
              columns={ioColumns}
              emptyMessage="Disk I/O gecikme bilgisi bulunamadı."
            />
          </div>
        </div>
      )}

      {/* Tab 2: Logs */}
      {activeTab === 'logs' && (
        <div className={styles.tableCard}>
          <DataTable
            data={summary?.log_spaces || []}
            columns={logColumns}
            emptyMessage="Transaction Log bilgisi bulunamadı."
          />
        </div>
      )}

      {/* Tab 3: Trace Events */}
      {activeTab === 'trace' && (
        <div className={styles.tableCard}>
          <DataTable
            data={summary?.autogrowth_events || []}
            columns={traceColumns}
            emptyMessage="Default Trace üzerinde kayıtlı büyüme olayı bulunamadı."
          />
        </div>
      )}

      {/* Tab 4: Growth Trends & Capacity Forecasting */}
      {activeTab === 'growth' && (
        <div>
          {/* Summary KPIs */}
          <div className={styles.growthSummaryGrid}>
            <div className={styles.growthStatCard}>
              <div className={styles.growthStatVal} style={{ color: 'var(--accent-blue)' }}>
                {summary?.fastest_growing_db || '—'}
              </div>
              <div className={styles.growthStatLbl}>En Hızlı Büyüyen Veritabanı</div>
            </div>

            <div className={styles.growthStatCard}>
              <div className={styles.growthStatVal} style={{ color: '#fbbf24' }}>
                +{formatSize(summary?.total_30_day_growth_mb || 0)}
              </div>
              <div className={styles.growthStatLbl}>Son 30 Gün Toplam Büyüme</div>
            </div>

            <div className={styles.growthStatCard}>
              <div
                className={styles.growthStatVal}
                style={{
                  color:
                    summary?.min_disk_runway_days && summary.min_disk_runway_days < 60
                      ? 'var(--status-danger)'
                      : 'var(--status-success)',
                }}
              >
                {summary?.min_disk_runway_days ? `${summary.min_disk_runway_days} Gün` : 'Geniş Kapasite'}
              </div>
              <div className={styles.growthStatLbl}>Kritik Disk Dolum Süresi (En Düşük Runway)</div>
            </div>

            <div className={styles.growthStatCard}>
              <div
                className={styles.growthStatVal}
                style={{
                  color:
                    (summary?.growth_forecasts?.filter((g) => g.status === 'CRITICAL_CAPACITY').length || 0) > 0
                      ? 'var(--status-danger)'
                      : 'var(--status-success)',
                }}
              >
                {summary?.growth_forecasts?.filter((g) => g.status === 'CRITICAL_CAPACITY').length || 0} Veritabanı
              </div>
              <div className={styles.growthStatLbl}>Kapasite Riski Taşıyan Diskler</div>
            </div>
          </div>

          {/* Critical Capacity Warning if < 60 days */}
          {summary?.min_disk_runway_days && summary.min_disk_runway_days < 60 && (
            <div className={styles.alertBanner} style={{ marginBottom: '16px' }}>
              <AlertTriangle size={20} className={styles.alertIcon} />
              <div>
                <strong>Kritik Disk Kapasite Uyarısı:</strong> Mevcut veritabanı büyüme ivmesiyle en kritik disk alanının{' '}
                <strong>{summary.min_disk_runway_days} gün</strong> içerisinde dolacağı tahmin edilmektedir.
                Üretim kesintisi yaşamamak için disk alanı tahsisini genişletiniz veya eski verileri arşivleyiniz.
              </div>
            </div>
          )}

          <div className={styles.tableCard}>
            <DataTable
              data={summary?.growth_forecasts || []}
              columns={growthColumns}
              emptyMessage="Veritabanı büyüme tahmini bulunamadı."
            />
          </div>
        </div>
      )}

      {/* Tab 6: VLFs */}
      {activeTab === 'vlfs' && (
        <div>
          <div className={styles.alertBanner} style={{ marginBottom: '16px', background: 'rgba(0, 210, 255, 0.05)', borderColor: 'rgba(0, 210, 255, 0.2)' }}>
            <Layers size={20} className={styles.alertIcon} style={{ color: 'var(--accent)' }} />
            <div>
              <strong>Sanal Log Dosyaları (VLF) ve Transaction Log Mimarisi:</strong> SQL Server'da Transaction Log dosyası (LDF) dahili olarak VLF birimlerine ayrılır. Log dosyası sık ve küçük artışlarla otomatik büyüdüğünde binlerce küçük VLF oluşur. Yüksek VLF sayısı (&gt;1.000 VLF) sunucu yeniden başlatmalarında (Crash Recovery), Always On failover senkronizasyonunda ve log yedeklerinde ciddi gecikmelere sebep olur.
            </div>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.filterBar}>
              <div className={styles.searchWrap}>
                <Search size={16} className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Veritabanı adına göre ara..."
                  className={styles.searchInput}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <DataTable
              data={(summary?.vlf_infos || []).filter((v) => !search || v.database_name.toLowerCase().includes(search.toLowerCase()))}
              columns={vlfColumns}
              emptyMessage="VLF bilgisi bulunamadı."
            />
          </div>
        </div>
      )}

      {/* T-SQL Review Modal */}
      {selectedFileForSql && (
        <div className={styles.modalOverlay} onClick={() => setSelectedFileForSql(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3>Sabit Büyümeye Geçiş T-SQL Kodu</h3>
                <p>
                  <strong>{selectedFileForSql.database_name}</strong> veritabanındaki{' '}
                  <strong>{selectedFileForSql.name}</strong> dosyası için önerilen güvenli T-SQL:
                </p>
              </div>
              <button className={styles.closeBtn} onClick={() => setSelectedFileForSql(null)}>✕</button>
            </div>

            <div className={styles.sqlCodeBox}>
              <pre>{selectedFileForSql.growth_recommendation_sql}</pre>
            </div>

            <div className={styles.modalFooter}>
              <span className={styles.reviewNotice}>
                * Güvenlik ilkesi: Bu komut otomatik çalıştırılmaz. İnceleyip SSMS üzerinde yürütebilirsiniz.
              </span>
              <button
                className={styles.copyBtn}
                onClick={() => handleCopySql(selectedFileForSql.growth_recommendation_sql || '')}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Kopyalandı!' : 'Kodu Kopyala'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VLF Remediation Modal */}
      {selectedVlfForSql && (
        <div className={styles.modalOverlay} onClick={() => setSelectedVlfForSql(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3>VLF Parçalanmasını Düzeltme & Yeniden Boyutlandırma</h3>
                <p>
                  <strong>{selectedVlfForSql.database_name}</strong> veritabanı ({selectedVlfForSql.vlf_count} VLF) için önerilen güvenli T-SQL:
                </p>
              </div>
              <button className={styles.closeBtn} onClick={() => setSelectedVlfForSql(null)}>✕</button>
            </div>

            <div className={styles.sqlCodeBox}>
              <pre>{selectedVlfForSql.remediation_script}</pre>
            </div>

            <div className={styles.modalFooter}>
              <span className={styles.reviewNotice}>
                * Güvenlik ilkesi: Datapath otomatik küçültme yapmaz. Betiği DBA gözetiminde SSMS üzerinde uygulayınız.
              </span>
              <button
                className={styles.copyBtn}
                onClick={() => handleCopySql(selectedVlfForSql.remediation_script || '')}
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
