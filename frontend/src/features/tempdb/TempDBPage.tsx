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
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import DataTable, { type Column } from '../../components/ui/DataTable';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';
import DemoDataBanner from '../../components/ui/DemoDataBanner';
import { getTempDBMemorySummary } from '../../lib/api';
import type {
  TempDBMemorySummary,
  TempDBFile,
  MemoryClerk,
} from '../../lib/types';
import styles from './TempDBPage.module.css';

export default function TempDBPage() {
  const [summary, setSummary] = useState<TempDBMemorySummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
    </div>
  );
}
