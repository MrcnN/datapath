import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  Activity,
  AlertTriangle,
  Flame,
  Search,
  RefreshCw,
  Layers,
  Database,
  Code2,
  Copy,
  Check,
  ChevronRight,
  ShieldCheck,
  Zap,
  TrendingUp,
  Cpu,
  Hourglass,
  Calendar,
} from 'lucide-react';
import {
  getTimeTravelOverview,
  getTimeTravelSnapshot,
  getDatabases,
} from '../../../lib/api';
import type {
  TimeTravelCorrelatorOverview,
  TimeTravelSnapshotDetail,
  TimeTravelTimelinePoint,
  CorrelatedQueryItem,
  CorrelatedWaitItem,
  CorrelatedEventItem,
  Database as DbItem,
} from '../../../lib/types';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import styles from './TimeTravelCorrelator.module.css';

interface TimeTravelCorrelatorProps {
  initialDatabase?: string;
}

export default function TimeTravelCorrelator({ initialDatabase }: TimeTravelCorrelatorProps) {
  const [databases, setDatabases] = useState<DbItem[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>(initialDatabase || 'Datapath_TestDB');
  const [timeRange, setTimeRange] = useState<'1H' | '6H' | '24H'>('24H');

  const [overview, setOverview] = useState<TimeTravelCorrelatorOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState<boolean>(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // Selected scrubbed interval state
  const [selectedIntervalId, setSelectedIntervalId] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<TimeTravelSnapshotDetail | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState<boolean>(false);

  // Active snapshot sub-tab
  const [activeSubTab, setActiveSubTab] = useState<'queries' | 'waits' | 'events'>('queries');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Hover state on chart
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Load database list once
  useEffect(() => {
    async function loadDbs() {
      try {
        const dbs = await getDatabases();
        if (dbs && dbs.length > 0) {
          setDatabases(dbs);
          if (!initialDatabase) {
            const hasTest = dbs.find((d) => d.name === 'Datapath_TestDB');
            setSelectedDb(hasTest ? 'Datapath_TestDB' : dbs[0].name);
          }
        }
      } catch {
        // demo fallback
      }
    }
    loadDbs();
  }, [initialDatabase]);

  // Load Overview Data
  const loadOverview = useCallback(async () => {
    try {
      setLoadingOverview(true);
      setOverviewError(null);
      const res = await getTimeTravelOverview(selectedDb, timeRange);
      setOverview(res);
      setSelectedIntervalId(res.initial_interval_id);
      setSnapshot(res.initial_snapshot || null);
    } catch (err: any) {
      setOverviewError(err.message || 'Zaman yolculuğu verileri alınamadı.');
    } finally {
      setLoadingOverview(false);
    }
  }, [selectedDb, timeRange]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // Scrub to specific interval
  const handleScrubInterval = async (intervalId: number) => {
    if (intervalId === selectedIntervalId && snapshot) return;
    setSelectedIntervalId(intervalId);
    try {
      setLoadingSnapshot(true);
      const snap = await getTimeTravelSnapshot(intervalId, selectedDb);
      setSnapshot(snap);
    } catch (err: any) {
      console.error('Failed to load snapshot for interval:', err);
    } finally {
      setLoadingSnapshot(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Timeline points for SVG rendering
  const timeline = overview?.timeline || [];
  const peakCpu = useMemo(() => {
    if (!timeline.length) return 0;
    return Math.round(Math.max(...timeline.map((t) => t.cpu_load_percent)));
  }, [timeline]);

  const spikePoints = useMemo(() => {
    return timeline.filter((t) => t.is_anomaly_spike);
  }, [timeline]);

  // Build SVG polygon coordinates
  const svgWidth = 800;
  const svgHeight = 180;
  const paddingX = 20;
  const paddingY = 20;

  const pointsString = useMemo(() => {
    if (timeline.length < 2) return '';
    const stepX = (svgWidth - paddingX * 2) / (timeline.length - 1);
    const coords = timeline.map((pt, i) => {
      const x = paddingX + i * stepX;
      const y = svgHeight - paddingY - (pt.cpu_load_percent / 100) * (svgHeight - paddingY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return coords.join(' ');
  }, [timeline]);

  const areaPolygonString = useMemo(() => {
    if (!pointsString) return '';
    const stepX = (svgWidth - paddingX * 2) / (timeline.length - 1);
    const firstX = paddingX;
    const lastX = paddingX + (timeline.length - 1) * stepX;
    const bottomY = svgHeight - paddingY;
    return `${firstX},${bottomY} ${pointsString} ${lastX},${bottomY}`;
  }, [pointsString, timeline]);

  const selectedIndex = useMemo(() => {
    if (!selectedIntervalId) return -1;
    return timeline.findIndex((t) => t.interval_id === selectedIntervalId);
  }, [timeline, selectedIntervalId]);

  return (
    <div className={styles.container}>
      {/* Header Bar */}
      <div className={styles.headerBar}>
        <div className={styles.headerLeft}>
          <div className={styles.titleIcon}>
            <Clock size={22} />
          </div>
          <div>
            <div className={styles.headerTitle}>
              Workload Time-Travel Correlator &amp; Spike Detective
            </div>
            <div className={styles.headerSubtitle}>
              Zaman yolculuğu ve olay korelasyonu: Geçmiş tepe noktalarında hangi sorguların, kilitlerin ve DDL olaylarının çakıştığını anında canlandırın.
            </div>
          </div>
        </div>

        <div className={styles.headerActions}>
          <div className={styles.rangePills}>
            {(['1H', '6H', '24H'] as const).map((r) => (
              <button
                key={r}
                className={`${styles.rangePillBtn} ${timeRange === r ? styles.rangePillActive : ''}`}
                onClick={() => setTimeRange(r)}
              >
                {r}
              </button>
            ))}
          </div>

          <select
            className={styles.dbSelect}
            value={selectedDb}
            onChange={(e) => setSelectedDb(e.target.value)}
          >
            {databases.length > 0 ? (
              databases.map((db) => (
                <option key={db.name} value={db.name}>
                  {db.name}
                </option>
              ))
            ) : (
              <option value="Datapath_TestDB">Datapath_TestDB</option>
            )}
          </select>

          <button className={styles.refreshBtn} onClick={loadOverview} disabled={loadingOverview}>
            <RefreshCw size={14} className={loadingOverview ? 'spin' : ''} />
            Yenile
          </button>
        </div>
      </div>

      {loadingOverview && <LoadingSpinner message="Query Store zaman dilimleri ve bekleme telemetrisi taranıyor..." />}
      {overviewError && <ErrorState message={overviewError} onRetry={loadOverview} />}

      {!loadingOverview && !overviewError && overview && (
        <>
          {/* Top KPI Cards Grid */}
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <div className={styles.kpiIconWrap} style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8' }}>
                <Clock size={22} />
              </div>
              <div>
                <div className={styles.kpiLabel}>İzlenen Zaman Dilimleri</div>
                <div className={styles.kpiValue}>{overview.total_intervals} Kova (Bucket)</div>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div
                className={styles.kpiIconWrap}
                style={{
                  background: overview.detected_spikes_count > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                  color: overview.detected_spikes_count > 0 ? '#ef4444' : '#10b981',
                }}
              >
                <Flame size={22} />
              </div>
              <div>
                <div className={styles.kpiLabel}>Tespit Edilen Ani Sıçramalar</div>
                <div
                  className={styles.kpiValue}
                  style={{ color: overview.detected_spikes_count > 0 ? '#ef4444' : 'inherit' }}
                >
                  {overview.detected_spikes_count} Tepe Noktası
                </div>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIconWrap} style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                <Activity size={22} />
              </div>
              <div>
                <div className={styles.kpiLabel}>En Yüksek CPU Yükü</div>
                <div className={styles.kpiValue} style={{ color: '#f59e0b' }}>
                  %{peakCpu}
                </div>
              </div>
            </div>

            <div className={styles.kpiCard}>
              <div className={styles.kpiIconWrap} style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                <Zap size={22} />
              </div>
              <div>
                <div className={styles.kpiLabel}>Canlandırılan An (Scrubbed)</div>
                <div className={styles.kpiValue} style={{ fontSize: '1.15rem' }}>
                  {snapshot?.start_time ? snapshot.start_time.substring(11, 16) : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Timeline Scrubber Card */}
          <div className={styles.timelineCard}>
            <div className={styles.timelineHeader}>
              <div className={styles.timelineTitle}>
                <TrendingUp size={18} style={{ color: '#38bdf8' }} />
                İş Yükü Zaman Çizelgesi &amp; İnteraktif Kaydırıcı (Timeline Scrubber)
              </div>
              <div className={styles.timelineNotice}>
                * Çizelgedeki herhangi bir noktaya veya tepe etiketine tıklayarak o anı canlandırabilirsiniz.
              </div>
            </div>

            {/* Quick Jump Detected Spikes */}
            {spikePoints.length > 0 && (
              <div className={styles.spikesBar}>
                <div className={styles.spikesLabel}>
                  <Flame size={14} />
                  Kritik Tepe Noktaları:
                </div>
                {spikePoints.map((sp) => (
                  <div
                    key={sp.interval_id}
                    className={`${styles.spikeChip} ${
                      sp.spike_severity === 'CRITICAL' ? styles.spikeChipCritical : styles.spikeChipWarning
                    } ${selectedIntervalId === sp.interval_id ? styles.spikeChipCriticalActive : ''}`}
                    onClick={() => handleScrubInterval(sp.interval_id)}
                  >
                    <span>{sp.time_label}</span>
                    <span>•</span>
                    <span>%{sp.cpu_load_percent.toFixed(0)} CPU</span>
                    <span style={{ fontSize: '10px', opacity: 0.8 }}>({sp.dominant_wait_category})</span>
                  </div>
                ))}
              </div>
            )}

            {/* Interactive SVG Area Chart */}
            <div
              className={styles.chartContainer}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const stepX = (svgWidth - paddingX * 2) / (timeline.length - 1);
                const idx = Math.round((mouseX - paddingX) / stepX);
                if (idx >= 0 && idx < timeline.length) {
                  setHoverIndex(idx);
                }
              }}
              onMouseLeave={() => setHoverIndex(null)}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const stepX = (svgWidth - paddingX * 2) / (timeline.length - 1);
                const idx = Math.round((mouseX - paddingX) / stepX);
                if (idx >= 0 && idx < timeline.length) {
                  handleScrubInterval(timeline[idx].interval_id);
                }
              }}
            >
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className={styles.svgChart} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                    <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Baseline Guides */}
                <line x1={paddingX} y1={svgHeight - paddingY - (50 / 100) * (svgHeight - paddingY * 2)} x2={svgWidth - paddingX} y2={svgHeight - paddingY - (50 / 100) * (svgHeight - paddingY * 2)} stroke="#1e293b" strokeDasharray="3 3" />
                <line x1={paddingX} y1={svgHeight - paddingY - (80 / 100) * (svgHeight - paddingY * 2)} x2={svgWidth - paddingX} y2={svgHeight - paddingY - (80 / 100) * (svgHeight - paddingY * 2)} stroke="#ef4444" strokeOpacity="0.4" strokeDasharray="3 3" />

                {/* Area Polygon */}
                {areaPolygonString && (
                  <polygon points={areaPolygonString} fill="url(#cpuGradient)" />
                )}

                {/* Metric Polyline */}
                {pointsString && (
                  <polyline points={pointsString} fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                )}

                {/* Anomaly Spike Dots */}
                {timeline.map((pt, i) => {
                  if (!pt.is_anomaly_spike) return null;
                  const stepX = (svgWidth - paddingX * 2) / (timeline.length - 1);
                  const cx = paddingX + i * stepX;
                  const cy = svgHeight - paddingY - (pt.cpu_load_percent / 100) * (svgHeight - paddingY * 2);
                  const isCrit = pt.spike_severity === 'CRITICAL';
                  return (
                    <g key={pt.interval_id}>
                      <circle cx={cx} cy={cy} r="6" fill={isCrit ? '#ef4444' : '#f59e0b'} fillOpacity="0.3" />
                      <circle cx={cx} cy={cy} r="3.5" fill={isCrit ? '#ef4444' : '#f59e0b'} stroke="#ffffff" strokeWidth="1" />
                    </g>
                  );
                })}

                {/* Vertical Scrubber Line for Selected Point */}
                {selectedIndex >= 0 && (
                  <g>
                    {(() => {
                      const stepX = (svgWidth - paddingX * 2) / (timeline.length - 1);
                      const sx = paddingX + selectedIndex * stepX;
                      return (
                        <line x1={sx} y1={paddingY} x2={sx} y2={svgHeight - paddingY} className={styles.scrubberLine} />
                      );
                    })()}
                  </g>
                )}
              </svg>

              {/* Tooltip on Hover */}
              {hoverIndex !== null && timeline[hoverIndex] && (
                <div
                  className={styles.tooltipBox}
                  style={{
                    left: `${Math.min(svgWidth - 140, Math.max(10, (hoverIndex / (timeline.length - 1)) * 100))}%`,
                  }}
                >
                  <strong>{timeline[hoverIndex].time_label}</strong> • %
                  {timeline[hoverIndex].cpu_load_percent.toFixed(1)} CPU • Bekleme:{' '}
                  {timeline[hoverIndex].dominant_wait_category}
                </div>
              )}
            </div>
          </div>

          {/* Synchronized Snapshot Detail Card ("O Dakikada Ne Oldu?") */}
          {loadingSnapshot ? (
            <div className={styles.snapshotCard} style={{ padding: '2rem', textAlign: 'center' }}>
              <LoadingSpinner message="Seçilen dakikanın telemetrisi ve olayları korele ediliyor..." />
            </div>
          ) : snapshot ? (
            <div className={styles.snapshotCard}>
              <div className={styles.snapshotTopBar}>
                <div className={styles.snapshotTimeLabel}>
                  <Clock size={18} style={{ color: '#38bdf8' }} />
                  <span>
                    Zaman Damgası: {snapshot.start_time ? snapshot.start_time.substring(11, 16) : ''} -{' '}
                    {snapshot.end_time ? snapshot.end_time.substring(11, 16) : ''}
                  </span>
                </div>

                <div className={styles.snapshotTags}>
                  <div className={styles.snapshotTag}>
                    Toplam CPU: <strong>{snapshot.total_cpu_ms.toFixed(0)} ms</strong>
                  </div>
                  <div className={styles.snapshotTag}>
                    İcra Sayısı: <strong>{snapshot.total_executions.toLocaleString()}</strong>
                  </div>
                  <div className={styles.snapshotTag}>
                    Baskın Bekleme: <strong style={{ color: '#f59e0b' }}>{snapshot.dominant_wait_category}</strong>
                  </div>
                  <div
                    className={`${styles.snapshotTag} ${
                      snapshot.is_anomaly_spike ? styles.spikeBadgeCritical : styles.spikeBadgeNormal
                    }`}
                  >
                    {snapshot.is_anomaly_spike ? 'KRİTİK TEPE NOKTASI' : 'NORMAL DÖNEM'}
                  </div>
                </div>
              </div>

              {/* Sub-tabs Bar */}
              <div className={styles.subTabsBar}>
                <button
                  className={`${styles.subTabBtn} ${activeSubTab === 'queries' ? styles.subTabActive : ''}`}
                  onClick={() => setActiveSubTab('queries')}
                >
                  <Cpu size={15} />
                  Top Ağır Sorgular ({snapshot.queries.length})
                </button>
                <button
                  className={`${styles.subTabBtn} ${activeSubTab === 'waits' ? styles.subTabActive : ''}`}
                  onClick={() => setActiveSubTab('waits')}
                >
                  <Hourglass size={15} />
                  Darboğaz Bekleme Dağılımı ({snapshot.waits.length})
                </button>
                <button
                  className={`${styles.subTabBtn} ${activeSubTab === 'events' ? styles.subTabActive : ''}`}
                  onClick={() => setActiveSubTab('events')}
                >
                  <Calendar size={15} />
                  Eşzamanlı Şema &amp; Altyapı Olayları ({snapshot.events.length})
                </button>
              </div>

              <div className={styles.snapshotBody}>
                {/* Tab 1: Queries */}
                {activeSubTab === 'queries' && (
                  <div className={styles.queriesList}>
                    {snapshot.queries.map((q: CorrelatedQueryItem) => (
                      <div key={`${q.query_id}_${q.plan_id}`} className={styles.queryCard}>
                        <div className={styles.queryCardHeader}>
                          <div className={styles.queryIdBadge}>
                            <Code2 size={16} />
                            Sorgu #{q.query_id} • Plan #{q.plan_id}
                            {q.object_name && (
                              <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 500 }}>
                                ({q.object_name})
                              </span>
                            )}
                          </div>
                          <div className={styles.queryStatsRow}>
                            <div>
                              CPU Katkısı: <strong style={{ color: '#ef4444' }}>%{q.cpu_contribution_pct.toFixed(1)}</strong>
                            </div>
                            <div>
                              Ort. Süre: <strong>{q.duration_ms.toFixed(1)} ms</strong>
                            </div>
                            <div>
                              Okuma: <strong>{q.logical_reads.toLocaleString()} sayfa</strong>
                            </div>
                            <div>
                              İcra: <strong>{q.execution_count}</strong>
                            </div>
                          </div>
                        </div>

                        <div className={styles.contributionBarTrack}>
                          <div
                            className={styles.contributionBarFill}
                            style={{ width: `${Math.min(100, q.cpu_contribution_pct)}%` }}
                          />
                        </div>

                        <pre className={styles.querySqlPre}>{q.query_text}</pre>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab 2: Waits */}
                {activeSubTab === 'waits' && (
                  <div className={styles.waitsGrid}>
                    {snapshot.waits.map((w: CorrelatedWaitItem) => (
                      <div key={w.wait_category} className={styles.waitCard}>
                        <div className={styles.waitCardHeader}>
                          <span className={styles.waitCategoryText}>{w.wait_category}</span>
                          <span className={styles.waitMsText}>
                            %{w.percentage.toFixed(1)} • {w.total_wait_ms.toFixed(0)} ms
                          </span>
                        </div>
                        <div className={styles.contributionBarTrack}>
                          <div
                            className={styles.contributionBarFill}
                            style={{
                              width: `${Math.min(100, w.percentage)}%`,
                              background: w.wait_category === 'Lock' ? '#ef4444' : '#f59e0b',
                            }}
                          />
                        </div>
                        <div className={styles.waitDiagText}>{w.architectural_diagnosis}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab 3: Events */}
                {activeSubTab === 'events' && (
                  <div className={styles.eventsTimeline}>
                    {snapshot.events.length === 0 ? (
                      <div style={{ color: '#94a3b8', fontSize: '12px', padding: '1rem', textAlign: 'center' }}>
                        Bu zaman aralığında kaydedilmiş bir DDL şema değişikliği veya altyapı olayı bulunmamaktadır.
                      </div>
                    ) : (
                      snapshot.events.map((ev: CorrelatedEventItem, idx: number) => (
                        <div key={idx} className={styles.eventRow}>
                          <div className={styles.eventIconWrap}>
                            <AlertTriangle size={16} style={{ color: ev.risk_level === 'HIGH' ? '#ef4444' : '#f59e0b' }} />
                          </div>
                          <div className={styles.eventDetails}>
                            <div className={styles.eventTimeAndTitle}>
                              <span>{ev.event_time ? ev.event_time.substring(11, 19) : ''}</span>
                              <span>•</span>
                              <span>[{ev.object_name}]</span>
                            </div>
                            <div className={styles.eventDesc}>{ev.description}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Prescriptive Root Cause Diagnosis & Solution Card */}
                <div className={styles.rootCauseCard}>
                  <div className={styles.rootCauseTitle}>
                    <ShieldCheck size={18} />
                    Akıllı Kök Neden Teşhisi &amp; Önerilen Aksiyon Planı
                  </div>

                  <div className={styles.rootCauseText}>{snapshot.root_cause_diagnosis}</div>

                  {snapshot.recommended_action_sql && (
                    <div className={styles.codeBox}>
                      <div className={styles.codeBoxHeader}>
                        <span>{snapshot.recommended_action_title}</span>
                        <button
                          className={styles.copyCodeBtn}
                          onClick={() => handleCopy(snapshot.recommended_action_sql || '', 'action_sql')}
                        >
                          {copiedKey === 'action_sql' ? <Check size={13} /> : <Copy size={13} />}
                          {copiedKey === 'action_sql' ? 'Kopyalandı!' : 'T-SQL Kopyala'}
                        </button>
                      </div>
                      <pre className={styles.codePre}>{snapshot.recommended_action_sql}</pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
