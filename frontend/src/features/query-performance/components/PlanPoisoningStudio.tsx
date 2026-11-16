import React, { useState, useEffect } from 'react';
import {
  AlertOctagon,
  Flame,
  Zap,
  Copy,
  Check,
  RefreshCw,
  FileCode,
  X,
  Sliders,
  ShieldAlert,
  Clock,
  Cpu,
  Database as DbIcon,
  Search,
  Layers,
  ArrowRight,
  Info,
} from 'lucide-react';
import DataTable, { type Column } from '../../../components/ui/DataTable';
import CodeBlock from '../../../components/ui/CodeBlock';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';
import { getPlanPoisoningAnalysis, getDatabases } from '../../../lib/api';
import type { PlanPoisoningResponse, PoisonedQueryItem, Database } from '../../../lib/types';
import styles from './PlanPoisoningStudio.module.css';

export default function PlanPoisoningStudio() {
  const [data, setData] = useState<PlanPoisoningResponse | null>(null);
  const [databases, setDatabases] = useState<Database[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>('');
  const [minVariance, setMinVariance] = useState<number>(5.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');

  // Remediation Modal State
  const [selectedItem, setSelectedItem] = useState<PoisonedQueryItem | null>(null);
  const [modalTab, setModalTab] = useState<'surgical' | 'db_clear' | 'recompile' | 'hint'>('surgical');
  const [copied, setCopied] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getPlanPoisoningAnalysis(selectedDb || undefined, minVariance);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Plan zehirlenmesi analizi yapılırken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function loadDbs() {
      try {
        const dbs = await getDatabases();
        setDatabases(dbs);
      } catch (e) {
        // ignore
      }
    }
    loadDbs();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedDb, minVariance]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredItems = (data?.items || []).filter((item) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      item.statement_text.toLowerCase().includes(s) ||
      (item.object_name && item.object_name.toLowerCase().includes(s)) ||
      (item.database_name && item.database_name.toLowerCase().includes(s)) ||
      item.plan_handle.toLowerCase().includes(s)
    );
  });

  const columns: Column<PoisonedQueryItem>[] = [
    {
      key: 'statement_text',
      label: 'Sorgu / Prosedür',
      render: (item) => (
        <div style={{ maxWidth: 360 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            {item.object_name ? (
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                {item.object_name}
              </span>
            ) : (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Dinamik T-SQL
              </span>
            )}
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              ({item.database_name})
            </span>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={item.statement_text}
          >
            {item.statement_text}
          </div>
        </div>
      ),
    },
    {
      key: 'variance_ratio',
      label: 'Sapma Çarpanı',
      sortable: true,
      render: (item) => {
        const isCrit = item.severity === 'CRITICAL';
        const isHigh = item.severity === 'HIGH';
        const isMed = item.severity === 'MEDIUM';
        const cls = isCrit
          ? styles.varianceCritical
          : isHigh
          ? styles.varianceHigh
          : isMed
          ? styles.varianceMedium
          : styles.varianceLow;

        return (
          <span className={`${styles.variancePill} ${cls}`}>
            <Flame size={12} />
            {item.variance_ratio.toFixed(1)}x Sapma
          </span>
        );
      },
    },
    {
      key: 'min_elapsed_ms',
      label: 'Süre Dalgalanması',
      sortable: true,
      render: (item) => (
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
            <span style={{ color: '#10b981', fontWeight: 600 }}>{item.min_elapsed_ms} ms</span>
            {' ➔ '}
            <span style={{ color: '#ef4444', fontWeight: 600 }}>{item.max_elapsed_ms.toLocaleString()} ms</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Ort: {item.avg_elapsed_ms} ms ({item.execution_count} çalıştırma)
          </div>
        </div>
      ),
    },
    {
      key: 'min_cpu_ms',
      label: 'CPU Sapması',
      sortable: true,
      render: (item) => (
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
            <span style={{ color: '#10b981' }}>{item.min_cpu_ms} ms</span>
            {' ➔ '}
            <span style={{ color: '#ef4444' }}>{item.max_cpu_ms.toLocaleString()} ms</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {item.cpu_variance_ratio.toFixed(1)}x CPU Farka
          </div>
        </div>
      ),
    },
    {
      key: 'min_logical_reads',
      label: 'Mantıksal Okuma',
      render: (item) => (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          {item.min_logical_reads.toLocaleString()} ➔ {item.max_logical_reads.toLocaleString()} sayfa
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Cerrahi Müdahale',
      render: (item) => (
        <button
          className={styles.btnPrimary}
          onClick={() => {
            setSelectedItem(item);
            setModalTab('surgical');
          }}
        >
          <Zap size={13} />
          Planı Tahliye Et
        </button>
      ),
    },
  ];

  const getActiveModalScript = (): string => {
    if (!selectedItem) return '';
    if (modalTab === 'surgical') return selectedItem.surgical_eviction_tsql;
    if (modalTab === 'db_clear') return selectedItem.database_scoped_clear_tsql;
    if (modalTab === 'recompile') return selectedItem.sp_recompile_tsql;
    if (modalTab === 'hint') return selectedItem.permanent_hint_tsql;
    return '';
  };

  return (
    <div className={styles.studio}>
      {/* 1. Header Card */}
      <div className={styles.headerCard}>
        <div className={styles.titleArea}>
          <div className={styles.titleRow}>
            <AlertOctagon size={20} color="#ef4444" />
            <h3 className={styles.title}>Parametre Koklama (Sniffing) & Cerrahi Plan Tahliyesi</h3>
            <span className={styles.badgeLive}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              Live DMV
            </span>
          </div>
          <p className={styles.subtitle}>
            Önbellekte parametre sapması nedeniyle aşırı süre veya CPU farkı üreten zehirlenmiş planları tespit eder. 
            Tüm önbelleği sıfırlamak yerine <code style={{ color: 'var(--text-primary)' }}>DBCC FREEPROCCACHE (plan_handle)</code> ile noktasal tahliye sağlar.
          </p>
        </div>

        <div className={styles.actionsArea}>
          <select
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

          <select
            className={styles.select}
            value={minVariance}
            onChange={(e) => setMinVariance(Number(e.target.value))}
          >
            <option value={5.0}>En az 5x Süre Sapması</option>
            <option value={10.0}>En az 10x Süre Sapması (Yüksek)</option>
            <option value={25.0}>En az 25x Süre Sapması (Kritik)</option>
            <option value={50.0}>En az 50x Süre Sapması (Aşırı)</option>
          </select>

          <button className={styles.btnSecondary} onClick={fetchData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Yenile
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      {data && (
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span>Zehirlenmiş / Şüpheli Planlar</span>
              <AlertOctagon size={16} color="#ef4444" />
            </div>
            <div className={styles.kpiValue}>
              {data.summary.total_suspect_queries}
              <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)' }}>Sorgu</span>
            </div>
            <div className={styles.kpiFooter}>
              Eşik: {minVariance}x minimum sapma
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span>Kritik Sapma (&gt;30x)</span>
              <Flame size={16} color="#f59e0b" />
            </div>
            <div className={styles.kpiValue} style={{ color: data.summary.critical_count > 0 ? '#ef4444' : '#10b981' }}>
              {data.summary.critical_count}
              <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)' }}>Kritik</span>
            </div>
            <div className={styles.kpiFooter}>
              Ağır parametre koklama riski
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span>En Yüksek Süre Sapması</span>
              <Clock size={16} color="var(--primary-color, #2563eb)" />
            </div>
            <div className={styles.kpiValue}>
              {data.summary.highest_variance_ratio.toFixed(1)}x
            </div>
            <div className={styles.kpiFooter}>
              Ortalama: {data.summary.avg_variance_ratio.toFixed(1)}x fark
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span>PSP Optimizasyonu (SQL 2022)</span>
              <Zap size={16} color={data.summary.psp_optimization_enabled ? '#10b981' : 'var(--text-muted)'} />
            </div>
            <div className={styles.kpiValue} style={{ fontSize: '1.05rem' }}>
              {data.summary.psp_optimization_enabled ? 'Aktif (Otomatik Koruma)' : 'Pasif / Desteklenmiyor'}
            </div>
            <div className={styles.kpiFooter}>
              SQL Server {data.summary.sql_major_version} Motoru
            </div>
          </div>
        </div>
      )}

      {/* 3. Search and DataTable */}
      {loading && !data ? (
        <LoadingSpinner message="Plan önbelleği (sys.dm_exec_query_stats) parametre varyansı taranıyor..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
              Tespit Edilen Kararsız Yürütme Planları ({filteredItems.length})
            </span>
            <div style={{ position: 'relative', width: 260 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Sorgu, nesne veya plan handle ara..."
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
              title="Zehirlenmiş Plan Tespit Edilmedi"
              message={`Seçilen eşik (${minVariance}x) üzerinde süre dalgalanması gösteren parametre koklama planı bulunamadı. Önbelleğiniz stabil görünüyor.`}
            />
          ) : (
            <DataTable data={filteredItems} columns={columns} />
          )}
        </div>
      )}

      {/* 4. Surgical Remediation Modal */}
      {selectedItem && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedItem(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h4 className={styles.modalTitle}>
                <Zap size={18} color="var(--primary-color, #2563eb)" />
                Cerrahi Plan Tahliye & Müdahale Paketi
              </h4>
              <button className={styles.modalCloseBtn} onClick={() => setSelectedItem(null)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div style={{ background: 'var(--bg-subtle)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                  <strong>Teşhis:</strong> {selectedItem.diagnosis}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Plan Handle: {selectedItem.plan_handle}
                </div>
              </div>

              <div className={styles.modalTabs}>
                <button
                  className={`${styles.modalTabBtn} ${modalTab === 'surgical' ? styles.modalTabBtnActive : ''}`}
                  onClick={() => setModalTab('surgical')}
                >
                  Noktasal Plan Tahliyesi (Önerilen)
                </button>
                <button
                  className={`${styles.modalTabBtn} ${modalTab === 'db_clear' ? styles.modalTabBtnActive : ''}`}
                  onClick={() => setModalTab('db_clear')}
                >
                  Veritabanı Kapsamlı Tahliye
                </button>
                <button
                  className={`${styles.modalTabBtn} ${modalTab === 'recompile' ? styles.modalTabBtnActive : ''}`}
                  onClick={() => setModalTab('recompile')}
                >
                  sp_recompile
                </button>
                <button
                  className={`${styles.modalTabBtn} ${modalTab === 'hint' ? styles.modalTabBtnActive : ''}`}
                  onClick={() => setModalTab('hint')}
                >
                  Kalıcı İpucu (Hint) Çözümleri
                </button>
              </div>

              <div className={styles.codeArea}>
                <CodeBlock code={getActiveModalScript()} language="sql" />
              </div>

              <div className={styles.safeNotice}>
                <Info size={16} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  <strong>Neden Cerrahi Tahliye?</strong> Tüm sunucuda <code style={{ color: 'var(--text-primary)' }}>DBCC FREEPROCCACHE</code> çalıştırmak 
                  tüm önbelleği sıfırlayarak büyük bir derleme CPU fırtınasına yol açar. Yukarıdaki cerrahi komut yalnızca bu zehirlenmiş planı bellekten tahliye eder, diğer binlerce sağlıklı planı korur.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <button className={styles.btnSecondary} onClick={() => setSelectedItem(null)}>
                  Kapat
                </button>
                <button className={styles.btnPrimary} onClick={() => handleCopy(getActiveModalScript())}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Kopyalandı' : 'T-SQL Betiğini Kopyala'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
