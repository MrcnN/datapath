import React, { useState, useEffect } from 'react';
import { AlertTriangle, GitCompare } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import DataTable, { type Column } from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import CodeBlock from '../../components/ui/CodeBlock';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import { getDatabases, compareSchemas } from '../../lib/api';
import type {
  Database,
  SchemaDiffResult,
  SchemaDifference,
} from '../../lib/types';
import styles from './SchemaDiffPage.module.css';

export default function SchemaDiffPage() {
  const [databases, setDatabases] = useState<Database[]>([]);
  const [sourceDb, setSourceDb] = useState<string>('');
  const [targetDb, setTargetDb] = useState<string>('');
  const [includeTables, setIncludeTables] = useState<boolean>(true);
  const [includeViews, setIncludeViews] = useState<boolean>(true);
  const [includeIndexes, setIncludeIndexes] = useState<boolean>(true);

  const [result, setResult] = useState<SchemaDiffResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDbs() {
      try {
        const dbs = await getDatabases();
        setDatabases(dbs);
        if (dbs.length >= 2) {
          setSourceDb(dbs[0].name);
          setTargetDb(dbs[1].name);
        } else if (dbs.length === 1) {
          setSourceDb(dbs[0].name);
          setTargetDb(dbs[0].name);
        }
      } catch {
        // demo data fallback
      }
    }
    loadDbs();
  }, []);

  const handleCompare = async () => {
    if (!sourceDb || !targetDb) return;
    setLoading(true);
    setError(null);
    try {
      const res = await compareSchemas({
        source_db: sourceDb,
        target_db: targetDb,
        include_tables: includeTables,
        include_views: includeViews,
        include_indexes: includeIndexes,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Şema karşılaştırması başarısız oldu');
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<SchemaDifference>[] = [
    {
      key: 'object_type',
      label: 'Nesne Türü',
      render: (d) => <StatusBadge variant="neutral" label={d.object_type} />,
    },
    {
      key: 'object_name',
      label: 'Nesne Adı',
      sortable: true,
      render: (d) => <strong>{d.object_name}</strong>,
    },
    {
      key: 'change_type',
      label: 'Değişiklik Türü',
      render: (d) => {
        const variant =
          d.change_type === 'added'
            ? 'success'
            : d.change_type === 'removed'
            ? 'error'
            : 'warning';
        const label =
          d.change_type === 'added'
            ? 'Eklendi'
            : d.change_type === 'removed'
            ? 'Silindi'
            : 'Değiştirildi';
        return <StatusBadge variant={variant} label={label} />;
      },
    },
    {
      key: 'details',
      label: 'Detaylar',
      render: (d) => {
        if (!d.details || d.details.length === 0) return '—';
        return (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {d.details.map((det) => `${det.field}: ${det.source_value || 'Yok'} -> ${det.target_value || 'Yok'}`).join(', ')}
          </span>
        );
      },
    },
  ];

  return (
    <div className={styles.container}>
      <PageHeader
        title="Şema Karşılaştırması (Schema Diff)"
        subtitle="İki veritabanı veya anlık görüntü arasındaki tablo, sütun, görünüm ve indeks farklarını inceleyin"
      />

      <div className={styles.controls}>
        <div className={styles.row}>
          <div className={styles.selectGroup}>
            <label className={styles.label}>Kaynak Veritabanı (Source)</label>
            <select
              className={styles.select}
              value={sourceDb}
              onChange={(e) => setSourceDb(e.target.value)}
            >
              {databases.map((db) => (
                <option key={db.name} value={db.name}>
                  {db.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.selectGroup}>
            <label className={styles.label}>Hedef Veritabanı (Target)</label>
            <select
              className={styles.select}
              value={targetDb}
              onChange={(e) => setTargetDb(e.target.value)}
            >
              {databases.map((db) => (
                <option key={db.name} value={db.name}>
                  {db.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className={styles.btnCompare}
            onClick={handleCompare}
            disabled={loading || !sourceDb || !targetDb}
          >
            {loading ? 'Karşılaştırılıyor...' : 'Şemaları Karşılaştır'}
          </button>
        </div>

        <div className={styles.options}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={includeTables}
              onChange={(e) => setIncludeTables(e.target.checked)}
            />
            Tablolar ve Sütunlar
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={includeViews}
              onChange={(e) => setIncludeViews(e.target.checked)}
            />
            Görünümler (Views)
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={includeIndexes}
              onChange={(e) => setIncludeIndexes(e.target.checked)}
            />
            İndeksler (Indexes)
          </label>
        </div>
      </div>

      {loading && <LoadingSpinner message="Şema nesneleri karşılaştırılıyor..." />}
      {error && <ErrorState message={error} onRetry={handleCompare} />}

      {!loading && result && (
        <>
          <div className={styles.summaryCards}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryCardTitle}>Eklenen Tablolar</span>
              <span className={styles.summaryCardVal}>{result.summary.tables_added}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryCardTitle}>Silinen Tablolar</span>
              <span className={styles.summaryCardVal}>{result.summary.tables_removed}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryCardTitle}>Sütun Farklılıkları</span>
              <span className={styles.summaryCardVal}>{result.summary.columns_changed}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryCardTitle}>Görünüm Değişiklikleri</span>
              <span className={styles.summaryCardVal}>
                {(result.summary.views_added || 0) + (result.summary.views_removed || 0)}
              </span>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={result.differences}
            emptyMessage="İki veritabanı şeması arasında hiçbir fark bulunamadı (birebir aynı)."
          />

          {result.generated_script && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div className={styles.warningBox}>
                <AlertTriangle size={18} />
                <span>
                  <strong>Güvenlik Uyarısı:</strong> Üretilen SQL betiği yalnızca inceleme amaçlıdır. Hiçbir zaman otomatik olarak yürütülmez. Canlı ortamlarda çalıştırmadan önce lütfen dikkatle kontrol edin.
                </span>
              </div>
              <CodeBlock code={result.generated_script} language="sql" maxLines={20} />
            </div>
          )}
        </>
      )}

      {!loading && !result && !error && (
        <EmptyState
          title="Karşılaştırmaya Başlayın"
          message="Karşılaştırmak istediğiniz kaynak ve hedef veritabanlarını seçip 'Şemaları Karşılaştır' butonuna tıklayın."
        />
      )}
    </div>
  );
}
