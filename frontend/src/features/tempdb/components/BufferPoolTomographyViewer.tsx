import React, { useState, useEffect } from 'react';
import {
  Layers,
  Database,
  RefreshCw,
  Clock,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Copy,
  Check,
} from 'lucide-react';
import DataTable, { type Column } from '../../../components/ui/DataTable';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import { getBufferPoolDrilldown, getDatabases } from '../../../lib/api';
import type {
  BufferPoolDrilldownResponse,
  BufferPoolDrilldownItem,
  Database as DatabaseType,
} from '../../../lib/types';
import styles from './BufferPoolTomographyViewer.module.css';

export default function BufferPoolTomographyViewer() {
  const [databases, setDatabases] = useState<DatabaseType[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>('master');
  const [data, setData] = useState<BufferPoolDrilldownResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCheckpoint, setCopiedCheckpoint] = useState<boolean>(false);

  useEffect(() => {
    async function loadDbs() {
      try {
        const dbs = await getDatabases();
        if (dbs && dbs.length > 0) {
          setDatabases(dbs);
          // Pick first user db if available
          const userDb = dbs.find((d) => !['master', 'model', 'msdb', 'tempdb'].includes(d.name));
          if (userDb) {
            setSelectedDb(userDb.name);
          }
        }
      } catch {
        // Fallback silently
      }
    }
    loadDbs();
  }, []);

  const loadDrilldown = async (db: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await getBufferPoolDrilldown(db);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Buffer Pool analizi yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDb) {
      loadDrilldown(selectedDb);
    }
  }, [selectedDb]);

  const handleCopyCheckpoint = () => {
    navigator.clipboard.writeText(`CHECKPOINT; -- [${selectedDb}] için kirli veri sayfalarını diske yaz`);
    setCopiedCheckpoint(true);
    setTimeout(() => setCopiedCheckpoint(false), 2000);
  };

  const columns: Column<BufferPoolDrilldownItem>[] = [
    {
      key: 'table',
      label: 'Tablo & Şema',
      sortable: true,
      render: (item) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {item.schema_name}.{item.table_name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {item.index_name || 'HEAP (Yığın)'} ({item.index_type})
          </div>
        </div>
      ),
    },
    {
      key: 'buffer_mb',
      label: 'RAM Boyutu (Buffer MB)',
      sortable: true,
      render: (item) => (
        <div>
          <span style={{ fontWeight: 700, color: 'var(--accent-primary, #3b82f6)' }}>
            {item.buffer_mb.toFixed(1)} MB
          </span>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            %{item.pct_of_database_cache.toFixed(1)} DB Önbelleği
          </div>
        </div>
      ),
    },
    {
      key: 'dirty_clean',
      label: 'Temiz / Kirli Sayfalar (Checkpoint)',
      render: (item) => {
        const total = item.clean_pages_mb + item.dirty_pages_mb || 1;
        const cleanPct = (item.clean_pages_mb / total) * 100;
        const dirtyPct = (item.dirty_pages_mb / total) * 100;
        return (
          <div className={styles.dirtyCleanWrap}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-muted)' }}>
              <span style={{ color: '#10b981' }}>Temiz: {item.clean_pages_mb.toFixed(1)} MB</span>
              <span style={{ color: item.dirty_pages_mb > 50 ? '#f59e0b' : 'var(--text-muted)' }}>
                Kirli: {item.dirty_pages_mb.toFixed(1)} MB
              </span>
            </div>
            <div className={styles.dirtyCleanBar}>
              <div className={styles.cleanSegment} style={{ width: `${cleanPct}%` }} title="Temiz (Okuma) Sayfaları" />
              <div className={styles.dirtySegment} style={{ width: `${dirtyPct}%` }} title="Diske yazılmayı bekleyen kirli sayfalar" />
            </div>
          </div>
        );
      },
    },
    {
      key: 'pages',
      label: 'Bellek Sayfası',
      sortable: true,
      render: (item) => (
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}>
          {item.page_count.toLocaleString()} syf
        </span>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Layers size={18} color="var(--accent-primary, #3b82f6)" />
          <div>
            <h3 className={styles.title}>
              Buffer Pool Bellek Tomografisi (Tablo & İndeks RAM Dağılımı)
            </h3>
            <span className={styles.subtitle}>
              Seçilen veritabanının RAM'deki veri sayfalarını (sys.dm_os_buffer_descriptors) ve Checkpoint bekleyen kirli alanları listeler.
            </span>
          </div>
        </div>

        <div className={styles.controls}>
          {databases.length > 0 && (
            <select
              className={styles.dbSelect}
              value={selectedDb}
              onChange={(e) => setSelectedDb(e.target.value)}
              title="RAM dağılımı incelenecek veritabanı"
            >
              {databases.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => loadDrilldown(selectedDb)}
            disabled={loading}
          >
            <RefreshCw size={13} />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {loading && <LoadingSpinner message="Buffer descriptors taranıyor ve RAM tahsis haritası çıkarılıyor..." />}
      {error && <ErrorState message={error} onRetry={() => loadDrilldown(selectedDb)} />}

      {!loading && !error && data && (
        <>
          {/* KPI Strip */}
          <div className={styles.kpiStrip}>
            <div className={styles.kpiBox}>
              <span className={styles.kpiLabel}>Toplam Önbellek (RAM)</span>
              <span className={styles.kpiVal}>{data.total_cached_mb.toFixed(1)} MB</span>
            </div>

            <div className={styles.kpiBox}>
              <span className={styles.kpiLabel}>Temiz Sayfalar (Clean)</span>
              <span className={styles.kpiVal} style={{ color: '#10b981' }}>
                {data.clean_pages_mb.toFixed(1)} MB
              </span>
            </div>

            <div className={styles.kpiBox}>
              <span className={styles.kpiLabel}>Kirli Sayfalar (Dirty - Unwritten)</span>
              <span className={styles.kpiVal} style={{ color: '#f59e0b' }}>
                {data.dirty_pages_mb.toFixed(1)} MB
              </span>
            </div>

            <div className={styles.kpiBox}>
              <span className={styles.kpiLabel}>Checkpoint Durumu</span>
              <span
                className={`${styles.kpiVal} ${
                  data.checkpoint_urgency === 'URGENT'
                    ? styles.urgencyUrgent
                    : data.checkpoint_urgency === 'MODERATE'
                    ? styles.urgencyModerate
                    : styles.urgencyHealthy
                }`}
              >
                {data.checkpoint_urgency === 'URGENT'
                  ? 'Ağır Kirli Veri'
                  : data.checkpoint_urgency === 'MODERATE'
                  ? 'Orta Seviye'
                  : 'Sağlıklı'}
              </span>
            </div>
          </div>

          {/* Table */}
          <DataTable
            columns={columns}
            data={data.items}
            emptyTitle="Önbellek Verisi Yok"
            emptyMessage={`[${selectedDb}] veritabanı için Buffer Pool'da aktif sayfa bulunamadı.`}
          />
        </>
      )}
    </div>
  );
}
