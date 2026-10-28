import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Flame,
  Cpu,
  Layers,
  Lightbulb,
  Search,
  Filter,
  CheckCircle2,
  Database as DbIcon,
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
} from '../../lib/api';
import type {
  QueryStoreOverview,
  ExpensiveQuery,
  Database,
  PlanAntiPatternsSummary,
  PlanWarningQuery,
} from '../../lib/types';
import styles from './QueryPerformancePage.module.css';

export default function QueryPerformancePage() {
  const [activeTab, setActiveTab] = useState<'PLAN_ANTI_PATTERNS' | 'QUERY_STORE'>('PLAN_ANTI_PATTERNS');

  // Plan Anti-Patterns State
  const [antiPatterns, setAntiPatterns] = useState<PlanAntiPatternsSummary | null>(null);
  const [antiPatternLoading, setAntiPatternLoading] = useState<boolean>(true);
  const [antiPatternError, setAntiPatternError] = useState<string | null>(null);
  const [warningFilter, setWarningFilter] = useState<'ALL' | 'SPILL' | 'CONVERT' | 'MISSING_INDEX' | 'GRANT'>('ALL');
  const [antiPatternSearch, setAntiPatternSearch] = useState<string>('');

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
        title="Sorgu & Yürütme Planı Zekası"
        subtitle="Önbellekteki tehlikeli yürütme planı tuzakları (TempDB Spill, CONVERT_IMPLICIT), bellek israfları ve Query Store metrikleri"
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
      </div>

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
    </div>
  );
}
