import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Layers,
  Zap,
  ShieldCheck,
  AlertTriangle,
  HardDrive,
  Clock,
  PieChart,
  Copy,
  Check,
  Flame,
  Database,
  FileCode,
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import DataTable, { type Column } from '../../components/ui/DataTable';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';
import DemoDataBanner from '../../components/ui/DemoDataBanner';
import MemoryGrantsViewer from './components/MemoryGrantsViewer';
import TempDBContentionViewer from './components/TempDBContentionViewer';
import { getTempDBMemorySummary } from '../../lib/api';
import type {
  TempDBMemorySummary,
  TempDBFile,
  MemoryClerk,
  BufferPoolDatabaseUsage,
  BufferPoolTopObject,
  PlanCacheBloatAnalysis,
} from '../../lib/types';
import styles from './TempDBPage.module.css';

export default function TempDBPage() {
  const [summary, setSummary] = useState<TempDBMemorySummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const data = await getTempDBMemorySummary();
        setSummary(data);
      } catch (err: any) {
        setError(err.message || 'TempDB ve bellek verileri alınırken bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  const fileColumns: Column<TempDBFile>[] = [
    {
      key: 'name',
      label: 'Dosya Adı & Konumu',
      sortable: true,
      render: (f) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.name}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {f.physical_name}
          </div>
        </div>
      ),
    },
    {
      key: 'size_mb',
      label: 'Boyut',
      sortable: true,
      render: (f) => (
        <span style={{ fontWeight: 600 }}>
          {f.size_mb >= 1024 ? `${(f.size_mb / 1024).toFixed(2)} GB` : `${f.size_mb.toFixed(1)} MB`}
        </span>
      ),
    },
    {
      key: 'free_percent',
      label: 'Boş Alan',
      sortable: true,
      render: (f) => (
        <span>
          {f.free_mb >= 1024 ? `${(f.free_mb / 1024).toFixed(2)} GB` : `${f.free_mb.toFixed(1)} MB`}{' '}
          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>({f.free_percent.toFixed(1)}%)</span>
        </span>
      ),
    },
    {
      key: 'growth',
      label: 'Büyüme',
      sortable: true,
      render: (f) => (
        <span style={{ fontFamily: 'monospace', color: f.is_percent_growth ? 'var(--status-danger)' : 'var(--text-primary)' }}>
          {f.growth}
        </span>
      ),
    },
  ];

  const clerkColumns: Column<MemoryClerk>[] = [
    {
      key: 'friendly_name',
      label: 'Bellek Bileşeni (Memory Clerk)',
      sortable: true,
      render: (c) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.friendly_name}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {c.clerk_type}
          </div>
        </div>
      ),
    },
    {
      key: 'size_mb',
      label: 'Kullanılan Alan',
      sortable: true,
      render: (c) => (
        <span style={{ fontWeight: 600 }}>
          {c.size_mb >= 1024 ? `${(c.size_mb / 1024).toFixed(2)} GB` : `${c.size_mb.toFixed(1)} MB`}
        </span>
      ),
    },
    {
      key: 'percentage_of_total',
      label: 'Payı (%)',
      sortable: true,
      render: (c) => (
        <div style={{ minWidth: '130px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
            {c.percentage_of_total.toFixed(1)}%
          </div>
          <div className={styles.barTrack}>
            <div
              className={styles.barFill}
              style={{
                width: `${Math.min(100, c.percentage_of_total)}%`,
                background: 'var(--accent-blue)',
              }}
            />
          </div>
        </div>
      ),
    },
  ];

  const bpColumns: Column<BufferPoolDatabaseUsage>[] = [
    {
      key: 'database_name',
      label: 'Veritabanı',
      sortable: true,
      render: (d) => <strong style={{ color: 'var(--text-primary)' }}>{d.database_name}</strong>,
    },
    {
      key: 'buffer_pool_mb',
      label: 'Buffer Pool Boyutu',
      sortable: true,
      render: (d) => (
        <span style={{ fontWeight: 600 }}>
          {d.buffer_pool_mb >= 1024 ? `${(d.buffer_pool_mb / 1024).toFixed(2)} GB` : `${d.buffer_pool_mb.toFixed(1)} MB`}
        </span>
      ),
    },
    {
      key: 'percentage_of_buffer_pool',
      label: 'RAM Payı (%)',
      sortable: true,
      render: (d) => (
        <div style={{ minWidth: '100px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '2px' }}>
            {d.percentage_of_buffer_pool.toFixed(1)}%
          </div>
          <div className={styles.barTrack}>
            <div
              className={styles.barFill}
              style={{
                width: `${Math.min(100, d.percentage_of_buffer_pool)}%`,
                background: 'var(--accent-blue)',
              }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'clean_pages_mb',
      label: 'Temiz / Kirli Sayfalar (Checkpoint)',
      render: (d) => {
        const total = d.clean_pages_mb + d.dirty_pages_mb || 1;
        const cleanPct = (d.clean_pages_mb / total) * 100;
        const dirtyPct = (d.dirty_pages_mb / total) * 100;
        return (
          <div className={styles.dirtyCleanWrap}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--text-muted)' }}>
              <span>Temiz: {d.clean_pages_mb.toFixed(0)} MB</span>
              <span style={{ color: d.dirty_pages_mb > 500 ? '#f59e0b' : 'inherit' }}>
                Kirli: {d.dirty_pages_mb.toFixed(0)} MB
              </span>
            </div>
            <div className={styles.dirtyCleanBar}>
              <div className={styles.cleanSegment} style={{ width: `${cleanPct}%` }} title="Temiz sayfalar" />
              <div className={styles.dirtySegment} style={{ width: `${dirtyPct}%` }} title="Diske yazılmayı bekleyen kirli sayfalar" />
            </div>
          </div>
        );
      },
    },
  ];

  const objectColumns: Column<BufferPoolTopObject>[] = [
    {
      key: 'table_name',
      label: 'Tablo & Şema',
      sortable: true,
      render: (o) => (
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>{o.table_name}</strong>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
            ({o.schema_name})
          </span>
        </div>
      ),
    },
    {
      key: 'index_name',
      label: 'İndeks & Tür',
      sortable: true,
      render: (o) => (
        <div>
          <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{o.index_name || 'HEAP'}</span>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{o.index_type}</div>
        </div>
      ),
    },
    {
      key: 'buffer_mb',
      label: 'RAM Boyutu (Buffer MB)',
      sortable: true,
      render: (o) => (
        <span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>
          {o.buffer_mb >= 1024 ? `${(o.buffer_mb / 1024).toFixed(2)} GB` : `${o.buffer_mb.toFixed(1)} MB`}
        </span>
      ),
    },
    {
      key: 'page_count',
      label: 'Bellek Sayfası',
      sortable: true,
      render: (o) => (
        <span style={{ fontSize: '11.5px', fontFamily: 'monospace' }}>
          {o.page_count.toLocaleString()} sayfa
        </span>
      ),
    },
  ];

  const handleCopyScript = (scriptText: string) => {
    navigator.clipboard.writeText(scriptText);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const space = summary?.space_breakdown;

  return (
    <div className={styles.container}>
      <PageHeader
        title="TempDB & Bellek Zekası"
        subtitle="TempDB alan dağılımı (User/Internal/Version Store), PAGELATCH tahsis çekişmesi, Page Life Expectancy (PLE) ve Memory Clerk analizi."
      />

      {summary?.is_demo && <DemoDataBanner />}

      {/* Top KPIs */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Page Life Expectancy (PLE)</span>
            <Clock size={18} color="var(--accent-blue)" />
          </div>
          <div className={styles.kpiValue}>
            {summary?.page_life_expectancy_sec} <span style={{ fontSize: '14px', fontWeight: 500 }}>saniye</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              className={
                summary?.ple_status === 'HEALTHY'
                  ? styles.badgeSuccess
                  : summary?.ple_status === 'WARNING'
                  ? styles.badgeWarning
                  : styles.badgeDanger
              }
            >
              {summary?.ple_status === 'HEALTHY' ? 'Sağlıklı' : summary?.ple_status === 'WARNING' ? 'Uyarı' : 'Kritik Baskı'}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Standart Eşik: &gt;300s</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Buffer Cache Hit Ratio</span>
            <Zap size={18} color="var(--status-success)" />
          </div>
          <div className={styles.kpiValue}>{summary?.buffer_cache_hit_ratio.toFixed(2)}%</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Önbellekten karşılanan veri istekleri
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Sunucu Bellek Tüketimi</span>
            <Cpu size={18} color="var(--accent-purple)" />
          </div>
          <div className={styles.kpiValue}>
            {((summary?.total_server_memory_mb || 0) / 1024).toFixed(1)} GB
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Hedef Maksimum: {((summary?.target_server_memory_mb || 0) / 1024).toFixed(1)} GB ({summary?.memory_utilization_pct.toFixed(1)}%)
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>TempDB Dosya Yapılandırması</span>
            <HardDrive size={18} color="var(--accent-cyan)" />
          </div>
          <div className={styles.kpiValue}>
            {summary?.file_count} Dosya
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              className={
                summary?.file_count_status === 'OPTIMAL' ? styles.badgeSuccess : styles.badgeWarning
              }
            >
              {summary?.file_count_status === 'OPTIMAL' ? 'Optimal Eşit Sizing' : 'Gözden Geçirilmeli'}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{summary?.cpu_cores} Mantıksal Çekirdek</span>
          </div>
        </div>
      </div>

      {/* Advisory Banner */}
      <div className={summary?.allocation_contention_detected ? styles.dangerAlert : styles.infoAlert}>
        <ShieldCheck size={20} className={styles.alertIcon} />
        <div>
          <strong>TempDB Çekişme &amp; Dosya Durumu:</strong> {summary?.file_count_recommendation}
          <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            {summary?.contention_description}
          </div>
        </div>
      </div>

      {/* Section 1: TempDB Space Breakdown */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PieChart size={18} color="var(--accent-blue)" />
            <h3 style={{ margin: 0, fontSize: '15px' }}>TempDB Alan Dağılımı (Space Allocation)</h3>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Toplam: {((space?.total_size_mb || 0) / 1024).toFixed(2)} GB
          </span>
        </div>

        {/* Visual Stacked Progress Bar */}
        <div className={styles.stackedBar}>
          <div
            className={styles.segmentUser}
            style={{ width: `${space?.user_objects_pct || 0}%` }}
            title={`Kullanıcı Nesneleri: ${space?.user_objects_mb} MB (%${space?.user_objects_pct})`}
          />
          <div
            className={styles.segmentInternal}
            style={{ width: `${space?.internal_objects_pct || 0}%` }}
            title={`Dahili Nesneler: ${space?.internal_objects_mb} MB (%${space?.internal_objects_pct})`}
          />
          <div
            className={styles.segmentVersion}
            style={{ width: `${space?.version_store_pct || 0}%` }}
            title={`Version Store: ${space?.version_store_mb} MB (%${space?.version_store_pct})`}
          />
          <div
            className={styles.segmentUnallocated}
            style={{ width: `${space?.unallocated_pct || 0}%` }}
            title={`Boş Alan: ${space?.unallocated_space_mb} MB (%${space?.unallocated_pct})`}
          />
        </div>

        {/* Legend Cards */}
        <div className={styles.breakdownGrid}>
          <div className={styles.breakdownItem}>
            <div className={styles.legendColor} style={{ background: 'var(--accent-blue)' }} />
            <div>
              <div className={styles.breakdownLabel}>Kullanıcı Nesneleri (User Objects)</div>
              <div className={styles.breakdownValue}>
                {space?.user_objects_mb} MB ({space?.user_objects_pct}%)
              </div>
              <div className={styles.breakdownSub}>
                Geçici tablolar (#tablo), @table değişkenleri ve tablo değerli fonksiyonlar.
              </div>
            </div>
          </div>

          <div className={styles.breakdownItem}>
            <div className={styles.legendColor} style={{ background: '#f59e0b' }} />
            <div>
              <div className={styles.breakdownLabel}>Dahili Nesneler (Internal Objects)</div>
              <div className={styles.breakdownValue}>
                {space?.internal_objects_mb} MB ({space?.internal_objects_pct}%)
              </div>
              <div className={styles.breakdownSub}>
                Sıralama (Sort Spills), Hash Join çalışma tabloları ve imleçler (cursors).
              </div>
            </div>
          </div>

          <div className={styles.breakdownItem}>
            <div className={styles.legendColor} style={{ background: 'var(--accent-purple)' }} />
            <div>
              <div className={styles.breakdownLabel}>Sürüm Deposu (Version Store)</div>
              <div className={styles.breakdownValue}>
                {space?.version_store_mb} MB ({space?.version_store_pct}%)
              </div>
              <div className={styles.breakdownSub}>
                Snapshot İzolasyonu, RCSI (Read Committed Snapshot) ve Online Reindex.
              </div>
            </div>
          </div>

          <div className={styles.breakdownItem}>
            <div className={styles.legendColor} style={{ background: 'var(--status-success)' }} />
            <div>
              <div className={styles.breakdownLabel}>Boş Alan (Unallocated)</div>
              <div className={styles.breakdownValue}>
                {space?.unallocated_space_mb} MB ({space?.unallocated_pct}%)
              </div>
              <div className={styles.breakdownSub}>
                TempDB dosyalarında hemen kullanılabilir durumdaki boş alan.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Section: TempDB Files & Memory Clerks */}
      <div className={styles.twoColGrid}>
        {/* Left: TempDB Files */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HardDrive size={18} color="var(--accent-cyan)" />
              <h3 style={{ margin: 0, fontSize: '15px' }}>TempDB Veri Dosyaları ({summary?.tempdb_files?.length || 0})</h3>
            </div>
          </div>
          <DataTable
            data={summary?.tempdb_files || []}
            columns={fileColumns}
            emptyMessage="TempDB dosyası bulunamadı."
          />
        </div>

        {/* Right: Memory Clerks */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="var(--accent-purple)" />
              <h3 style={{ margin: 0, fontSize: '15px' }}>En Çok Bellek Tüketen Bileşenler (Clerks)</h3>
            </div>
          </div>
          <DataTable
            data={summary?.top_memory_clerks || []}
            columns={clerkColumns}
            emptyMessage="Memory clerk verisi bulunamadı."
          />
        </div>
      </div>

      {/* Section: Ad-Hoc Plan Cache Bloat Analysis */}
      {summary?.plan_cache_bloat && (
        <div
          className={`${styles.bloatCard} ${
            summary.plan_cache_bloat.status === 'CRITICAL' ? styles.bloatCardCritical : ''
          }`}
        >
          <div className={styles.bloatHeader}>
            <div className={styles.bloatHeaderLeft}>
              <Flame
                size={20}
                color={
                  summary.plan_cache_bloat.status === 'CRITICAL'
                    ? '#ef4444'
                    : summary.plan_cache_bloat.status === 'WARNING'
                    ? '#f59e0b'
                    : 'var(--status-success)'
                }
              />
              <h3 className={styles.bloatTitle}>
                Ad-Hoc Plan Cache Şişmesi &amp; Bellek İsrafı (sys.dm_exec_cached_plans)
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                className={
                  summary.plan_cache_bloat.status === 'CRITICAL'
                    ? styles.badgeDanger
                    : summary.plan_cache_bloat.status === 'WARNING'
                    ? styles.badgeWarning
                    : styles.badgeSuccess
                }
              >
                {summary.plan_cache_bloat.status === 'CRITICAL'
                  ? 'Kritik Bellek İsrafı'
                  : summary.plan_cache_bloat.status === 'WARNING'
                  ? 'Orta Seviye Şişme'
                  : 'Sağlıklı Önbellek'}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: summary.plan_cache_bloat.optimize_for_adhoc_enabled
                    ? 'rgba(34, 197, 94, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)',
                  color: summary.plan_cache_bloat.optimize_for_adhoc_enabled
                    ? 'var(--status-success)'
                    : '#ef4444',
                  fontWeight: 600,
                }}
              >
                optimize for ad hoc workloads:{' '}
                {summary.plan_cache_bloat.optimize_for_adhoc_enabled ? 'AÇIK (1)' : 'KAPALI (0)'}
              </span>
            </div>
          </div>

          <div className={styles.bloatGrid}>
            <div className={styles.bloatItem}>
              <span className={styles.bloatLabel}>Toplam Önbellek Planı</span>
              <span className={styles.bloatValue}>
                {summary.plan_cache_bloat.total_cached_plans_count.toLocaleString()}
              </span>
            </div>
            <div className={styles.bloatItem}>
              <span className={styles.bloatLabel}>Tek Seferlik (Single-Use) Plan</span>
              <span
                className={styles.bloatValue}
                style={{
                  color:
                    summary.plan_cache_bloat.single_use_plans_percent > 40
                      ? '#ef4444'
                      : 'inherit',
                }}
              >
                {summary.plan_cache_bloat.single_use_plans_count.toLocaleString()}{' '}
                <span style={{ fontSize: '12px', fontWeight: 500 }}>
                  (%{summary.plan_cache_bloat.single_use_plans_percent})
                </span>
              </span>
            </div>
            <div className={styles.bloatItem}>
              <span className={styles.bloatLabel}>Plan Cache Toplam Boyut</span>
              <span className={styles.bloatValue}>
                {summary.plan_cache_bloat.total_cache_size_mb >= 1024
                  ? `${(summary.plan_cache_bloat.total_cache_size_mb / 1024).toFixed(2)} GB`
                  : `${summary.plan_cache_bloat.total_cache_size_mb.toFixed(1)} MB`}
              </span>
            </div>
            <div className={styles.bloatItem}>
              <span className={styles.bloatLabel}>İsraf Edilen RAM Alanı</span>
              <span
                className={styles.bloatValue}
                style={{
                  color:
                    summary.plan_cache_bloat.wasted_memory_percent > 30 ? '#ef4444' : 'inherit',
                }}
              >
                {summary.plan_cache_bloat.wasted_adhoc_mb >= 1024
                  ? `${(summary.plan_cache_bloat.wasted_adhoc_mb / 1024).toFixed(2)} GB`
                  : `${summary.plan_cache_bloat.wasted_adhoc_mb.toFixed(1)} MB`}{' '}
                <span style={{ fontSize: '12px', fontWeight: 500 }}>
                  (%{summary.plan_cache_bloat.wasted_memory_percent})
                </span>
              </span>
            </div>
          </div>

          <div className={styles.bloatRecBox}>
            <strong>Kök Neden &amp; Çözüm Teşhisi:</strong> {summary.plan_cache_bloat.recommendation}
          </div>

          <div className={styles.scriptWrapper}>
            <button
              type="button"
              className={styles.copyScriptBtn}
              onClick={() => handleCopyScript(summary.plan_cache_bloat?.remediation_script || '')}
              title="İyileştirme T-SQL betiğini kopyala"
            >
              {copiedScript ? <Check size={12} /> : <Copy size={12} />}
              {copiedScript ? 'Kopyalandı' : 'T-SQL Betiğini Kopyala'}
            </button>
            <pre className={styles.scriptPre}>{summary.plan_cache_bloat.remediation_script}</pre>
          </div>
        </div>
      )}

      {/* Section: TempDB PFS/GAM/SGAM Latch Contention & Session Space Leaks */}
      <TempDBContentionViewer />

      {/* Section: Query Memory Grants & RESOURCE_SEMAPHORE Contention */}
      <MemoryGrantsViewer />

      {/* Section: Buffer Pool Deep Breakdown (Databases & Top Objects) */}
      <div className={styles.twoColGrid}>
        {/* Left: Buffer Pool Per-Database Distribution */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} color="var(--accent-blue)" />
              <h3 style={{ margin: 0, fontSize: '15px' }}>
                Veritabanı Bazında Buffer Pool Kullanımı (sys.dm_os_buffer_descriptors)
              </h3>
            </div>
          </div>
          <DataTable
            data={summary?.buffer_pool_db_distribution || []}
            columns={bpColumns}
            emptyMessage="Buffer pool veritabanı dağılımı bulunamadı."
          />
        </div>

        {/* Right: Top In-Memory Cached Objects */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileCode size={18} color="var(--accent-cyan)" />
              <h3 style={{ margin: 0, fontSize: '15px' }}>
                RAM'de En Çok Yer Kaplayan Tablolar &amp; İndeksler
              </h3>
            </div>
          </div>
          <DataTable
            data={summary?.buffer_pool_top_objects || []}
            columns={objectColumns}
            emptyMessage="Bellekteki nesne dağılımı bulunamadı."
          />
        </div>
      </div>
    </div>
  );
}
