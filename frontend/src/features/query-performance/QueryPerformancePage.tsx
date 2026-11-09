import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  TrendingUp,
  Hourglass,
  AlertTriangle,
  Flame,
  Cpu,
  Layers,
  GitCompare,
  Lightbulb,
  Search,
  Filter,
  CheckCircle2,
  Database as DbIcon,
  Activity,
  Code2,
  Copy,
  Check,
  Clock,
  ArrowUpRight,
  Wand2,
  Maximize2,
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import DataTable, { type Column } from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import DemoDataBanner from '../../components/ui/DemoDataBanner';
import {
  getQueryStoreOverview,
  getExpensiveQueries,
  getDatabases,
  getPlanAntiPatterns,
  getQueryRegressions,
} from '../../lib/api';
import type {
  QueryStoreOverview,
  ExpensiveQuery,
  Database,
  PlanAntiPatternsSummary,
  PlanWarningQuery,
  QueryRegression,
} from '../../lib/types';
import ExecutionPlanViewer from './components/ExecutionPlanViewer';
import QueryRewriterStudio from './components/QueryRewriterStudio';
import CardinalityDriftViewer from './components/CardinalityDriftViewer';
import WaitStatsPage from '../wait-stats/WaitStatsPage';
import styles from './QueryPerformancePage.module.css';

export default function QueryPerformancePage({ initialTab }: { initialTab?: 'PLAN_ANTI_PATTERNS' | 'QUERY_STORE' | 'REGRESSIONS' | 'PLAN_VIEWER' | 'REWRITER_STUDIO' | 'CARDINALITY_DRIFT' | 'WAITS' } = {}) {
  const location = useLocation();

  const resolveInitialTab = (): 'PLAN_ANTI_PATTERNS' | 'QUERY_STORE' | 'REGRESSIONS' | 'PLAN_VIEWER' | 'REWRITER_STUDIO' | 'CARDINALITY_DRIFT' | 'WAITS' => {
    if (initialTab) return initialTab;
    if (location.pathname === '/query-rewriter') return 'REWRITER_STUDIO';
    if (location.pathname === '/execution-plan') return 'PLAN_VIEWER';
    if (location.pathname === '/waits') return 'WAITS';
    return 'QUERY_STORE';
  };

  const [activeTab, setActiveTab] = useState<'PLAN_ANTI_PATTERNS' | 'QUERY_STORE' | 'REGRESSIONS' | 'PLAN_VIEWER' | 'REWRITER_STUDIO' | 'CARDINALITY_DRIFT' | 'WAITS'>(resolveInitialTab);

  useEffect(() => {
    if (location.pathname === '/query-rewriter') {
      setActiveTab('REWRITER_STUDIO');
    } else if (location.pathname === '/execution-plan') {
      setActiveTab('PLAN_VIEWER');
    } else if (location.pathname === '/waits') {
      setActiveTab('WAITS');
    }
  }, [location.pathname]);
  const [selectedPlanHandle, setSelectedPlanHandle] = useState<string | undefined>(undefined);

  // Plan Anti-Patterns State
  const [antiPatterns, setAntiPatterns] = useState<PlanAntiPatternsSummary | null>(null);
  const [antiPatternLoading, setAntiPatternLoading] = useState<boolean>(true);
  const [antiPatternError, setAntiPatternError] = useState<string | null>(null);
  const [warningFilter, setWarningFilter] = useState<'ALL' | 'SPILL' | 'CONVERT' | 'MISSING_INDEX' | 'GRANT'>('ALL');
  const [antiPatternSearch, setAntiPatternSearch] = useState<string>('');

  // Regressions State
  const [regressions, setRegressions] = useState<QueryRegression[]>([]);
  const [regLoading, setRegLoading] = useState<boolean>(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSearch, setRegSearch] = useState<string>('');
  const [selectedRegSql, setSelectedRegSql] = useState<{ title: string; sql: string } | null>(null);
  const [selectedRegression, setSelectedRegression] = useState<QueryRegression | null>(null);
  const [regScriptTab, setRegScriptTab] = useState<'force' | 'unforce' | 'diagnose'>('force');
  const [copied, setCopied] = useState<boolean>(false);
  const [selectedSqlDetail, setSelectedSqlDetail] = useState<{ id: number | string; sql: string; db?: string; cpu?: number | null; duration?: number | null } | null>(null);

  // Query Store State
  const [databases, setDatabases] = useState<Database[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>('');
  const [overview, setOverview] = useState<QueryStoreOverview | null>(null);
  const [metric, setMetric] = useState<string>('cpu_time');
  const [topN, setTopN] = useState<number>(25);
  const [queries, setQueries] = useState<ExpensiveQuery[]>([]);
  const [qsLoading, setQsLoading] = useState<boolean>(false);
  const [qsError, setQsError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPlanAntiPatterns() {
      try {
        setAntiPatternLoading(true);
        setAntiPatternError(null);
        const data = await getPlanAntiPatterns();
        setAntiPatterns(data);
      } catch (err: any) {
        setAntiPatternError(err.message || 'Plan tuzakları analizi alınamadı');
      } finally {
        setAntiPatternLoading(false);
      }
    }
    loadPlanAntiPatterns();
  }, []);

  useEffect(() => {
    async function loadRegs() {
      try {
        setRegLoading(true);
        setRegError(null);
        const data = await getQueryRegressions({ database: selectedDb || 'master' });
        setRegressions(data);
      } catch (err: any) {
        setRegError(err.message || 'Plan gerileme verileri alınamadı.');
      } finally {
        setRegLoading(false);
      }
    }
    loadRegs();
  }, [selectedDb]);

  const handleCopy = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    async function initQS() {
      try {
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
      } catch {
        // Handled silently
      }
    }
    initQS();
  }, []);

  useEffect(() => {
    if (!selectedDb) return;
    async function loadQueries() {
      try {
        setQsLoading(true);
        setQsError(null);
        const data = await getExpensiveQueries({
          database: selectedDb,
          metric,
          top_n: topN,
        });
        setQueries(data);
      } catch (err: any) {
        setQsError(err.message || 'Maliyetli sorgular alınamadı');
      } finally {
        setQsLoading(false);
      }
    }
    loadQueries();
  }, [selectedDb, metric, topN]);

  const filteredAntiPatterns = (antiPatterns?.queries || []).filter((q) => {
    const matchesSearch =
      !antiPatternSearch ||
      q.query_text.toLowerCase().includes(antiPatternSearch.toLowerCase()) ||
      q.database_name.toLowerCase().includes(antiPatternSearch.toLowerCase()) ||
      q.warning_details.toLowerCase().includes(antiPatternSearch.toLowerCase());

    let matchesType = true;
    if (warningFilter === 'SPILL') matchesType = q.warning_type.toLowerCase().includes('spill');
    else if (warningFilter === 'CONVERT') matchesType = q.warning_type.toLowerCase().includes('convert');
    else if (warningFilter === 'MISSING_INDEX') matchesType = q.warning_type.toLowerCase().includes('index');
    else if (warningFilter === 'GRANT') matchesType = q.warning_type.toLowerCase().includes('grant');

    return matchesSearch && matchesType;
  });

  const qsColumns: Column<ExpensiveQuery>[] = [
    {
      key: 'query_id',
      label: 'Sorgu ID',
      width: '90px',
      render: (q) => `#${q.query_id}`,
    },
    {
      key: 'query_text_snippet',
      label: 'SQL Metni',
      width: '42%',
      render: (q) => {
        const rawSql = q.query_text_snippet || '';
        const firstWord = rawSql.trim().split(/\s+/)[0]?.toUpperCase() || 'SQL';
        const verb = ['SELECT', 'UPDATE', 'INSERT', 'DELETE', 'EXEC', 'WITH', 'ALTER'].includes(firstWord)
          ? firstWord
          : 'SQL';

        const verbColor =
          verb === 'SELECT'
            ? { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)' }
            : verb === 'UPDATE'
            ? { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' }
            : verb === 'INSERT'
            ? { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' }
            : verb === 'DELETE'
            ? { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)' }
            : { bg: 'rgba(148, 163, 184, 0.15)', text: '#cbd5e1', border: 'rgba(148, 163, 184, 0.3)' };

        const singleLineSql = rawSql.replace(/\s+/g, ' ').trim();

        return (
          <div className={styles.sqlCell}>
            <span
              className={styles.verbBadge}
              style={{
                backgroundColor: verbColor.bg,
                color: verbColor.text,
                borderColor: verbColor.border,
              }}
            >
              {verb}
            </span>
            <span
              className={styles.sqlSnippetText}
              title="Tam SQL sorgusunu görüntülemek için tıklayın"
              onClick={() =>
                setSelectedSqlDetail({
                  id: q.query_id,
                  sql: rawSql,
                  db: selectedDb,
                  cpu: q.avg_cpu_ms,
                  duration: q.avg_duration_ms,
                })
              }
            >
              {singleLineSql}
            </span>
            <div className={styles.sqlActions}>
              <button
                type="button"
                className={styles.iconBtn}
                title="Panoya Kopyala"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy(rawSql);
                }}
              >
                <Copy size={12} />
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                title="Tam SQL İncele"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSqlDetail({
                    id: q.query_id,
                    sql: rawSql,
                    db: selectedDb,
                    cpu: q.avg_cpu_ms,
                    duration: q.avg_duration_ms,
                  });
                }}
              >
                <Maximize2 size={12} />
              </button>
            </div>
          </div>
        );
      },
    },
    {
      key: 'avg_cpu_ms',
      label: 'Ort. CPU (ms)',
      width: '105px',
      sortable: true,
      render: (q) => `${q.avg_cpu_ms?.toFixed(2) ?? '—'} ms`,
    },
    {
      key: 'avg_duration_ms',
      label: 'Ort. Süre (ms)',
      width: '110px',
      sortable: true,
      render: (q) => `${q.avg_duration_ms?.toFixed(2) ?? '—'} ms`,
    },
    {
      key: 'avg_logical_reads',
      label: 'Mantıksal Okuma',
      width: '120px',
      sortable: true,
      render: (q) => q.avg_logical_reads?.toLocaleString() ?? '—',
    },
    {
      key: 'execution_count',
      label: 'Çalışma Sayısı',
      width: '110px',
      sortable: true,
      render: (q) => q.execution_count?.toLocaleString() ?? '—',
    },
    {
      key: 'is_regressed',
      label: 'Gerileme',
      width: '115px',
      render: (q) =>
        q.is_regressed ? (
          <StatusBadge variant="error" label="Gerileme Var" />
        ) : (
          <StatusBadge variant="success" label="Normal" />
        ),
    },
  ];

  const regressionColumns: Column<QueryRegression>[] = [
    {
      key: 'query_id',
      label: 'Sorgu ID & DB',
      sortable: true,
      render: (r) => (
        <div>
          <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>ID #{r.query_id}</strong>
          {r.database_name && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.database_name}</div>
          )}
        </div>
      ),
    },
    {
      key: 'query_text_snippet',
      label: 'Sorgu Parçacığı',
      render: (r) => (
        <code style={{ fontSize: '11.5px', color: '#38bdf8', fontFamily: 'monospace' }}>
          {r.query_text_snippet ? (r.query_text_snippet.length > 90 ? r.query_text_snippet.substring(0, 90) + '...' : r.query_text_snippet) : '—'}
        </code>
      ),
    },
    {
      key: 'duration_delta_pct',
      label: 'Süre Değişimi',
      sortable: true,
      render: (r) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.old_avg_duration_ms?.toFixed(1)}ms</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>→</span>
            <span style={{ fontWeight: 600, color: 'var(--error, #ef4444)' }}>{r.new_avg_duration_ms?.toFixed(1)}ms</span>
          </div>
          {r.duration_delta_pct && (
            <StatusBadge variant="error" label={`+${r.duration_delta_pct.toFixed(0)}% Süre`} />
          )}
        </div>
      ),
    },
    {
      key: 'cpu_delta_pct',
      label: 'CPU Değişimi',
      sortable: true,
      render: (r) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.old_avg_cpu_ms?.toFixed(1)}ms</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>→</span>
            <span style={{ fontWeight: 600, color: '#f59e0b' }}>{r.new_avg_cpu_ms?.toFixed(1)}ms</span>
          </div>
          {r.cpu_delta_pct && (
            <StatusBadge variant="warning" label={`+${r.cpu_delta_pct.toFixed(0)}% CPU`} />
          )}
        </div>
      ),
    },
    {
      key: 'new_execution_count',
      label: 'İcra Sayısı',
      sortable: true,
      render: (r) => (
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {r.new_execution_count?.toLocaleString() ?? '—'}
        </span>
      ),
    },
    {
      key: 'root_cause',
      label: 'Kök Neden Teşhisi',
      render: (r) => (
        <span style={{ fontSize: '11.5px', color: 'var(--text-primary)' }}>
          {r.root_cause || 'Yürütme planı gerilemesi'}
        </span>
      ),
    },
    {
      key: 'action',
      label: 'Reçete',
      render: (r) => (
        <button
          onClick={() => {
            setSelectedRegression(r);
            setRegScriptTab('force');
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            borderRadius: '4px',
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            color: 'var(--accent, #38bdf8)',
            fontSize: '11.5px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Code2 size={13} />
          Planı Zorla
        </button>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <PageHeader
        title="Ağır Sorgular & Query Store"
        subtitle="En çok CPU, süre ve mantıksal I/O tüketen ağır sorgular, Query Store çalışma istatistikleri ve plan gerilemeleri."
      />

      {antiPatterns?.is_demo && <DemoDataBanner />}

      {/* Tabs */}
      <div className={styles.tabsContainer}>
        <button
          className={`${styles.tabButton} ${activeTab === 'PLAN_ANTI_PATTERNS' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('PLAN_ANTI_PATTERNS')}
        >
          <Flame size={16} />
          Plan Önbellek Tuzakları (Anti-Patterns)
          {antiPatterns && antiPatterns.total_flagged_plans > 0 && (
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.2)',
                color: 'var(--status-danger)',
                fontWeight: 700,
              }}
            >
              {antiPatterns.total_flagged_plans}
            </span>
          )}
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'QUERY_STORE' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('QUERY_STORE')}
        >
          <TrendingUp size={16} />
          Query Store & Maliyetli Sorgular
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'REGRESSIONS' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('REGRESSIONS')}
        >
          <Activity size={16} />
          Plan Gerileme Radarı (Plan Regressions)
          {regressions.length > 0 && (
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.2)',
                color: 'var(--status-danger)',
                fontWeight: 700,
              }}
            >
              {regressions.length}
            </span>
          )}
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'PLAN_VIEWER' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('PLAN_VIEWER')}
        >
          <Layers size={16} />
          Grafiksel Yürütme Planı Görselleştiricisi
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'REWRITER_STUDIO' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('REWRITER_STUDIO')}
        >
          <Wand2 size={16} />
          Akıllı T-SQL İyileştirici (Query Rewriter)
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'CARDINALITY_DRIFT' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('CARDINALITY_DRIFT')}
        >
          <GitCompare size={16} />
          Kardinalite & Parameter Sniffing
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'WAITS' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('WAITS')}
        >
          <Hourglass size={16} />
          Bekleme İstatistikleri (Waits)
        </button>

      </div>

                  {activeTab === 'CARDINALITY_DRIFT' && (
        <CardinalityDriftViewer />
      )}

      {activeTab === 'WAITS' && (
        <WaitStatsPage embedded />
      )}

      {activeTab === 'REWRITER_STUDIO' && (
        <QueryRewriterStudio />
      )}

      {activeTab === 'PLAN_VIEWER' && (
        <ExecutionPlanViewer initialPlanHandle={selectedPlanHandle} />
      )}

{activeTab === 'PLAN_ANTI_PATTERNS' && (
        <>
          {antiPatternLoading ? (
            <LoadingSpinner message="Plan önbelleği taranıyor ve optimizasyon tuzakları çözümleniyor..." />
          ) : antiPatternError ? (
            <ErrorState message={antiPatternError} onRetry={() => window.location.reload()} />
          ) : (
            <>
              {/* Summary KPI row */}
              <div className={styles.antiPatternSummaryRow}>
                <div className={styles.summaryStatBox}>
                  <div className={styles.summaryStatVal} style={{ color: 'var(--status-danger)' }}>
                    {antiPatterns?.total_flagged_plans}
                  </div>
                  <div className={styles.summaryStatLbl}>Tehlikeli Yürütme Planı</div>
                </div>
                <div className={styles.summaryStatBox}>
                  <div className={styles.summaryStatVal} style={{ color: '#ef4444' }}>
                    {antiPatterns?.spill_count}
                  </div>
                  <div className={styles.summaryStatLbl}>TempDB Spill (Sort/Hash)</div>
                </div>
                <div className={styles.summaryStatBox}>
                  <div className={styles.summaryStatVal} style={{ color: '#f59e0b' }}>
                    {antiPatterns?.implicit_conversion_count}
                  </div>
                  <div className={styles.summaryStatLbl}>CONVERT_IMPLICIT (Tip Uyuşmazlığı)</div>
                </div>
                <div className={styles.summaryStatBox}>
                  <div className={styles.summaryStatVal} style={{ color: 'var(--accent-blue)' }}>
                    {antiPatterns?.missing_index_count}
                  </div>
                  <div className={styles.summaryStatLbl}>Planda Eksik İndeks</div>
                </div>
                <div className={styles.summaryStatBox}>
                  <div className={styles.summaryStatVal} style={{ color: 'var(--accent-purple)' }}>
                    {antiPatterns?.high_grant_count}
                  </div>
                  <div className={styles.summaryStatLbl}>Aşırı Bellek Rezervasyonu</div>
                </div>
              </div>

              {/* Filters & Search */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ position: 'relative', width: '320px' }}>
                  <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Sorgu veya veritabanı ara..."
                    value={antiPatternSearch}
                    onChange={(e) => setAntiPatternSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 12px 7px 32px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-card)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontSize: '12.5px',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className={`${styles.tabButton} ${warningFilter === 'ALL' ? styles.tabActive : ''}`}
                    onClick={() => setWarningFilter('ALL')}
                    style={{ fontSize: '12px', padding: '5px 12px' }}
                  >
                    Tümü
                  </button>
                  <button
                    className={`${styles.tabButton} ${warningFilter === 'SPILL' ? styles.tabActive : ''}`}
                    onClick={() => setWarningFilter('SPILL')}
                    style={{ fontSize: '12px', padding: '5px 12px' }}
                  >
                    TempDB Spill
                  </button>
                  <button
                    className={`${styles.tabButton} ${warningFilter === 'CONVERT' ? styles.tabActive : ''}`}
                    onClick={() => setWarningFilter('CONVERT')}
                    style={{ fontSize: '12px', padding: '5px 12px' }}
                  >
                    CONVERT_IMPLICIT
                  </button>
                  <button
                    className={`${styles.tabButton} ${warningFilter === 'MISSING_INDEX' ? styles.tabActive : ''}`}
                    onClick={() => setWarningFilter('MISSING_INDEX')}
                    style={{ fontSize: '12px', padding: '5px 12px' }}
                  >
                    Eksik İndeks
                  </button>
                  <button
                    className={`${styles.tabButton} ${warningFilter === 'GRANT' ? styles.tabActive : ''}`}
                    onClick={() => setWarningFilter('GRANT')}
                    style={{ fontSize: '12px', padding: '5px 12px' }}
                  >
                    Bellek İsrafı
                  </button>
                </div>
              </div>

              {/* Anti-Pattern Cards Grid */}
              {filteredAntiPatterns.length === 0 ? (
                <EmptyState
                  title="Plan Tuzağı Bulunamadı"
                  message="Mevcut arama ve filtre kriterlerine uygun şüpheli yürütme planı tespit edilmedi."
                />
              ) : (
                <div className={styles.antiPatternGrid}>
                  {filteredAntiPatterns.map((q, idx) => (
                    <div
                      key={idx}
                      className={`${styles.antiPatternCard} ${
                        q.warning_severity === 'CRITICAL'
                          ? styles.antiPatternCardCritical
                          : styles.antiPatternCardWarning
                      }`}
                    >
                      <div className={styles.cardTop}>
                        <div className={styles.cardTitleWrap}>
                          <div className={styles.cardTitle}>
                            <AlertTriangle
                              size={16}
                              color={q.warning_severity === 'CRITICAL' ? 'var(--status-danger)' : '#fbbf24'}
                            />
                            <span>{q.warning_type}</span>
                            <span className={styles.dbTag}>{q.database_name}</span>
                          </div>
                          <div className={styles.detailsText}>{q.warning_details}</div>
                        </div>

                        <span
                          className={
                            q.warning_severity === 'CRITICAL' ? styles.badgeCritical : styles.badgeWarning
                          }
                        >
                          {q.warning_severity}
                        </span>
                      </div>

                      {/* Query Snippet */}
                      <div className={styles.querySnippetBox}>
                        <code>{q.query_text}</code>
                      </div>

                      {/* Stats Row */}
                      <div className={styles.statRow}>
                        <div className={styles.statItem}>
                          <span className={styles.statLbl}>Çalışma Sayısı</span>
                          <span className={styles.statVal}>{q.execution_count.toLocaleString()}</span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statLbl}>Ort. CPU</span>
                          <span className={styles.statVal}>{q.avg_cpu_ms.toFixed(1)} ms</span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statLbl}>Toplam CPU</span>
                          <span className={styles.statVal}>{(q.total_cpu_ms / 1000).toFixed(1)} sn</span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statLbl}>Ort. Mantıksal Okuma</span>
                          <span className={styles.statVal}>{q.avg_logical_reads.toLocaleString()}</span>
                        </div>
                        {q.max_grant_kb !== null && q.max_grant_kb !== undefined && (
                          <div className={styles.statItem}>
                            <span className={styles.statLbl}>Bellek Rezervasyonu</span>
                            <span className={styles.statVal}>
                              {q.max_grant_kb >= 1024
                                ? `${(q.max_grant_kb / 1024).toFixed(0)} MB`
                                : `${q.max_grant_kb} KB`}
                            </span>
                          </div>
                        )}
                        {q.last_execution_time && (
                          <div className={styles.statItem}>
                            <span className={styles.statLbl}>Son Çalışma</span>
                            <span className={styles.statVal}>{q.last_execution_time}</span>
                          </div>
                        )}
                      </div>

                      {/* Recommendation Box */}
                      <div className={styles.recommendationBox}>
                        <div className={styles.recTitle}>
                          <Lightbulb size={14} />
                          Önerilen DBA İyileştirmesi & Çözüm:
                        </div>
                        <div className={styles.recText}>{q.recommendation}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {activeTab === 'QUERY_STORE' && (
        <>
          {overview && (
            <div className={styles.overviewCard}>
              <div className={styles.metricItem}>
                <span className={styles.metricTitle}>Query Store Durumu</span>
                <span className={styles.metricValue}>
                  {overview.enabled ? (overview.actual_state || 'Etkin') : 'Devre Dışı'}
                </span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricTitle}>Yakalama Modu (Capture)</span>
                <span className={styles.metricValue}>{overview.query_capture_mode || 'Auto'}</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricTitle}>Depolama Boyutu</span>
                <span className={styles.metricValue}>
                  {overview.current_storage_size_mb
                    ? `${overview.current_storage_size_mb.toFixed(1)} MB`
                    : '—'}
                </span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricTitle}>QS Etkin Veritabanı Sayısı</span>
                <span className={styles.metricValue}>{overview.databases_with_qs?.length || 0}</span>
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

          {qsLoading && <LoadingSpinner message="Maliyetli sorgu verileri alınıyor..." />}
          {qsError && <ErrorState message={qsError} onRetry={() => setSelectedDb(selectedDb)} />}

          {!qsLoading && !qsError && queries.length === 0 && (
            <EmptyState
              title="Sorgu Verisi Bulunamadı"
              message="Bu veritabanında henüz Query Store verisi kaydedilmemiş veya filtreye uygun sorgu bulunmuyor."
            />
          )}

          {!qsLoading && !qsError && queries.length > 0 && (
            <DataTable
              columns={qsColumns}
              data={queries}
              emptyMessage="Sorgu bulunamadı."
            />
          )}
        </>
      )}

      {/* Tab 3: Plan Gerileme Radarı (Plan Regressions) */}
      {activeTab === 'REGRESSIONS' && (
        <>
          {regLoading ? (
            <LoadingSpinner message="Query Store üzerinden yürütme planı regresyonları hesaplanıyor..." />
          ) : regError ? (
            <ErrorState message={regError} onRetry={() => window.location.reload()} />
          ) : (
            <>
              {/* Regression Summary KPIs */}
              <div className={styles.antiPatternSummaryRow}>
                <div className={styles.summaryStatBox}>
                  <div className={styles.summaryStatVal} style={{ color: 'var(--status-danger)' }}>
                    {regressions.length}
                  </div>
                  <div className={styles.summaryStatLbl}>Gerileyen Sorgu</div>
                </div>
                <div className={styles.summaryStatBox}>
                  <div className={styles.summaryStatVal} style={{ color: '#ef4444' }}>
                    {regressions.filter(r => r.severity === 'CRITICAL').length}
                  </div>
                  <div className={styles.summaryStatLbl}>Kritik Gerileme (P1)</div>
                </div>
                <div className={styles.summaryStatBox}>
                  <div className={styles.summaryStatVal} style={{ color: '#f59e0b' }}>
                    +{Math.round(regressions.reduce((max, r) => Math.max(max, r.duration_delta_pct || 0), 0))}%
                  </div>
                  <div className={styles.summaryStatLbl}>En Yüksek Süre Artışı</div>
                </div>
                <div className={styles.summaryStatBox}>
                  <div className={styles.summaryStatVal} style={{ color: 'var(--accent-blue)' }}>
                    +{Math.round(regressions.reduce((max, r) => Math.max(max, r.cpu_delta_pct || 0), 0))}%
                  </div>
                  <div className={styles.summaryStatLbl}>En Yüksek CPU Artışı</div>
                </div>
              </div>

              {/* Search & DB filter */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                <div style={{ position: 'relative', width: '320px' }}>
                  <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Sorgu veya veritabanı filtrele..."
                    value={regSearch}
                    onChange={(e) => setRegSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 12px 7px 32px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-card)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontSize: '12.5px',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  * Son 24 saatlik süre ile önceki baseline dönemi karşılaştırılmaktadır.
                </div>
              </div>

              <DataTable
                columns={regressionColumns}
                data={regressions.filter(r => !regSearch || (r.query_text_snippet || '').toLowerCase().includes(regSearch.toLowerCase()) || (r.database_name || '').toLowerCase().includes(regSearch.toLowerCase()))}
                emptyMessage="Plan gerilemesi tespit edilen sorgu bulunamadı."
              />
            </>
          )}
        </>
      )}

      {/* Full SQL Detail Modal */}
      {selectedSqlDetail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setSelectedSqlDetail(null)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '750px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                  Sorgu #{selectedSqlDetail.id} • SQL Detayı
                </div>
                {selectedSqlDetail.db && (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Veritabanı: <strong>{selectedSqlDetail.db}</strong>
                    {selectedSqlDetail.cpu != null && (
                      <span> • Ort. CPU: {selectedSqlDetail.cpu.toFixed(2)} ms</span>
                    )}
                    {selectedSqlDetail.duration != null && (
                      <span> • Ort. Süre: {selectedSqlDetail.duration.toFixed(2)} ms</span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setSelectedSqlDetail(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                ✕
              </button>
            </div>
            <div
              style={{
                padding: '1.25rem 1.5rem',
                background: '#070b16',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '12.5px',
                lineHeight: 1.6,
                color: '#38bdf8',
                maxHeight: '420px',
                overflowY: 'auto',
              }}
            >
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {selectedSqlDetail.sql}
              </pre>
            </div>
            <div
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                * Query Store çalışma planı ve telemetrisinden derlenmiştir.
              </span>
              <button
                onClick={() => handleCopy(selectedSqlDetail.sql)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  background: 'var(--primary, #0284c7)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 500,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Kopyalandı!' : 'SQL Metnini Kopyala'}
              </button>
            </div>
          </div>
        </div>
      )}

            {/* Enhanced Plan Forcing & Regression Studio Modal */}
      {selectedRegression && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(5px)',
            padding: '1.5rem',
          }}
          onClick={() => setSelectedRegression(null)}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '820px',
              maxHeight: '92vh',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #1e293b',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#0b1122',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  {selectedRegression.severity || 'CRITICAL'} GERİLEME
                </span>
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#f1f5f9' }}>
                  Query Store Plan Zorlama &amp; Regresyon Stüdyosu • Sorgu #{selectedRegression.query_id}
                </div>
              </div>
              <button
                onClick={() => setSelectedRegression(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.2rem',
              }}
            >
              {/* Query Snippet & Target Database */}
              <div
                style={{
                  padding: '0.85rem 1.1rem',
                  background: 'rgba(11, 17, 34, 0.7)',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#94a3b8' }}>
                    Hedef Veritabanı: <strong style={{ color: '#f1f5f9' }}>{selectedRegression.database_name || 'Datapath_TestDB'}</strong>
                  </span>
                  <span style={{ color: '#94a3b8' }}>
                    Sorgu ID: <strong style={{ color: '#38bdf8' }}>#{selectedRegression.query_id}</strong>
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '11.5px',
                    color: '#cbd5e1',
                    maxHeight: '52px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selectedRegression.query_text_snippet || '—'}
                </div>
              </div>

              {/* Side-by-Side Plan Comparison Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                }}
              >
                {/* Good Plan */}
                <div
                  style={{
                    padding: '1rem 1.15rem',
                    background: 'rgba(16, 185, 129, 0.05)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981' }}>
                      REFERANS İYİ PLAN (PLAN #{selectedRegression.plan_id_good || 1})
                    </span>
                    <span
                      style={{
                        fontSize: '10.5px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      Önerilen
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '12px' }}>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: '11px' }}>Ort. CPU</div>
                      <div style={{ fontWeight: 600, color: '#f1f5f9', marginTop: '2px' }}>
                        {(selectedRegression.old_avg_cpu_ms ?? 0).toFixed(1)} ms
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: '11px' }}>Ort. Süre</div>
                      <div style={{ fontWeight: 600, color: '#f1f5f9', marginTop: '2px' }}>
                        {(selectedRegression.old_avg_duration_ms ?? 0).toFixed(1)} ms
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    İcra Sayısı: {selectedRegression.old_execution_count?.toLocaleString() || '1'}
                  </div>
                </div>

                {/* Regressed Plan */}
                <div
                  style={{
                    padding: '1rem 1.15rem',
                    background: 'rgba(239, 68, 68, 0.05)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444' }}>
                      GERİLEYEN MEVCUT PLAN (PLAN #{selectedRegression.plan_id_bad || 2})
                    </span>
                    <span
                      style={{
                        fontSize: '10.5px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#ef4444',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      +{Math.round(selectedRegression.duration_delta_pct || 0)}% Sapma
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '12px' }}>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: '11px' }}>Ort. CPU</div>
                      <div style={{ fontWeight: 600, color: '#f59e0b', marginTop: '2px' }}>
                        {(selectedRegression.new_avg_cpu_ms ?? 0).toFixed(1)} ms
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: '11px' }}>Ort. Süre</div>
                      <div style={{ fontWeight: 600, color: '#ef4444', marginTop: '2px' }}>
                        {(selectedRegression.new_avg_duration_ms ?? 0).toFixed(1)} ms
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    İcra Sayısı: {selectedRegression.new_execution_count?.toLocaleString() || '1'}
                  </div>
                </div>
              </div>

              {/* Root Cause Banner */}
              <div
                style={{
                  padding: '0.75rem 1rem',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#e2e8f0',
                  lineHeight: 1.5,
                }}
              >
                <strong style={{ color: '#f59e0b' }}>Kök Neden Teşhisi: </strong>
                {selectedRegression.root_cause ||
                  'Query Store, parametre koklama (parameter sniffing) veya kardinalite sapması sebebiyle suboptimal yeni bir plan derledi.'}
              </div>

              {/* T-SQL Tabs */}
              <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem' }}>
                <button
                  onClick={() => setRegScriptTab('force')}
                  style={{
                    padding: '0.4rem 0.9rem',
                    background: regScriptTab === 'force' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                    border: '1px solid ' + (regScriptTab === 'force' ? 'rgba(56, 189, 248, 0.3)' : 'transparent'),
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: regScriptTab === 'force' ? '#38bdf8' : '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  1. Planı Zorla (sp_query_store_force_plan)
                </button>
                <button
                  onClick={() => setRegScriptTab('unforce')}
                  style={{
                    padding: '0.4rem 0.9rem',
                    background: regScriptTab === 'unforce' ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
                    border: '1px solid ' + (regScriptTab === 'unforce' ? 'rgba(239, 68, 68, 0.3)' : 'transparent'),
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: regScriptTab === 'unforce' ? '#ef4444' : '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  2. Geri Al / Serbest Bırak (sp_query_store_unforce_plan)
                </button>
                <button
                  onClick={() => setRegScriptTab('diagnose')}
                  style={{
                    padding: '0.4rem 0.9rem',
                    background: regScriptTab === 'diagnose' ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                    border: '1px solid ' + (regScriptTab === 'diagnose' ? 'rgba(16, 185, 129, 0.3)' : 'transparent'),
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: regScriptTab === 'diagnose' ? '#10b981' : '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  3. Query Store Teşhis Sorgusu
                </button>
              </div>

              {/* Code Box */}
              {(() => {
                const dbName = selectedRegression.database_name || 'Datapath_TestDB';
                const qId = selectedRegression.query_id;
                const pGood = selectedRegression.plan_id_good || 1;
                const pBad = selectedRegression.plan_id_bad || 2;

                const forceSql = `-- ============================================================================\n-- QUERY STORE PLAN ZORLAMA (FORCE PLAN) REÇETESİ\n-- Hedef Veritabanı: [${dbName}] | Sorgu ID: ${qId} | Hedef Plan ID: ${pGood}\n-- ============================================================================\nUSE [${dbName}];\nGO\n\n-- 1. Güvenlik Denetimi: Planın Query Store üzerinde kayıtlı olduğunu doğrula\nIF EXISTS (\n    SELECT 1 FROM sys.query_store_plan \n    WHERE query_id = ${qId} AND plan_id = ${pGood}\n)\nBEGIN\n    -- 2. İyi planı zorunlu kıl (Plan Forcing)\n    EXEC sp_query_store_force_plan \n        @query_id = ${qId}, \n        @plan_id = ${pGood};\n    \n    PRINT 'Başarılı: Sorgu #${qId} için Plan #${pGood} zorlandı.';\nEND\nELSE\nBEGIN\n    RAISERROR('Hata: Belirtilen Plan ID Query Store tablosunda bulunamadı.', 16, 1);\nEND\nGO\n\n-- 3. Plan Zorlama Durumunu Doğrula\nSELECT \n    q.query_id,\n    p.plan_id,\n    p.is_forced_plan,\n    p.force_failure_count,\n    p.last_force_failure_reason_desc\nFROM sys.query_store_plan p\nJOIN sys.query_store_query q ON p.query_id = q.query_id\nWHERE q.query_id = ${qId};\nGO`;

                const unforceSql = `-- ============================================================================\n-- GERİ ALMA (ROLLBACK): PLAN ZORLAMASINI KALDIR (UNFORCE PLAN)\n-- ============================================================================\nUSE [${dbName}];\nGO\n\nEXEC sp_query_store_unforce_plan \n    @query_id = ${qId}, \n    @plan_id = ${pGood};\n\nPRINT 'Sorgu #${qId} için plan zorlaması kaldırıldı. Optimizer serbest bırakıldı.';\nGO`;

                const diagSql = `-- ============================================================================\n-- QUERY STORE DETAYLI PLAN & ÇALIŞMA KARŞILAŞTIRMASI\n-- ============================================================================\nUSE [${dbName}];\nGO\n\nSELECT \n    p.plan_id,\n    p.is_forced_plan,\n    rs.count_executions,\n    rs.avg_duration / 1000.0 AS avg_duration_ms,\n    rs.avg_cpu_time / 1000.0 AS avg_cpu_ms,\n    rs.avg_logical_io_reads,\n    p.query_plan\nFROM sys.query_store_plan p\nJOIN sys.query_store_runtime_stats rs ON p.plan_id = rs.plan_id\nWHERE p.query_id = ${qId}\nORDER BY rs.avg_cpu_time DESC;\nGO`;

                const activeSql = regScriptTab === 'force' ? forceSql : regScriptTab === 'unforce' ? unforceSql : diagSql;

                return (
                  <div
                    style={{
                      background: '#070b16',
                      border: '1px solid #1e293b',
                      borderRadius: '8px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '0.6rem 1rem',
                        background: '#0b1122',
                        borderBottom: '1px solid #1e293b',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '11px',
                        color: '#94a3b8',
                      }}
                    >
                      <span>
                        {regScriptTab === 'force' && `sp_query_store_force_plan @query_id=${qId}, @plan_id=${pGood}`}
                        {regScriptTab === 'unforce' && `sp_query_store_unforce_plan @query_id=${qId}, @plan_id=${pGood}`}
                        {regScriptTab === 'diagnose' && `Query Store Teşhis SQL (Query #${qId})`}
                      </span>
                      <button
                        onClick={() => handleCopy(activeSql)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          background: 'rgba(56, 189, 248, 0.12)',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          color: '#38bdf8',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {copied ? <Check size={13} /> : <Copy size={13} />}
                        {copied ? 'Kopyalandı!' : 'T-SQL Kopyala'}
                      </button>
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        padding: '1rem 1.25rem',
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: '12px',
                        lineHeight: 1.6,
                        color: '#7dd3fc',
                        maxHeight: '260px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {activeSql}
                    </pre>
                  </div>
                );
              })()}

              {/* Safety notice */}
              <div
                style={{
                  fontSize: '11px',
                  color: '#64748b',
                  lineHeight: 1.4,
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(11, 17, 34, 0.5)',
                  borderRadius: '4px',
                }}
              >
                * <strong>Kurumsal Güvenlik Politikası (Review-Only):</strong> Plan zorlama işlemi anlık darboğazları gidermek için acil müdahaledir. Kalıcı çözüm için eksik indeksler veya `OPTION (RECOMPILE)` / `OPTIMIZE FOR` yönergeleri değerlendirilmelidir.
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid #1e293b',
                display: 'flex',
                justifyContent: 'flex-end',
                background: '#0b1122',
              }}
            >
              <button
                onClick={() => setSelectedRegression(null)}
                style={{
                  padding: '0.45rem 1.2rem',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: '#f1f5f9',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
