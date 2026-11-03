import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Database,
  Search,
  Code2,
  Copy,
  Check,
  X,
  Layers,
  Sparkles,
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import DataTable, { type Column } from '../../components/ui/DataTable';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import { getTableStatistics, getDatabases } from '../../lib/api';
import type { TableStatistic, Database as DatabaseType } from '../../lib/types';
import styles from './StatisticsPage.module.css';

export default function StatisticsPage() {
  const [databases, setDatabases] = useState<DatabaseType[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>('');
  const [statistics, setStatistics] = useState<TableStatistic[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'STALE' | 'WARNING' | 'FRESH'>('all');

  const [activeModal, setActiveModal] = useState<{
    title: string;
    sql: string;
    description?: string;
  } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Load databases
  useEffect(() => {
    async function loadDbs() {
      try {
        const dbs = await getDatabases();
        setDatabases(dbs || []);
        const nonSystem = dbs.filter(
          (d) => !['master', 'model', 'msdb', 'tempdb'].includes(d.name.toLowerCase())
        );
        if (nonSystem.length > 0) {
          setSelectedDb(nonSystem[0].name);
        } else if (dbs.length > 0) {
          setSelectedDb(dbs[0].name);
        }
      } catch (err) {
        console.error('Veritabanları alınamadı:', err);
      }
    }
    loadDbs();
  }, []);

  // Load statistics when selectedDb changes
  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTableStatistics(selectedDb || undefined);
      setStatistics(data || []);
    } catch (err: any) {
      setError(err.message || 'İstatistik verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [selectedDb]);

  // KPIs
  const kpis = useMemo(() => {
    const total = statistics.length;
    const stale = statistics.filter((s) => s.status === 'STALE').length;
    const warning = statistics.filter((s) => s.status === 'WARNING').length;
    const fresh = statistics.filter((s) => s.status === 'FRESH').length;
    return { total, stale, warning, fresh };
  }, [statistics]);

  // Filtered list
  const filteredList = useMemo(() => {
    return statistics.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTable = item.table_name.toLowerCase().includes(q);
        const matchesStat = item.stats_name.toLowerCase().includes(q);
        const matchesSchema = item.schema_name.toLowerCase().includes(q);
        if (!matchesTable && !matchesStat && !matchesSchema) return false;
      }
      return true;
    });
  }, [statistics, statusFilter, searchQuery]);

  const handleCopyScript = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateBatchScript = () => {
    const needingUpdate = statistics.filter((s) => s.status === 'STALE' || s.status === 'WARNING');
    if (needingUpdate.length === 0) {
      setActiveModal({
        title: 'Toplu İstatistik Güncelleme Betiği',
        sql: '-- Seçilen veritabanında bayatlayan veya güncellenmesi gereken istatistik bulunmuyor.',
        description: 'Tüm istatistikler güncel ve Query Optimizer için sağlıklı durumda.',
      });
      return;
    }

    let batch = `-- =========================================================================\n`;
    batch += `-- DATAPATH — TOPLU İSTATİSTİK GÜNCELLEME BETİĞİ\n`;
    batch += `-- Hedef Veritabanı: [${selectedDb || 'Seçili Veritabanı'}]\n`;
    batch += `-- Güncellenecek İstatistik Sayısı: ${needingUpdate.length} adet\n`;
    batch += `-- Not: WITH RESAMPLE mevcut örnekleme oranını koruyarak kilitlemeyi minimize eder.\n`;
    batch += `-- =========================================================================\n\n`;
    if (selectedDb) batch += `USE [${selectedDb}];\nGO\n\n`;

    needingUpdate.forEach((s) => {
      batch += `PRINT 'Güncelleniyor: [${s.schema_name}].[${s.table_name}] -> [${s.stats_name}] (Değişim: %${s.staleness_percent.toFixed(1)})...';\n`;
      batch += `UPDATE STATISTICS [${s.schema_name}].[${s.table_name}] [${s.stats_name}] WITH RESAMPLE;\nGO\n\n`;
    });

    batch += `PRINT 'Tüm bayat istatistikler başarıyla güncellendi!';\n`;

    setActiveModal({
      title: `Toplu İstatistik Güncelleme (${needingUpdate.length} Adet)`,
      sql: batch,
      description: `%10 ve üzerinde satır değişimi (modification) tespit edilen tüm tablolar için sıralı güncelleme komutları.`,
    });
  };

  const columns: Column<TableStatistic>[] = [
    {
      key: 'table_name',
      label: 'Tablo & Şema',
      sortable: true,
      render: (s) => (
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>{s.table_name}</strong>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            [{s.schema_name}].[{s.table_name}] • {s.database_name}
          </div>
        </div>
      ),
    },
    {
      key: 'stats_name',
      label: 'İstatistik Adı',
      sortable: true,
      render: (s) => {
        const isAuto = s.stats_name.startsWith('_WA_Sys_');
        return (
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#cbd5e1' }}>
              {s.stats_name}
            </span>
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
              {isAuto ? 'Otomatik Üretilen Kolon İstatistiği' : 'İndeks / Kullanıcı İstatistiği'}
            </div>
          </div>
        );
      },
    },
    {
      key: 'staleness_percent',
      label: 'Bayatlık Oranı',
      sortable: true,
      render: (s) => {
        const isStale = s.status === 'STALE';
        const isWarn = s.status === 'WARNING';
        const color = isStale ? '#ef4444' : isWarn ? '#f59e0b' : '#10b981';
        const label = isStale ? 'Kritik Bayat (%20+)' : isWarn ? 'Orta Değişim (%10+)' : 'Güncel';

        return (
          <div className={styles.staleProgressWrapper}>
            <div className={styles.staleBar}>
              <div
                className={styles.staleBarFill}
                style={{
                  width: `${Math.min(100, Math.max(5, s.staleness_percent))}%`,
                  backgroundColor: color,
                }}
              />
            </div>
            <span style={{ fontWeight: 700, fontSize: '12px', color }}>
              %{s.staleness_percent.toFixed(1)}
            </span>
          </div>
        );
      },
    },
    {
      key: 'modification_counter',
      label: 'Değişen Satır Sayısı',
      sortable: true,
      render: (s) => (
        <div>
          <span style={{ fontWeight: 600 }}>{s.modification_counter.toLocaleString()} satır</span>
          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
            Toplamın %{((s.modification_counter / (s.rows_total || 1)) * 100).toFixed(1)}'i
          </div>
        </div>
      ),
    },
    {
      key: 'rows_total',
      label: 'Toplam / Örnek Satır',
      sortable: true,
      render: (s) => (
        <div>
          <span>{s.rows_total.toLocaleString()} satır</span>
          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
            Örnek: {s.rows_sampled.toLocaleString()} (%{((s.rows_sampled / (s.rows_total || 1)) * 100).toFixed(0)})
          </div>
        </div>
      ),
    },
    {
      key: 'last_updated',
      label: 'Son Güncelleme',
      sortable: true,
      render: (s) => (
        <span style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
          {s.last_updated || 'Bilinmiyor'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'İşlem',
      render: (s) => (
        <button
          type="button"
          className={styles.actionBtn}
          onClick={() =>
            setActiveModal({
              title: `İstatistik Güncelleme Reçetesi — ${s.stats_name}`,
              sql: s.update_statement,
              description: `[${s.schema_name}].[${s.table_name}] tablosu için Optimizer kardinalite tahminini tazeleyen T-SQL komutu.`,
            })
          }
        >
          <Code2 size={13} />
          T-SQL Al
        </button>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <PageHeader
        title="İstatistik Sağlığı & Kardinalite Radarı"
        subtitle="Sorgu planlarının doğru maliyetle çalışmasını sağlayan histogram tazelik oranları, bayatlayan istatistikler ve otomatik güncelleme reçeteleri."
        actions={
          <button
            type="button"
            className={styles.batchBtn}
            onClick={generateBatchScript}
          >
            <Sparkles size={14} />
            Toplu Güncelleme Betiği
          </button>
        }
      />

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHead}>
            <span>Taranan İstatistikler</span>
            <Layers size={16} color="var(--text-muted)" />
          </div>
          <div className={styles.kpiValue}>{kpis.total}</div>
          <div className={styles.kpiSub}>Veritabanı tablosu ve indeks histogramı</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHead}>
            <span>Kritik Bayat İstatistikler</span>
            <AlertTriangle size={16} color="#ef4444" />
          </div>
          <div className={styles.kpiValue} style={{ color: kpis.stale > 0 ? '#ef4444' : '#10b981' }}>
            {kpis.stale}
          </div>
          <div className={styles.kpiSub}>%20+ satır değişimi (Yanlış Plan & Spill Riski)</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHead}>
            <span>Orta Düzey Değişenler</span>
            <AlertCircle size={16} color="#f59e0b" />
          </div>
          <div className={styles.kpiValue} style={{ color: kpis.warning > 0 ? '#f59e0b' : 'var(--text-primary)' }}>
            {kpis.warning}
          </div>
          <div className={styles.kpiSub}>%10 - %20 arası satır değişimi</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHead}>
            <span>Güncel İstatistikler</span>
            <CheckCircle2 size={16} color="#10b981" />
          </div>
          <div className={styles.kpiValue} style={{ color: '#10b981' }}>
            {kpis.fresh}
          </div>
          <div className={styles.kpiSub}>Optimizer için taze ve doğru kardinalite</div>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className={styles.controlsBar}>
        <div className={styles.leftControls}>
          <div className={styles.dbSelectGroup}>
            <Database size={14} color="var(--text-muted)" />
            <span className={styles.dbSelectLabel}>Veritabanı:</span>
            <select
              className={styles.dbSelect}
              value={selectedDb}
              onChange={(e) => setSelectedDb(e.target.value)}
            >
              {databases.map((db) => (
                <option key={db.name} value={db.name}>
                  {db.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterPills}>
            <button
              type="button"
              className={`${styles.filterPill} ${statusFilter === 'all' ? styles.filterPillActive : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              Tümü ({statistics.length})
            </button>
            <button
              type="button"
              className={`${styles.filterPill} ${statusFilter === 'STALE' ? styles.filterPillActive : ''}`}
              onClick={() => setStatusFilter('STALE')}
            >
              Kritik Bayat ({kpis.stale})
            </button>
            <button
              type="button"
              className={`${styles.filterPill} ${statusFilter === 'WARNING' ? styles.filterPillActive : ''}`}
              onClick={() => setStatusFilter('WARNING')}
            >
              Orta Değişim ({kpis.warning})
            </button>
            <button
              type="button"
              className={`${styles.filterPill} ${statusFilter === 'FRESH' ? styles.filterPillActive : ''}`}
              onClick={() => setStatusFilter('FRESH')}
            >
              Güncel ({kpis.fresh})
            </button>
          </div>
        </div>

        <div className={styles.searchBox}>
          <Search size={13} color="var(--text-muted)" />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Tablo veya istatistik ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Table Section */}
      {loading && <LoadingSpinner message="sys.dm_db_stats_properties histogram verileri taranıyor..." />}
      {error && <ErrorState message={error} onRetry={fetchStats} />}

      {!loading && !error && filteredList.length === 0 && (
        <EmptyState
          icon={<Layers size={40} />}
          title="İstatistik Bulunamadı"
          message="Seçilen filtre kriterlerine veya veritabanına uygun tablo istatistiği bulunamadı."
        />
      )}

      {!loading && !error && filteredList.length > 0 && (
        <DataTable
          columns={columns}
          data={filteredList}
          keyField="stats_name"
        />
      )}

      {/* Script Modal */}
      {activeModal &&
        createPortal(
          <div className={styles.scriptModalOverlay} onClick={() => setActiveModal(null)}>
            <div className={styles.scriptModal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.scriptModalHeader}>
                <h3 className={styles.scriptModalTitle}>{activeModal.title}</h3>
                <button
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  onClick={() => setActiveModal(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className={styles.scriptModalBody}>
                {activeModal.description && (
                  <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    {activeModal.description}
                  </p>
                )}
                <pre className={styles.scriptPre}>{activeModal.sql}</pre>
              </div>

              <div className={styles.scriptModalFooter}>
                <button
                  type="button"
                  className={styles.batchBtn}
                  onClick={() => handleCopyScript(activeModal.sql)}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Kopyalandı!' : 'T-SQL Betiğini Kopyala'}</span>
                </button>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => setActiveModal(null)}
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
