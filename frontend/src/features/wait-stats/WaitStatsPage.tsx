import React, { useState, useEffect } from 'react';
import { Hourglass, Cpu, HardDrive, ShieldAlert, CheckCircle2, Search, Filter } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import DataTable, { type Column } from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import DemoDataBanner from '../../components/ui/DemoDataBanner';
import { getWaitStatistics } from '../../lib/api';
import type { WaitStatsSummary, WaitStatEntry } from '../../lib/types';
import styles from './WaitStatsPage.module.css';

export default function WaitStatsPage() {
  const [summary, setSummary] = useState<WaitStatsSummary | null>(null);
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const data = await getWaitStatistics();
        setSummary(data);
      } catch (err: any) {
        setError(err.message || 'Bekleme istatistikleri alınırken bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredWaits = (summary?.wait_stats || []).filter((w) => {
    const matchesSearch =
      !search ||
      w.wait_type.toLowerCase().includes(search.toLowerCase()) ||
      w.category.toLowerCase().includes(search.toLowerCase()) ||
      w.description.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = !selectedCategory || w.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const columns: Column<WaitStatEntry>[] = [
    {
      key: 'wait_type',
      label: 'Bekleme Türü (Wait Type)',
      sortable: true,
      render: (w) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <strong style={{ color: '#ffffff', fontFamily: 'monospace' }}>{w.wait_type}</strong>
            <span
              style={{
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--accent)',
              }}
            >
              {w.category}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {w.description}
          </div>
        </div>
      ),
    },
    {
      key: 'percentage_of_total',
      label: 'Toplam Payı (%)',
      sortable: true,
      render: (w) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className={styles.progressBar} style={{ width: '60px' }}>
            <div
              className={styles.progressFill}
              style={{
                width: `${Math.min(w.percentage_of_total, 100)}%`,
                backgroundColor:
                  w.percentage_of_total >= 30
                    ? '#ef4444'
                    : w.percentage_of_total >= 15
                    ? '#f59e0b'
                    : 'var(--accent)',
              }}
            />
          </div>
          <span style={{ fontWeight: 600, fontSize: '12px' }}>
            %{w.percentage_of_total.toFixed(1)}
          </span>
        </div>
      ),
    },
    {
      key: 'wait_time_sec',
      label: 'Toplam Bekleme',
      sortable: true,
      render: (w) => `${w.wait_time_sec.toFixed(1)} sn`,
    },
    {
      key: 'signal_wait_percent',
      label: 'Signal Wait (CPU Kuyruğu)',
      sortable: true,
      render: (w) => {
        const isHigh = w.signal_wait_percent >= 25;
        return (
          <StatusBadge
            variant={isHigh ? 'warning' : 'neutral'}
            label={`%${w.signal_wait_percent.toFixed(1)}`}
          />
        );
      },
    },
    {
      key: 'waiting_tasks_count',
      label: 'Bekleme Sayısı',
      sortable: true,
      render: (w) => w.waiting_tasks_count.toLocaleString(),
    },
    {
      key: 'recommendation',
      label: 'Önerilen DBA Aksiyonu',
      render: (w) => (
        <div style={{ fontSize: '11px', color: '#f59e0b', maxWidth: '320px' }}>
          💡 {w.recommendation}
        </div>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <PageHeader
        title="Bekleme İstatistikleri (Wait Statistics)"
        subtitle="SQL Server'ın beklediği darboğazları, kaynak tüketim türlerini ve CPU kuyruk baskısını analiz edin"
      />

      {summary?.is_demo && <DemoDataBanner />}

      {/* KPI Stats Cards */}
      {summary && (
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiTitle}>CPU Zamanlama Baskısı (Signal Wait)</div>
            <div
              className={styles.kpiValue}
              style={{
                color: summary.has_cpu_pressure ? '#ef4444' : '#10b981',
              }}
            >
              %{summary.signal_wait_ratio_percent.toFixed(1)}
            </div>
            <div className={styles.kpiSub}>
              {summary.has_cpu_pressure ? (
                <>
                  <ShieldAlert size={14} color="#ef4444" />
                  <span>Kritik CPU Baskısı Tespit Edildi (&gt; %15)</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} color="#10b981" />
                  <span>CPU Zamanlaması Sağlıklı (&lt; %15)</span>
                </>
              )}
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiTitle}>Birincil Darboğaz Kategorisi</div>
            <div className={styles.kpiValue} style={{ color: 'var(--accent)' }}>
              {summary.top_category}
            </div>
            <div className={styles.kpiSub}>En yüksek kümülatif gecikme</div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiTitle}>Toplam Kaydedilen Bekleme</div>
            <div className={styles.kpiValue} style={{ color: '#ffffff' }}>
              {(summary.total_wait_time_ms / 1000.0).toFixed(0)} sn
            </div>
            <div className={styles.kpiSub}>
              Signal: {(summary.total_signal_wait_ms / 1000.0).toFixed(1)} sn
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiTitle}>Toplam Bekleyen Görev</div>
            <div className={styles.kpiValue} style={{ color: '#ffffff' }}>
              {summary.total_waiting_tasks.toLocaleString()}
            </div>
            <div className={styles.kpiSub}>İş parçacığı (task) döngüsü</div>
          </div>
        </div>
      )}

      {/* Category Breakdown Bar Grid */}
      {summary?.categories && summary.categories.length > 0 && (
        <div className={styles.categoriesSection}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Darboğaz Kategorileri Dağılımı
          </div>
          <div className={styles.catGrid}>
            {summary.categories.map((cat) => (
              <div key={cat.category} className={styles.catCard}>
                <div className={styles.catHeader}>
                  <span>{cat.category}</span>
                  <span className={styles.catPct}>%{cat.percentage.toFixed(1)}</span>
                </div>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${Math.min(cat.percentage, 100)}%`,
                      backgroundColor:
                        cat.category === 'Disk I/O'
                          ? '#38bdf8'
                          : cat.category === 'Parallelism'
                          ? '#0d9488'
                          : cat.category === 'Locks & Latches'
                          ? '#f59e0b'
                          : cat.category === 'CPU'
                          ? '#ef4444'
                          : '#a855f7',
                    }}
                  />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {(cat.total_wait_ms / 1000).toFixed(1)} sn ({cat.wait_count.toLocaleString()} görev)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls: Search & Category filter */}
      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <Search size={15} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Bekleme türü veya açıklama ara (örn: PAGEIOLATCH, CXPACKET)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={14} color="var(--text-muted)" />
          <select
            className={styles.select}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">Tüm Kategoriler</option>
            {summary?.categories.map((c) => (
              <option key={c.category} value={c.category}>
                {c.category}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <LoadingSpinner label="Bekleme istatistikleri ve DMV kayıtları yükleniyor..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : filteredWaits.length === 0 ? (
        <EmptyState
          title="Bekleme Kaydı Bulunamadı"
          message="Arama kriterlerinize uygun aktif bir bekleme istatistiği bulunamadı."
        />
      ) : (
        <DataTable data={filteredWaits} columns={columns} />
      )}
    </div>
  );
}
