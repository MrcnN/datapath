import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Flame,
  Search,
  RefreshCw,
  Copy,
  Check,
  Zap,
  Terminal,
  ShieldCheck,
  ShieldAlert,
  Sliders,
  X,
  FileCode,
  ArrowUpRight,
  Database as DbIcon,
  Layers,
  Lock,
  Unlock,
} from 'lucide-react';
import styles from './AdaptiveBaselineStudio.module.css';
import { getAdaptiveBaselines, getDatabases } from '../../../lib/api';
import type {
  AdaptiveBaselineResponse,
  AdaptiveQueryRegression,
  BaselineTrendPoint,
  Database,
} from '../../../lib/types';
import DataTable, { type Column } from '../../../components/ui/DataTable';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';

function Sparkline({ points }: { points: BaselineTrendPoint[] }) {
  if (!points || points.length === 0) return null;
  const maxVal = Math.max(...points.map((p) => p.duration_ms), 1);
  const minVal = Math.min(...points.map((p) => p.duration_ms), 0);
  const range = maxVal - minVal || 1;
  const width = 110;
  const height = 30;

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (width - 8) + 4;
    const y = height - 4 - ((p.duration_ms - minVal) / range) * (height - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${coords.join(' L ')}`;
  const lastPoint = points[points.length - 1];
  const isLastAnomaly = lastPoint?.is_anomaly;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        <path
          d={pathD}
          fill="none"
          stroke={isLastAnomaly ? '#ef4444' : 'var(--accent-blue)'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => {
          const x = (i / (points.length - 1)) * (width - 8) + 4;
          const y = height - 4 - ((p.duration_ms - minVal) / range) * (height - 8);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={p.is_anomaly ? 3.5 : 2}
              fill={p.is_anomaly ? '#ef4444' : 'var(--accent-blue)'}
            />
          );
        })}
      </svg>
      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>7 Günlük Trend</span>
    </div>
  );
}

export default function AdaptiveBaselineStudio() {
  const [data, setData] = useState<AdaptiveBaselineResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [selectedDb, setSelectedDb] = useState<string>('');
  const [databases, setDatabases] = useState<Database[]>([]);
  const [modalSql, setModalSql] = useState<{ title: string; desc: string; sql: string } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdaptiveBaselines(selectedDb || undefined, severityFilter);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Adaptive baseline verileri alınırken hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, [selectedDb, severityFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    async function loadDbs() {
      try {
        const dbs = await getDatabases();
        setDatabases(dbs || []);
      } catch (e) {
        // ignore
      }
    }
    loadDbs();
  }, []);

  const handleCopy = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <LoadingSpinner message="Query Store üzerinden adaptif baseline güven aralıkları (Mean ± 2σ) hesaplanıyor..." />;
  }

  if (error || !data) {
    return <ErrorState message={error || 'Baseline verileri alınamadı.'} onRetry={loadData} />;
  }

  const { summary, regressions, recommendations } = data;

  const filteredRegressions = regressions.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(r.query_id).includes(q) ||
      r.query_hash.toLowerCase().includes(q) ||
      r.query_text_snippet.toLowerCase().includes(q) ||
      r.database_name.toLowerCase().includes(q) ||
      r.regression_type_label.toLowerCase().includes(q) ||
      r.root_cause_diagnosis.toLowerCase().includes(q)
    );
  });

  const columns: Column<AdaptiveQueryRegression>[] = [
    {
      key: 'query_text_snippet',
      label: 'Sorgu & Kategori',
      sortable: false,
      render: (r) => (
        <div style={{ maxWidth: '420px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--accent-blue)', fontWeight: 600 }}>
              Query #{r.query_id} ({r.database_name})
            </span>
            <span
              style={{
                fontSize: '10.5px',
                padding: '1px 6px',
                borderRadius: '4px',
                background:
                  r.regression_type === 'PLAN_CHANGE'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : r.regression_type === 'PARAMETER_SNIFFING'
                    ? 'rgba(234, 179, 8, 0.15)'
                    : 'rgba(59, 130, 246, 0.15)',
                color:
                  r.regression_type === 'PLAN_CHANGE'
                    ? 'var(--status-danger)'
                    : r.regression_type === 'PARAMETER_SNIFFING'
                    ? '#eab308'
                    : 'var(--accent-blue)',
                fontWeight: 600,
              }}
            >
              {r.regression_type_label}
            </span>
            <span
              style={{
                fontSize: '10px',
                padding: '1px 5px',
                borderRadius: '3px',
                background:
                  r.severity === 'CRITICAL'
                    ? 'rgba(239, 68, 68, 0.2)'
                    : r.severity === 'HIGH'
                    ? 'rgba(234, 179, 8, 0.2)'
                    : 'rgba(255, 255, 255, 0.08)',
                color:
                  r.severity === 'CRITICAL'
                    ? 'var(--status-danger)'
                    : r.severity === 'HIGH'
                    ? '#eab308'
                    : 'var(--text-muted)',
                fontWeight: 700,
              }}
            >
              {r.severity}
            </span>
          </div>
          <pre className={styles.queryCode}>{r.query_text_snippet}</pre>
        </div>
      ),
    },
    {
      key: 'current_duration_ms',
      label: 'Güncel vs Baseline Süre',
      sortable: true,
      render: (r) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--status-danger)' }}>
              {r.current_duration_ms.toFixed(1)} ms
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--status-danger)',
                background: 'rgba(239, 68, 68, 0.1)',
                padding: '1px 4px',
                borderRadius: '4px',
              }}
            >
              +{r.duration_delta_pct > 9999 ? '>9999%' : `${r.duration_delta_pct.toFixed(0)}%`}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Tarihsel Baseline: {r.baseline_duration_ms.toFixed(1)} ms
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            CPU: {r.current_cpu_ms.toFixed(1)} ms (Base: {r.baseline_cpu_ms.toFixed(1)} ms)
          </div>
        </div>
      ),
    },
    {
      key: 'z_score',
      label: 'İstatistiksel Sapma (Z-Score)',
      sortable: true,
      render: (r) => (
        <div>
          <div style={{ fontWeight: 700, color: r.z_score >= 3.0 ? 'var(--status-danger)' : '#eab308' }}>
            +{r.z_score.toFixed(2)}σ
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Üst Güven Sınırı: {r.upper_bound_ms.toFixed(1)} ms
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
            Okuma: {r.current_logical_reads.toLocaleString()} (Base: {r.baseline_logical_reads.toLocaleString()})
          </div>
        </div>
      ),
    },
    {
      key: 'current_plan_id',
      label: 'Yürütme Planı & Zorlama',
      sortable: true,
      render: (r) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
              Plan {r.baseline_plan_id} →{' '}
              <strong style={{ color: r.current_plan_id !== r.baseline_plan_id ? 'var(--status-danger)' : 'inherit' }}>
                Plan {r.current_plan_id}
              </strong>
            </span>
          </div>
          <div style={{ marginTop: '4px' }}>
            {r.is_plan_forced ? (
              <span
                style={{
                  fontSize: '10.5px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'rgba(34, 197, 94, 0.15)',
                  color: 'var(--status-success)',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Lock size={11} /> Plan Zorlandı (Forced)
              </span>
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Serbest Plan Seçimi</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'trend_points',
      label: 'Trend Grafiği',
      render: (r) => <Sparkline points={r.trend_points} />,
    },
    {
      key: 'severity',
      label: 'Prescription & Aksiyon',
      render: (r) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '130px' }}>
          {r.regression_type === 'PLAN_CHANGE' && (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnSuccess}`}
              onClick={() =>
                setModalSql({
                  title: `Query #${r.query_id} Plan Zorlama (sp_query_store_force_plan)`,
                  desc: `Sorgunun optimal çalışan Plan ${r.baseline_plan_id} yürütme planına kilitlenmesi için aşağıdaki T-SQL betiğini çalıştırabilirsiniz. Bu işlem parametre sapması veya plan bozulmasını anında tersine çevirir.`,
                  sql: r.force_plan_sql,
                })
              }
            >
              <Lock size={12} /> Planı Zorla ({r.baseline_plan_id})
            </button>
          )}

          {r.is_plan_forced && (
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() =>
                setModalSql({
                  title: `Query #${r.query_id} Plan Zorlamasını Kaldırma`,
                  desc: 'Mevcut zorlanmış plan kilidini kaldırmak için aşağıdaki betiği çalıştırın.',
                  sql: r.unforce_plan_sql,
                })
              }
            >
              <Unlock size={12} /> Plan Kilidini Aç
            </button>
          )}

          <button
            type="button"
            className={styles.actionBtn}
            onClick={() =>
              setModalSql({
                title: `Query #${r.query_id} Teşhis ve İyileştirme Planı`,
                desc: r.root_cause_diagnosis,
                sql: r.remediation_sql,
              })
            }
          >
            <FileCode size={12} /> Teşhis &amp; Reçete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      {/* Metric KPIs */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Değerlendirilen Sorgular</span>
            <div className={styles.kpiIconWrap} style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)' }}>
              <Layers size={17} />
            </div>
          </div>
          <div className={styles.kpiValue}>{summary.total_evaluated_queries.toLocaleString()}</div>
          <div className={styles.kpiSub}>Aktif Query Store sorgu planı</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Gerileyen Sorgular</span>
            <div
              className={styles.kpiIconWrap}
              style={{
                background: summary.regressed_queries_count > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                color: summary.regressed_queries_count > 0 ? 'var(--status-danger)' : 'var(--status-success)',
              }}
            >
              <TrendingUp size={17} />
            </div>
          </div>
          <div className={styles.kpiValue} style={{ color: summary.regressed_queries_count > 0 ? 'var(--status-danger)' : 'inherit' }}>
            {summary.regressed_queries_count}
          </div>
          <div className={styles.kpiSub}>Statik veya dinamik sapma yaşayan</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Kritik Regresyon (P1)</span>
            <div className={styles.kpiIconWrap} style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--status-danger)' }}>
              <Flame size={17} />
            </div>
          </div>
          <div className={styles.kpiValue} style={{ color: summary.critical_p1_count > 0 ? 'var(--status-danger)' : 'inherit' }}>
            {summary.critical_p1_count}
          </div>
          <div className={styles.kpiSub}>Süre artışı &gt;%100 veya Z &gt; 3σ</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Plan Değişimi Kaynaklı</span>
            <div className={styles.kpiIconWrap} style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}>
              <Lock size={17} />
            </div>
          </div>
          <div className={styles.kpiValue}>{summary.plan_change_regressions_count}</div>
          <div className={styles.kpiSub}>Plan Forcing ile düzeltilebilir</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>En Yüksek Süre Sıçraması</span>
            <div className={styles.kpiIconWrap} style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--status-danger)' }}>
              <ArrowUpRight size={17} />
            </div>
          </div>
          <div className={styles.kpiValue}>
            +{summary.max_duration_spike_pct.toFixed(0)}%
          </div>
          <div className={styles.kpiSub}>Baseline ortalamasına kıyasla</div>
        </div>
      </div>

      {/* Advisory & Recommendations Banner */}
      <div
        className={`${styles.alertBox} ${
          summary.overall_status === 'CRITICAL'
            ? styles.alertBoxCritical
            : summary.overall_status === 'WARNING'
            ? styles.alertBoxWarning
            : styles.alertBoxHealthy
        }`}
      >
        <AlertTriangle
          size={20}
          color={
            summary.overall_status === 'CRITICAL'
              ? 'var(--status-danger)'
              : summary.overall_status === 'WARNING'
              ? '#eab308'
              : 'var(--status-success)'
          }
        />
        <div className={styles.alertContent}>
          <strong>
            {summary.overall_status === 'CRITICAL'
              ? 'Kritik Performans Regresyonları Tespit Edildi (Query Store Baseline İhlali)'
              : summary.overall_status === 'WARNING'
              ? 'Orta Düzey Regresyonlar İzleniyor'
              : 'Tüm Sorgular İstatistiksel Baseline Güven Aralıklarında (Sağlıklı)'}
          </strong>
          <ul className={styles.recommendationsList}>
            {recommendations.map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.filterGroup}>
          <div className={styles.searchBox}>
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Sorgu metni, ID, hash veya veritabanı ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <select
            className={styles.selectInput}
            value={selectedDb}
            onChange={(e) => setSelectedDb(e.target.value)}
          >
            <option value="">Tüm Veritabanları</option>
            {databases.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>

          <div className={styles.pillBtnGroup}>
            {['ALL', 'CRITICAL', 'HIGH', 'MODERATE'].map((sev) => (
              <button
                key={sev}
                type="button"
                className={`${styles.pillBtn} ${severityFilter === sev ? styles.pillBtnActive : ''}`}
                onClick={() => setSeverityFilter(sev)}
              >
                {sev === 'ALL' ? 'Tümü' : sev === 'CRITICAL' ? 'Kritik (P1)' : sev === 'HIGH' ? 'Yüksek (P2)' : 'Orta (P3)'}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className={styles.refreshBtn} onClick={loadData}>
          <RefreshCw size={14} /> Yenile
        </button>
      </div>

      {/* Regressions Table */}
      <div className={styles.cardTable}>
        <DataTable
          columns={columns}
          data={filteredRegressions}
          emptyMessage="Kriterlere uygun performans regresyonu tespit edilmedi."
        />
      </div>

      {/* Modal Drawer for T-SQL Scripts */}
      {modalSql && (
        <div className={styles.modalOverlay} onClick={() => setModalSql(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                <Terminal size={16} color="var(--accent-blue)" />
                {modalSql.title}
              </div>
              <button type="button" className={styles.closeBtn} onClick={() => setModalSql(null)}>
                <X size={16} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalExplainer}>{modalSql.desc}</div>
              <pre className={styles.sqlPreWrap}>{modalSql.sql}</pre>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.actionBtn}
                style={{ padding: '7px 12px' }}
                onClick={() => setModalSql(null)}
              >
                Kapat
              </button>
              <button
                type="button"
                className={styles.copyPrimaryBtn}
                onClick={() => handleCopy(modalSql.sql)}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Kopyalandı' : 'T-SQL Betiğini Kopyala'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
