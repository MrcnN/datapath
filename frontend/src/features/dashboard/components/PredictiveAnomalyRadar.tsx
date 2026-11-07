import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  RefreshCw,
  Check,
  Copy,
  TrendingUp,
  ShieldAlert,
  Flame,
} from 'lucide-react';
import { getAnomalyRadar } from '../../../lib/api';
import type { AnomalyRadarResponse, AnomalyMetricSeries, DetectedAnomalyAlert } from '../../../lib/types';
import styles from './PredictiveAnomalyRadar.module.css';

export default function PredictiveAnomalyRadar() {
  const [data, setData] = useState<AnomalyRadarResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeMetricId, setActiveMetricId] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchRadar = () => {
    setLoading(true);
    getAnomalyRadar()
      .then((res) => {
        setData(res);
        if (res.series.length > 0 && !activeMetricId) {
          setActiveMetricId(res.series[0].metric_id);
        }
      })
      .catch((err) => {
        console.warn('Failed to load anomaly radar:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchRadar();
  }, []);

  const activeSeries: AnomalyMetricSeries | undefined = useMemo(() => {
    if (!data || !data.series) return undefined;
    return data.series.find((s) => s.metric_id === activeMetricId) || data.series[0];
  }, [data, activeMetricId]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const chartData = useMemo(() => {
    if (!activeSeries || !activeSeries.datapoints) return [];
    return activeSeries.datapoints.map((p, idx) => ({
      index: idx,
      timestamp: p.timestamp,
      value: p.value,
      rolling_mean: p.rolling_mean,
      upper_bound: p.upper_bound,
      lower_bound: p.lower_bound,
      z_score: p.z_score,
      is_anomaly: p.is_anomaly,
      severity: p.severity,
    }));
  }, [activeSeries]);

  const uclThreshold = useMemo(() => {
    if (!activeSeries) return 0;
    return Number((activeSeries.baseline_mean + 2 * activeSeries.baseline_std).toFixed(1));
  }, [activeSeries]);

  const gradientOffset = useMemo(() => {
    if (!chartData || chartData.length === 0 || !activeSeries || uclThreshold <= 0) return 0;
    const values = chartData.map((i) => i.value);
    const dataMax = Math.max(...values);
    const dataMin = Math.min(...values);

    if (dataMax <= uclThreshold) return 0;
    if (dataMin >= uclThreshold) return 1;
    const diff = dataMax - dataMin;
    if (diff <= 0 || isNaN(diff)) return 0;

    const rawOffset = (dataMax - uclThreshold) / diff;
    if (isNaN(rawOffset)) return 0;
    return Math.min(Math.max(rawOffset, 0), 1);
  }, [chartData, activeSeries, uclThreshold]);

  if (!data && loading) {
    return (
      <div className={styles.container}>
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          İstatistiksel Anomali Radarı telemetrisi yükleniyor...
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isCurrentAnomaly = activeSeries ? activeSeries.current_z_score >= 2.0 : false;



  return (
    <div className={styles.container}>
      {/* 1. Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <Activity size={18} className={styles.titleIcon} aria-hidden="true" />
          <div>
            <h3 className={styles.title}>İstatistiksel Anomali & Ani Kriz Radarı</h3>
            <p className={styles.subtitle}>
              Z-Score (Standart Sapma Telemetrisi) ve Hareketli Ortalama ile Darboğaz Tahmini
            </p>
          </div>
        </div>

        <div className={styles.headerActions}>
          <div
            className={`${styles.riskBadge} ${
              data.status === 'CRITICAL'
                ? styles.riskCritical
                : data.status === 'WARNING'
                ? styles.riskWarning
                : styles.riskNormal
            }`}
          >
            <span>Risk Skoru: {data.overall_risk_score}/100</span>
            <span>• {data.status}</span>
          </div>

          <button
            type="button"
            className={styles.refreshBtn}
            onClick={fetchRadar}
            disabled={loading}
            aria-label="Anomali radarını yenile"
          >
            <RefreshCw size={12} className={loading ? 'spinning' : ''} aria-hidden="true" />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* 2. Metric Selector Tabs */}
      <div className={styles.metricTabs} role="tablist">
        {data.series.map((s) => {
          const isActive = s.metric_id === (activeSeries?.metric_id || '');
          const isSpike = s.status === 'ANOMALY_SPIKE';
          return (
            <button
              key={s.metric_id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`${styles.tabBtn} ${isActive ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveMetricId(s.metric_id)}
            >
              <span className={styles.tabName}>{s.metric_name}</span>
              <span
                className={`${styles.zPill} ${
                  isSpike
                    ? styles.zPillSpike
                    : s.status === 'ELEVATED'
                    ? styles.zPillElevated
                    : styles.zPillNormal
                }`}
              >
                {s.current_z_score > 0 ? `+${Number(s.current_z_score).toFixed(1)}σ` : `${Number(s.current_z_score).toFixed(1)}σ`}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Recharts Telemetry Waveform Graph */}
      {activeSeries && (
        <div className={styles.chartContainer}>
          {/* Top Metric Strip */}
          <div className={styles.chartMeta}>
            <div className={styles.metaLeft}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Canlı Değer:</span>
                <span className={isCurrentAnomaly ? styles.metaValGreen : styles.metaValNormal}>
                  {activeSeries.current_value} {activeSeries.unit}
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Taban (μ):</span>
                <span className={styles.metaValMuted}>
                  {activeSeries.baseline_mean} {activeSeries.unit}
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Eşik (+2σ):</span>
                <span className={styles.metaValWarn}>
                  {(activeSeries.baseline_mean + 2 * activeSeries.baseline_std).toFixed(1)} {activeSeries.unit}
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Sapma Z-Score:</span>
                <span className={isCurrentAnomaly ? styles.metaZScoreGreen : styles.metaZScoreNormal}>
                  +{activeSeries.current_z_score}σ
                </span>
              </div>
            </div>

            <div className={styles.legendArea}>
              <span className={styles.legendItem}>
                <span className={styles.legendLineCyan} /> Telemetre (Taban)
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendLineGreen} /> + ya Geçiş (Anomali)
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendLineRed} /> Kontrol Eşiği (+2σ)
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendLineGray} /> Taban Ortalaması (μ)
              </span>
            </div>
          </div>

          {/* Recharts Waveform Area Chart */}
          <div className={styles.chartWrapper}>
            <ResponsiveContainer width="100%" height={255}>
              <AreaChart
                data={chartData}
                margin={{ top: 15, right: 35, left: -15, bottom: 5 }}
              >
                <defs>
                  {/* Split stroke gradient: Above UCL (+) is green #10b981, below is blue #38bdf8 */}
                  <linearGradient id="splitStroke" x1="0" y1="0" x2="0" y2="1">
                    {gradientOffset > 0 ? (
                      <>
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset={`${(gradientOffset * 100).toFixed(1)}%`} stopColor="#10b981" />
                        <stop offset={`${(gradientOffset * 100).toFixed(1)}%`} stopColor="#38bdf8" />
                        <stop offset="100%" stopColor="#38bdf8" />
                      </>
                    ) : (
                      <stop offset="0%" stopColor="#38bdf8" />
                    )}
                  </linearGradient>

                  {/* Split area fill gradient */}
                  <linearGradient id="telemetryGrad" x1="0" y1="0" x2="0" y2="1">
                    {gradientOffset > 0 ? (
                      <>
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.22} />
                        <stop offset={`${(gradientOffset * 100).toFixed(1)}%`} stopColor="#10b981" stopOpacity={0.05} />
                        <stop offset={`${(gradientOffset * 100).toFixed(1)}%`} stopColor="#38bdf8" stopOpacity={0.05} />
                        <stop offset="100%" stopColor="#080d1a" stopOpacity={0} />
                      </>
                    ) : (
                      <>
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.22} />
                        <stop offset="80%" stopColor="#38bdf8" stopOpacity={0.03} />
                        <stop offset="100%" stopColor="#080d1a" stopOpacity={0} />
                      </>
                    )}
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1e293b"
                  vertical={false}
                />

                <XAxis
                  dataKey="timestamp"
                  stroke="#475569"
                  tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickLine={{ stroke: '#334155' }}
                />

                <YAxis
                  stroke="#475569"
                  tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickLine={{ stroke: '#334155' }}
                  domain={[0, 'auto']}
                />

                {/* Base Mean Reference Line */}
                <ReferenceLine
                  y={activeSeries.baseline_mean}
                  stroke="#64748b"
                  strokeDasharray="3 3"
                  strokeWidth={1.2}
                  label={{
                    value: `μ: ${activeSeries.baseline_mean}`,
                    fill: '#94a3b8',
                    fontSize: 10,
                    position: 'right',
                    fontFamily: 'var(--font-mono)',
                  }}
                />

                {/* UCL (+2σ) Reference Line */}
                <ReferenceLine
                  y={Number((activeSeries.baseline_mean + 2 * activeSeries.baseline_std).toFixed(1))}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: 'UCL (+2σ)',
                    fill: '#f87171',
                    fontSize: 10,
                    fontWeight: 700,
                    position: 'right',
                    fontFamily: 'var(--font-mono)',
                  }}
                />

                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className={styles.customTooltip}>
                        <div className={styles.tooltipHead}>
                          <span className={styles.tooltipTime}>{d.timestamp}</span>
                          <span
                            className={
                              d.is_anomaly
                                ? styles.tooltipBadgeGreen
                                : styles.tooltipBadgeNormal
                            }
                          >
                            {d.is_anomaly ? 'KRİTİK SAPMA' : 'NORMAL'}
                          </span>
                        </div>
                        <div className={styles.tooltipRow}>
                          <span>Telemetre:</span>
                          <strong>
                            {d.value} {activeSeries.unit}
                          </strong>
                        </div>
                        <div className={styles.tooltipRow}>
                          <span>Taban Ortalaması (μ):</span>
                          <span>
                            {d.rolling_mean} {activeSeries.unit}
                          </span>
                        </div>
                        <div className={styles.tooltipRow}>
                          <span>Eşik (+2σ):</span>
                          <span>
                            {d.upper_bound} {activeSeries.unit}
                          </span>
                        </div>
                        <div className={styles.tooltipRow}>
                          <span>Sapma Z-Skoru:</span>
                          <span
                            className={
                              d.is_anomaly
                                ? styles.tooltipValGreen
                                : styles.tooltipValCyan
                            }
                          >
                            +{d.z_score}σ
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />

                {/* Smooth Curve Area */}
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={gradientOffset > 0 ? 'url(#splitStroke)' : '#38bdf8'}
                  strokeWidth={2.2}
                  fill="url(#telemetryGrad)"
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    if (!payload.is_anomaly) return <g key={`dot-blank-${payload.index}`} />;
                    return (
                      <g key={`dot-spike-${payload.index}`}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={3.8}
                          fill="#10b981"
                          stroke="#0b1122"
                          strokeWidth={1.5}
                        />
                      </g>
                    );
                  }}
                  activeDot={{
                    r: 5,
                    fill: gradientOffset > 0 ? '#10b981' : '#38bdf8',
                    stroke: '#ffffff',
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 4. Active Anomaly Alerts - Side-by-Side Responsive Grid */}
      {data.alerts.length > 0 && (
        <div className={styles.alertsSection}>
          <div className={styles.alertsSectionTitle}>
            <AlertTriangle size={15} color="#f59e0b" aria-hidden="true" />
            <span>Tespit Edilen Kritik Sapmalar & Aksiyon Planı ({data.alerts.length})</span>
          </div>

          <div className={styles.alertsGrid}>
            {data.alerts.map((alert: DetectedAnomalyAlert) => (
              <div
                key={alert.id}
                className={`${styles.alertCard} ${
                  alert.severity === 'CRITICAL' ? styles.alertCardCritical : styles.alertCardWarning
                }`}
              >
                <div className={styles.alertCardTop}>
                  <div className={styles.alertCardHeader}>
                    <span className={styles.alertMetricName}>{alert.metric_name}</span>
                    <span
                      className={`${styles.riskBadge} ${
                        alert.severity === 'CRITICAL' ? styles.riskCritical : styles.riskWarning
                      }`}
                    >
                      +{alert.z_score}σ ({alert.deviation_percent > 0 ? `+${alert.deviation_percent}%` : `${alert.deviation_percent}%`})
                    </span>
                  </div>

                  <p className={styles.alertDesc}>{alert.description}</p>

                  <div className={styles.alertHypothesis}>
                    <span className={styles.hypoTitle}>Kök Neden Hipotezi: </span>
                    {alert.root_cause_hypothesis}
                  </div>
                </div>

                {alert.surgical_tsql && (
                  <div className={styles.codeArea}>
                    <div className={styles.codeAreaHeader}>
                      <span className={styles.codeTag}>T-SQL Önerisi</span>
                      <button
                        type="button"
                        className={styles.copyCodeBtn}
                        onClick={() => handleCopy(alert.id, alert.surgical_tsql!)}
                        title="T-SQL Komutunu Kopyala"
                      >
                        {copiedId === alert.id ? (
                          <>
                            <Check size={11} color="#4ade80" aria-hidden="true" />
                            <span>Kopyalandı</span>
                          </>
                        ) : (
                          <>
                            <Copy size={11} aria-hidden="true" />
                            <span>Kopyala</span>
                          </>
                        )}
                      </button>
                    </div>
                    <code className={styles.codeContent}>{alert.surgical_tsql}</code>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
