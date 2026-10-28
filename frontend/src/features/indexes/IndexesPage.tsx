import React, { useState, useEffect } from 'react';
import { Layers, AlertCircle, Trash2, RefreshCw, Code2, Database as DbIcon } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import DataTable, { type Column } from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import CodeBlock from '../../components/ui/CodeBlock';
import DemoDataBanner from '../../components/ui/DemoDataBanner';
import CopyButton from '../../components/ui/CopyButton';
import {
  getIndexSummary,
  getMissingIndexes,
  getUnusedIndexes,
  getIndexFragmentation,
  getDatabases,
} from '../../lib/api';
import type {
  IndexSummary,
  MissingIndex,
  UnusedIndex,
  IndexFragmentation,
  Database,
} from '../../lib/types';
import styles from './IndexesPage.module.css';

type TabType = 'missing' | 'unused' | 'fragmentation';

export default function IndexesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('missing');
  const [summary, setSummary] = useState<IndexSummary | null>(null);
  const [missingIndexes, setMissingIndexes] = useState<MissingIndex[]>([]);
  const [unusedIndexes, setUnusedIndexes] = useState<UnusedIndex[]>([]);
  const [fragmentationList, setFragmentationList] = useState<IndexFragmentation[]>([]);
  const [databases, setDatabases] = useState<Database[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeScript, setActiveScript] = useState<{ title: string; sql: string } | null>(null);

  useEffect(() => {
    async function initDbs() {
      try {
        const dbs = await getDatabases();
        setDatabases(dbs);
      } catch {
        // Fallback silently if offline
      }
    }
    initDbs();
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const sum = await getIndexSummary(selectedDb || undefined);
        setSummary(sum);

        if (activeTab === 'missing') {
          const missing = await getMissingIndexes(selectedDb || undefined);
          setMissingIndexes(missing);
        } else if (activeTab === 'unused') {
          const unused = await getUnusedIndexes(selectedDb || undefined);
          setUnusedIndexes(unused);
        } else if (activeTab === 'fragmentation') {
          const frag = await getIndexFragmentation(selectedDb || undefined);
          setFragmentationList(frag);
        }
      } catch (err: any) {
        setError(err.message || 'İndeks verileri alınırken hata oluştu.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeTab, selectedDb]);

  // Columns for Missing Indexes
  const missingColumns: Column<MissingIndex>[] = [
    {
      key: 'table_name',
      label: 'Tablo',
      sortable: true,
      render: (m) => (
        <div>
          <strong style={{ color: '#ffffff' }}>{m.table_name}</strong>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {m.schema_name}.{m.table_name}
          </div>
        </div>
      ),
    },
    {
      key: 'impact_score',
      label: 'Etki Skoru (Impact)',
      sortable: true,
      render: (m) => {
        const score = m.impact_score;
        const variant = score >= 75 ? 'error' : score >= 40 ? 'warning' : 'info';
        return <StatusBadge variant={variant} label={`${score.toFixed(1)} / 100`} />;
      },
    },
    {
      key: 'columns',
      label: 'Eşitlik / Aralık Kolonları',
      render: (m) => (
        <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
          {m.equality_columns && <span style={{ color: 'var(--accent)' }}>{m.equality_columns} </span>}
          {m.inequality_columns && <span style={{ color: '#f59e0b' }}>{m.inequality_columns}</span>}
          {!m.equality_columns && !m.inequality_columns && <span style={{ color: 'var(--text-muted)' }}>—</span>}
        </div>
      ),
    },
    {
      key: 'included_columns',
      label: 'Dahil Kolonlar (INCLUDE)',
      render: (m) => (
        <div style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
          {m.included_columns || '—'}
        </div>
      ),
    },
    {
      key: 'user_seeks',
      label: 'Beklenen Seek',
      sortable: true,
      render: (m) => m.user_seeks.toLocaleString(),
    },
    {
      key: 'actions',
      label: 'İşlem',
      render: (m) => (
        <button
          type="button"
          className={styles.tabBtn}
          style={{ padding: '4px 10px', fontSize: '11px' }}
          onClick={() =>
            setActiveScript({
              title: `CREATE INDEX Önerisi — ${m.table_name}`,
              sql: m.create_statement,
            })
          }
        >
          <Code2 size={13} />
          SQL İncele
        </button>
      ),
    },
  ];

  // Columns for Unused Indexes
  const unusedColumns: Column<UnusedIndex>[] = [
    {
      key: 'table_name',
      label: 'Tablo / İndeks',
      sortable: true,
      render: (u) => (
        <div>
          <strong style={{ color: '#ffffff' }}>{u.index_name}</strong>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {u.schema_name}.{u.table_name} ({u.index_type})
          </div>
        </div>
      ),
    },
    {
      key: 'size_mb',
      label: 'Boyut',
      sortable: true,
      render: (u) => `${u.size_mb.toFixed(1)} MB`,
    },
    {
      key: 'read_writes_ratio',
      label: 'Okuma / Yazma Oranı',
      render: (u) => (
        <div>
          <span style={{ color: '#ef4444', fontWeight: 600 }}>0 Okuma</span>
          <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>/</span>
          <span style={{ color: '#f59e0b' }}>{u.user_updates.toLocaleString()} Yazma</span>
        </div>
      ),
    },
    {
      key: 'user_updates',
      label: 'Yazma Maliyeti (Updates)',
      sortable: true,
      render: (u) => (
        <StatusBadge
          variant="warning"
          label={`${u.user_updates.toLocaleString()} updates`}
        />
      ),
    },
    {
      key: 'actions',
      label: 'İşlem',
      render: (u) => (
        <button
          type="button"
          className={styles.tabBtn}
          style={{ padding: '4px 10px', fontSize: '11px', color: '#ef4444' }}
          onClick={() =>
            setActiveScript({
              title: `DROP INDEX Önerisi — ${u.index_name}`,
              sql: u.drop_statement,
            })
          }
        >
          <Trash2 size={13} />
          Kaldırma Betiği
        </button>
      ),
    },
  ];

  // Columns for Index Fragmentation
  const fragColumns: Column<IndexFragmentation>[] = [
    {
      key: 'table_name',
      label: 'Tablo / İndeks',
      sortable: true,
      render: (f) => (
        <div>
          <strong style={{ color: '#ffffff' }}>{f.index_name}</strong>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {f.schema_name}.{f.table_name} ({f.index_type})
          </div>
        </div>
      ),
    },
    {
      key: 'avg_fragmentation_percent',
      label: 'Parçalanma (Fragmentation)',
      sortable: true,
      render: (f) => {
        const pct = f.avg_fragmentation_percent;
        const fillColor = pct >= 30 ? '#ef4444' : pct >= 10 ? '#f59e0b' : '#10b981';
        return (
          <div className={styles.fragBarWrapper}>
            <div className={styles.fragBar}>
              <div
                className={styles.fragBarFill}
                style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: fillColor }}
              />
            </div>
            <span style={{ fontWeight: 600, fontSize: '12px', color: fillColor }}>
              %{pct.toFixed(1)}
            </span>
          </div>
        );
      },
    },
    {
      key: 'recommended_action',
      label: 'Önerilen Aksiyon',
      sortable: true,
      render: (f) => {
        const act = f.recommended_action;
        const variant = act === 'REBUILD' ? 'error' : act === 'REORGANIZE' ? 'warning' : 'success';
        return <StatusBadge variant={variant} label={act} />;
      },
    },
    {
      key: 'page_count',
      label: 'Sayfa / Boyut',
      sortable: true,
      render: (f) => `${f.page_count.toLocaleString()} syf (${f.size_mb.toFixed(1)} MB)`,
    },
    {
      key: 'actions',
      label: 'İşlem',
      render: (f) => (
        <button
          type="button"
          className={styles.tabBtn}
          style={{ padding: '4px 10px', fontSize: '11px' }}
          onClick={() =>
            setActiveScript({
              title: `Bakım Betiği — ${f.index_name}`,
              sql: f.maintenance_statement,
            })
          }
        >
          <RefreshCw size={13} />
          Bakım Betiği
        </button>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <PageHeader
        title="İndeks Zekası & Sağlığı"
        subtitle="Eksik indeks tespiti, kullanılmayan indekslerin maliyeti ve parçalanma (fragmentation) optimizasyonu"
      />

      {summary?.is_demo && <DemoDataBanner />}

      {/* KPI Cards */}
      {summary && (
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiTitle}>Eksik İndeks Fırsatları</div>
            <div className={styles.kpiValue} style={{ color: 'var(--accent)' }}>
              {summary.total_missing_indexes}
            </div>
            <div className={styles.kpiSub}>
              Maksimum Etki Skoru: <strong>{summary.max_impact_score.toFixed(1)}%</strong>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiTitle}>Kullanılmayan İndeksler</div>
            <div className={styles.kpiValue} style={{ color: '#f59e0b' }}>
              {summary.total_unused_indexes}
            </div>
            <div className={styles.kpiSub}>
              Gereksiz Alan: <strong>{summary.total_wasted_mb} MB</strong>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiTitle}>Kritik Parçalanmış İndeksler</div>
            <div className={styles.kpiValue} style={{ color: '#ef4444' }}>
              {summary.fragmented_indexes_count}
            </div>
            <div className={styles.kpiSub}>Rebuild / Reorganize gerektirir</div>
          </div>
        </div>
      )}

      {/* Controls: Database selection & Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'missing' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('missing')}
          >
            <AlertCircle size={15} />
            Eksik İndeksler ({summary?.total_missing_indexes ?? 0})
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'unused' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('unused')}
          >
            <Trash2 size={15} />
            Kullanılmayan İndeksler ({summary?.total_unused_indexes ?? 0})
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'fragmentation' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('fragmentation')}
          >
            <Layers size={15} />
            Parçalanma Analizi
          </button>
        </div>

        {databases.length > 0 && (
          <div className={styles.controls}>
            <DbIcon size={14} style={{ color: 'var(--text-muted)' }} />
            <label htmlFor="db-select">Veritabanı:</label>
            <select
              id="db-select"
              className={styles.select}
              value={selectedDb}
              onChange={(e) => setSelectedDb(e.target.value)}
            >
              <option value="">Tüm Veritabanları</option>
              {databases.map((db) => (
                <option key={db.name} value={db.name}>
                  {db.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Active SQL Script Drawer / Modal View */}
      {activeScript && (
        <div className={styles.scriptModal}>
          <div className={styles.scriptHeader}>
            <strong>{activeScript.title}</strong>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <CopyButton text={activeScript.sql} label="Betiği Kopyala" />
              <button
                type="button"
                className={styles.tabBtn}
                style={{ padding: '2px 8px', fontSize: '11px' }}
                onClick={() => setActiveScript(null)}
              >
                Kapat
              </button>
            </div>
          </div>
          <CodeBlock code={activeScript.sql} language="sql" />
          <div style={{ fontSize: '11px', color: '#f59e0b' }}>
            ⚠️ <strong>Güvenlik İlkesi:</strong> Datapath asla üretim ortamlarında otomatik indeks oluşturmaz veya silmez. Önerilen betiği kopyalayıp DBA onayından sonra çalıştırınız.
          </div>
        </div>
      )}

      {/* Content Area */}
      {loading ? (
        <LoadingSpinner label="İndeks istatistikleri ve DMV analizleri yükleniyor..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => setActiveTab(activeTab)} />
      ) : (
        <>
          {activeTab === 'missing' && (
            missingIndexes.length === 0 ? (
              <EmptyState title="Eksik İndeks Bulunamadı" message="SQL Server sorgu iyileştiricisi henüz kritik bir eksik indeks önerisi kaydetmedi." />
            ) : (
              <DataTable data={missingIndexes} columns={missingColumns} />
            )
          )}

          {activeTab === 'unused' && (
            unusedIndexes.length === 0 ? (
              <EmptyState title="Kullanılmayan İndeks Yok" message="Mevcut indekslerin tamamı sorgular tarafından aktif olarak okunuyor." />
            ) : (
              <DataTable data={unusedIndexes} columns={unusedColumns} />
            )
          )}

          {activeTab === 'fragmentation' && (
            fragmentationList.length === 0 ? (
              <EmptyState title="Parçalanma Verisi Yok" message="İncelenen veritabanında taranabilecek kullanıcı indeksi bulunamadı." />
            ) : (
              <DataTable data={fragmentationList} columns={fragColumns} />
            )
          )}
        </>
      )}
    </div>
  );
}
