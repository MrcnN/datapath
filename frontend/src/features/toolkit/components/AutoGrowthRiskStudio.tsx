import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Sliders,
  ShieldAlert,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  FileCode,
  Terminal,
  Zap,
  Search,
  Database,
  Info,
} from 'lucide-react';
import DataTable, { type Column } from '../../../components/ui/DataTable';
import CodeBlock from '../../../components/ui/CodeBlock';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';
import { getAutoGrowthAuditAnalysis } from '../../../lib/api';
import type { AutoGrowthAuditResponse, DatabaseFileGrowthRiskItem } from '../../../lib/types';
import styles from './AutoGrowthRiskStudio.module.css';

export default function AutoGrowthRiskStudio() {
  const [data, setData] = useState<AutoGrowthAuditResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [showRunbook, setShowRunbook] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAutoGrowthAuditAnalysis();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Auto-growth risk denetimi alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !data) {
    return <LoadingSpinner message="Veritabanı dosyaları (sys.master_files) otomatik büyüme ve shrink ayarları taranıyor..." />;
  }

  if (error && !data) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  const summary = data?.summary;
  const items = data?.items || [];

  const filteredItems = items.filter((item) => {
    if (riskFilter !== 'ALL' && item.risk_level !== riskFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      item.database_name.toLowerCase().includes(s) ||
      item.logical_name.toLowerCase().includes(s) ||
      item.risk_reason.toLowerCase().includes(s)
    );
  });

  const columns: Column<DatabaseFileGrowthRiskItem>[] = [
    {
      key: 'database_name',
      label: 'Veritabanı / Dosya',
      render: (item) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {item.database_name}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {item.logical_name} ({item.file_type})
          </div>
        </div>
      ),
    },
    {
      key: 'current_size_mb',
      label: 'Mevcut Boyut',
      sortable: true,
      render: (item) => (
        <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>
          {item.current_size_mb >= 1024
            ? `${(item.current_size_mb / 1024).toFixed(2)} GB`
            : `${item.current_size_mb.toFixed(0)} MB`}
        </span>
      ),
    },
    {
      key: 'growth_setting',
      label: 'Büyüme Ayarı',
      render: (item) => (
        <div>
          <span style={{ fontWeight: 600, color: item.is_percent_growth ? '#f59e0b' : 'var(--text-primary)' }}>
            {item.growth_setting}
          </span>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Tek seferde: ~{item.effective_growth_mb >= 1024 ? `${(item.effective_growth_mb / 1024).toFixed(1)} GB` : `${item.effective_growth_mb.toFixed(0)} MB`}
          </div>
        </div>
      ),
    },
    {
      key: 'risk_level',
      label: 'Risk Seviyesi',
      sortable: true,
      render: (item) => {
        const cls =
          item.risk_level === 'CRITICAL'
            ? styles.badgeCritical
            : item.risk_level === 'HIGH'
            ? styles.badgeHigh
            : item.risk_level === 'WARNING'
            ? styles.badgeWarning
            : styles.badgeHealthy;

        return <span className={cls}>{item.risk_level}</span>;
      },
    },
    {
      key: 'risk_reason',
      label: 'Risk Açıklaması & Kök Neden',
      render: (item) => (
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          {item.risk_reason}
        </span>
      ),
    },
  ];

  return (
    <div className={styles.studio}>
      {/* 1. Header Card */}
      <div className={styles.headerCard}>
        <div className={styles.titleArea}>
          <div className={styles.titleRow}>
            <Sliders size={20} color="var(--primary-color, #2563eb)" />
            <h3 className={styles.title}>Otomatik Büyüme (Auto-Growth) &amp; Auto-Shrink Risk Denetim Stüdyosu</h3>
            <span className={styles.badgeLive}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              Live Master Files
            </span>
          </div>
          <p className={styles.subtitle}>
            Veritabanı veri ve log dosyalarının büyüme artışlarını, performans kırıcı AUTO_SHRINK/AUTO_CLOSE parametrelerini ve Instant File Initialization (IFI) uyumunu denetler.
          </p>
        </div>

        <div className={styles.actionsArea}>
          <button className={styles.btnSecondary} onClick={() => setShowRunbook(!showRunbook)}>
            <FileCode size={14} />
            {showRunbook ? 'Reçeteyi Gizle' : 'Toplu İyileştirme Reçetesi (T-SQL)'}
          </button>
          <button className={styles.btnSecondary} onClick={fetchData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Yenile
          </button>
        </div>
      </div>

      {/* 2. Diagnostic Verdict Banner */}
      {summary && (
        <div
          className={`${styles.verdictBanner} ${
            summary.overall_health === 'CRITICAL'
              ? styles.verdictCritical
              : summary.overall_health === 'WARNING'
              ? styles.verdictWarning
              : styles.verdictHealthy
          }`}
        >
          {summary.overall_health === 'CRITICAL' ? (
            <AlertOctagon size={20} style={{ flexShrink: 0 }} />
          ) : summary.overall_health === 'WARNING' ? (
            <AlertTriangle size={20} style={{ flexShrink: 0 }} />
          ) : (
            <CheckCircle2 size={20} style={{ flexShrink: 0 }} />
          )}
          <span>
            {summary.overall_health === 'CRITICAL'
              ? `Kritik Büyüme Riski: ${summary.critical_risk_files} dosyada yıkıcı büyüme konfigürasyonu (AUTO_SHRINK veya ≤8MB artış) tespit edildi!`
              : summary.overall_health === 'WARNING'
              ? `Uyarı: ${summary.percent_growth_files} dosyada yüzdesel büyüme (%10 gibi) veya düşük artış tespit edildi; zaman aşımı riski mevcut.`
              : 'Tüm veritabanı dosyaları sağlıklı sabit boyutlu artış değerlerine sahip.'}
          </span>
        </div>
      )}

      {/* 3. KPI Summary Cards */}
      {summary && (
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span>Denetlenen Dosya Sayısı</span>
              <HardDrive size={16} color="var(--primary-color, #2563eb)" />
            </div>
            <div className={styles.kpiValue}>
              {summary.total_files_audited}
              <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)' }}>Dosya</span>
            </div>
            <div className={styles.kpiFooter}>
              Kullanıcı veritabanı dosyaları
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span>Kritik Riskli Dosyalar</span>
              <AlertOctagon size={16} color={summary.critical_risk_files > 0 ? '#ef4444' : '#10b981'} />
            </div>
            <div
              className={styles.kpiValue}
              style={{ color: summary.critical_risk_files > 0 ? '#ef4444' : '#10b981' }}
            >
              {summary.critical_risk_files}
            </div>
            <div className={styles.kpiFooter}>
              {summary.auto_shrink_databases} veritabanında AUTO_SHRINK aktif
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span>Yüzdesel Büyüme (Riskli)</span>
              <Sliders size={16} color={summary.percent_growth_files > 0 ? '#f59e0b' : '#10b981'} />
            </div>
            <div
              className={styles.kpiValue}
              style={{ color: summary.percent_growth_files > 0 ? '#f59e0b' : 'var(--text-primary)' }}
            >
              {summary.percent_growth_files}
            </div>
            <div className={styles.kpiFooter}>
              Örn: %10 büyüme (Sabit MB olmalı)
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span>Anında Dosya Başlatma (IFI)</span>
              <Zap size={16} color={summary.instant_file_initialization_enabled ? '#10b981' : '#f59e0b'} />
            </div>
            <div
              className={styles.kpiValue}
              style={{ fontSize: '1.05rem', color: summary.instant_file_initialization_enabled ? '#10b981' : '#f59e0b' }}
            >
              {summary.instant_file_initialization_enabled ? 'Etkin (Zero-Latency)' : 'Devre Dışı'}
            </div>
            <div className={styles.kpiFooter}>
              SE_MANAGE_VOLUME_NAME ayrılma hızı
            </div>
          </div>
        </div>
      )}

      {/* 4. Filter and DataTable */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Risk Filtresi:</span>
            <select
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '4px 8px',
                fontSize: '0.8rem',
                color: 'var(--text-primary)',
              }}
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
            >
              <option value="ALL">Tümü ({items.length})</option>
              <option value="CRITICAL">Kritik Risk</option>
              <option value="HIGH">Yüksek Risk</option>
              <option value="WARNING">Uyarı</option>
              <option value="HEALTHY">Sağlıklı</option>
            </select>
          </div>

          <div style={{ position: 'relative', width: 280 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Veritabanı veya dosya ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 10px 6px 30px',
                fontSize: '0.82rem',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <EmptyState
            title="Kayıt Bulunamadı"
            message="Seçilen filtre kriterlerine uyan veritabanı dosyası bulunamadı."
          />
        ) : (
          <DataTable data={filteredItems} columns={columns} />
        )}
      </div>

      {/* 5. Batch Remediation Runbook */}
      {showRunbook && data && (
        <div className={styles.runbookSection}>
          <div className={styles.runbookHeader}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Terminal size={15} color="var(--primary-color, #2563eb)" />
              Toplu Düzeltici T-SQL Betiği (AUTO_SHRINK Kapatma &amp; Sabit Büyüme)
            </span>
            <button className={styles.btnPrimary} onClick={() => handleCopy(data.remediation_batch_script)}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Kopyalandı' : 'Betiği Kopyala'}
            </button>
          </div>
          <div className={styles.runbookCodeArea}>
            <CodeBlock code={data.remediation_batch_script} language="sql" />
          </div>
        </div>
      )}
    </div>
  );
}
