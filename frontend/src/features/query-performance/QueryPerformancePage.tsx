import React, { useState, useEffect } from 'react';
import PageHeader from '../../components/layout/PageHeader';
import DataTable, { type Column } from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import {
  getQueryStoreOverview,
  getExpensiveQueries,
  getDatabases,
} from '../../lib/api';
import type {
  QueryStoreOverview,
  ExpensiveQuery,
  Database,
} from '../../lib/types';
import styles from './QueryPerformancePage.module.css';

export default function QueryPerformancePage() {
  const [databases, setDatabases] = useState<Database[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>('');
  const [overview, setOverview] = useState<QueryStoreOverview | null>(null);
  const [metric, setMetric] = useState<string>('cpu_time');
  const [topN, setTopN] = useState<number>(25);
  const [queries, setQueries] = useState<ExpensiveQuery[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const [dbs, qsOverview] = await Promise.all([
          getDatabases().catch(() => []),
          getQueryStoreOverview().catch(() => null),
        ]);
        setDatabases(dbs);
        setOverview(qsOverview);
        if (dbs.length > 0) {
          const firstValid = dbs.find((d) => d.name !== 'master' && d.name !== 'tempdb') || dbs[0];
          setSelectedDb(firstValid.name);
        }
      } catch (err: any) {
        setError(err.message || 'Başlangıç verileri yüklenemedi');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!selectedDb) return;
    async function loadQueries() {
      try {
        setLoading(true);
        setError(null);
        const data = await getExpensiveQueries({
          database: selectedDb,
          metric,
          top_n: topN,
        });
        setQueries(data);
      } catch (err: any) {
        setError(err.message || 'Maliyetli sorgular alınamadı');
      } finally {
        setLoading(false);
      }
    }
    loadQueries();
  }, [selectedDb, metric, topN]);

  const columns: Column<ExpensiveQuery>[] = [
    {
      key: 'query_id',
      label: 'Sorgu ID',
      width: '90px',
      render: (q) => `#${q.query_id}`,
    },
    {
      key: 'query_text_snippet',
      label: 'SQL Metni',
      render: (q) => (
        <span className={styles.snippet} title={q.query_text_snippet || undefined}>
          {q.query_text_snippet}
        </span>
      ),
    },
    {
      key: 'avg_cpu_ms',
      label: 'Ort. CPU (ms)',
      sortable: true,
      render: (q) => `${q.avg_cpu_ms?.toFixed(2) ?? '—'} ms`,
    },
    {
      key: 'avg_duration_ms',
      label: 'Ort. Süre (ms)',
      sortable: true,
      render: (q) => `${q.avg_duration_ms?.toFixed(2) ?? '—'} ms`,
    },
    {
      key: 'avg_logical_reads',
      label: 'Mantıksal Okuma',
      sortable: true,
      render: (q) => q.avg_logical_reads?.toLocaleString() ?? '—',
    },
    {
      key: 'execution_count',
      label: 'Çalışma Sayısı',
      sortable: true,
      render: (q) => q.execution_count?.toLocaleString() ?? '—',
    },
    {
      key: 'is_regressed',
      label: 'Gerileme',
      render: (q) =>
        q.is_regressed ? (
          <StatusBadge variant="error" label="Gerileme Var" />
        ) : (
          <StatusBadge variant="success" label="Normal" />
        ),
    },
  ];

  return (
    <div className={styles.container}>
      <PageHeader
        title="Sorgu Performansı (Query Store)"
        subtitle="Maliyetli sorgular, yürütme süreleri, CPU tüketimi ve gerileme analizleri"
      />

      {overview && (
        <div className={styles.overviewCard}>
          <div className={styles.metricItem}>
            <span className={styles.metricTitle}>Query Store Durumu</span>
            <span className={styles.metricVal}>
              {overview.enabled ? (overview.actual_state || 'Etkin') : 'Devre Dışı'}
            </span>
          </div>
          <div className={styles.metricItem}>
            <span className={styles.metricTitle}>Yakalama Modu (Capture)</span>
            <span className={styles.metricVal}>{overview.query_capture_mode || 'Auto'}</span>
          </div>
          <div className={styles.metricItem}>
            <span className={styles.metricTitle}>Depolama Boyutu</span>
            <span className={styles.metricVal}>
              {overview.current_storage_size_mb
                ? `${overview.current_storage_size_mb.toFixed(1)} MB`
                : '—'}
            </span>
          </div>
          <div className={styles.metricItem}>
            <span className={styles.metricTitle}>QS Etkin Veritabanı Sayısı</span>
            <span className={styles.metricVal}>{overview.databases_with_qs?.length || 0}</span>
          </div>
        </div>
      )}

      <div className={styles.controls}>
        <div className={styles.selectGroup}>
          <label className={styles.label}>Hedef Veritabanı</label>
          <select
            className={styles.select}
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

        <div className={styles.selectGroup}>
          <label className={styles.label}>Sıralama Metriği</label>
          <select
            className={styles.select}
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          >
            <option value="cpu_time">Ortalama CPU Süresi</option>
            <option value="duration">Ortalama Toplam Süre</option>
            <option value="logical_reads">Mantıksal Okuma (IO)</option>
            <option value="execution_count">Çalıştırma Sayısı</option>
          </select>
        </div>

        <div className={styles.selectGroup}>
          <label className={styles.label}>Kayıt Limiti</label>
          <select
            className={styles.select}
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value))}
          >
            <option value={10}>İlk 10 Sorgu</option>
            <option value={25}>İlk 25 Sorgu</option>
            <option value={50}>İlk 50 Sorgu</option>
          </select>
        </div>
      </div>

      {loading && <LoadingSpinner message="Maliyetli sorgu verileri alınıyor..." />}
      {error && <ErrorState message={error} onRetry={() => setSelectedDb(selectedDb)} />}

      {!loading && !error && queries.length === 0 && (
        <EmptyState
          title="Sorgu Verisi Bulunamadı"
          message="Bu veritabanında henüz Query Store verisi kaydedilmemiş veya filtreye uygun sorgu bulunmuyor."
        />
      )}

      {!loading && !error && queries.length > 0 && (
        <DataTable
          columns={columns}
          data={queries}
          emptyMessage="Sorgu bulunamadı."
        />
      )}
    </div>
  );
}
