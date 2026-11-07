import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  RefreshCw,
  Check,
  Copy,
} from 'lucide-react';
import { getAnomalyRadar } from '../../../lib/api';
import type { AnomalyRadarResponse, AnomalyMetricSeries, AnomalyMetricPoint } from '../../../lib/types';
import styles from './PredictiveAnomalyRadar.module.css';

export default function PredictiveAnomalyRadar() {
  const [data, setData] = useState<AnomalyRadarResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeMetricId, setActiveMetricId] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

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

  if (!data && loading) {
    return (
      <div className={styles.container}>
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          İstatistiksel Anomali Radarı yükleniyor...
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Chart dimensions & calculations
  const points = activeSeries?.datapoints || [];
  const maxDataVal = Math.max(...points.map((p) => Math.max(p.value, p.upper_bound)), 10);
  const maxVal = Math.ceil(maxDataVal * 1.15); // give 15% headroom at the top
  const minVal = 0;

  const svgWidth = 840;
  const svgHeight = 210;
  const paddingLeft = 52;
  const paddingRight = 72;
  const paddingTop = 22;
  const paddingBottom = 32;

  const innerW = svgWidth - paddingLeft - paddingRight;
  const innerH = svgHeight - paddingTop - paddingBottom;

  const getX = (idx: number) => paddingLeft + (idx / Math.max(points.length - 1, 1)) * innerW;
  const getY = (val: number) => paddingTop + innerH - ((val - minVal) / (maxVal - minVal)) * innerH;

  // Actual polyline and area path
  const actualPolyline = points.map((p, i) => `${getX(i).toFixed(1)},${getY(p.value).toFixed(1)}`).join(' ');
  const areaPath = points.length > 0
    ? `M ${getX(0).toFixed(1)},${(paddingTop + innerH).toFixed(1)} ` +
      points.map((p, i) => `L ${getX(i).toFixed(1)},${getY(p.value).toFixed(1)}`).join(' ') +
      ` L ${getX(points.length - 1).toFixed(1)},${(paddingTop + innerH).toFixed(1)} Z`
    : '';

  const meanY = points.length > 0 ? getY(points[0].rolling_mean) : getY(0);
  const uclY = points.length > 0 ? getY(points[0].upper_bound) : getY(0);

  // Time labels (pick ~5 evenly distributed points)
  const timeIndices: number[] = [];
  if (points.length > 0) {
    const step = Math.max(1, Math.floor((points.length - 1) / 4));
    for (let i = 0; i < points.length; i += step) {
      timeIndices.push(i);
    }
    if (timeIndices[timeIndices.length - 1] !== points.length - 1) {
      timeIndices.push(points.length - 1);
    }
  }

  const hoveredPoint: AnomalyMetricPoint | null =
    hoveredIdx !== null && points[hoveredIdx] ? points[hoveredIdx] : null;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <Activity size={20} className={styles.titleIcon} aria-hidden="true" />
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

      {/* Metric Selector Tabs */}
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
              onClick={() => {
                setActiveMetricId(s.metric_id);
                setHoveredIdx(null);
              }}
            >
              <span>{s.metric_name}</span>
              <span
                className={`${styles.zPill} ${
                  isSpike
                    ? styles.zPillSpike
                    : s.status === 'ELEVATED'
                    ? styles.zPillElevated
                    : styles.zPillNormal
                }`}
              >
                {s.current_z_score > 0 ? `+${s.current_z_score}σ` : `${s.current_z_score}σ`}
              </span>
            </button>
          );
        })}
      </div>

      {/* SVG Time-Series Chart */}
      {activeSeries && (
        <div className={styles.chartContainer}>
          <div className={styles.chartMeta}>
            <div className={styles.metaLeft}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Canlı Değer:</span>
                <span className={styles.metaValue}>
                  {activeSeries.current_value} {activeSeries.unit}
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Taban Ortalaması (μ):</span>
                <span className={styles.metaValueMuted}>
                  {activeSeries.baseline_mean} {activeSeries.unit}
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Z-Score:</span>
                <span className={activeSeries.current_z_score >= 2 ? styles.metaZScoreCritical : styles.metaZScoreNormal}>
                  {activeSeries.current_z_score > 0 ? `+${activeSeries.current_z_score}σ` : `${activeSeries.current_z_score}σ`}
                </span>
              </div>
            </div>

            <div className={styles.legendArea}>
              <span className={styles.metaItem}>
                <span className={styles.legendDot} style={{ background: '#38bdf8' }} /> Telemetre
              </span>
              <span className={styles.metaItem}>
                <span className={styles.legendDash} style={{ borderColor: '#ef4444' }} /> Eşik (+2σ)
              </span>
              <span className={styles.metaItem}>
                <span className={styles.legendDash} style={{ borderColor: '#64748b' }} /> Taban (μ)
              </span>
            </div>
          </div>

          <div className={styles.svgWrapper}>
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className={styles.chartSvg}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.28" />
                  <stop offset="85%" stopColor="#38bdf8" stopOpacity="0.03" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="anomalyZoneGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Anomaly Warning Zone (above UCL) */}
              {uclY > paddingTop && (
                <rect
                  x={paddingLeft}
                  y={paddingTop}
                  width={innerW}
                  height={Math.max(0, uclY - paddingTop)}
                  fill="url(#anomalyZoneGrad)"
                  rx="3"
                />
              )}

              {/* Grid Background Horizontal Lines */}
              <line
                x1={paddingLeft}
                y1={paddingTop + innerH}
                x2={paddingLeft + innerW}
                y2={paddingTop + innerH}
                stroke="#1e293b"
                strokeWidth="1"
              />
              <line
                x1={paddingLeft}
                y1={paddingTop + innerH * 0.5}
                x2={paddingLeft + innerW}
                y2={paddingTop + innerH * 0.5}
                stroke="#1e293b"
                strokeDasharray="2 3"
                strokeWidth="1"
                opacity="0.6"
              />

              {/* Baseline Mean Line (μ) */}
              <line
                x1={paddingLeft}
                y1={meanY}
                x2={paddingLeft + innerW}
                y2={meanY}
                stroke="#64748b"
                strokeDasharray="3 3"
                strokeWidth="1.2"
                opacity="0.75"
              />
              <text
                x={paddingLeft + innerW + 8}
                y={meanY + 3.5}
                fill="#94a3b8"
                fontSize="10"
                fontFamily="var(--font-mono)"
                fontWeight="500"
              >
                μ ({activeSeries.baseline_mean})
              </text>

              {/* UCL Line (+2 sigma) */}
              <line
                x1={paddingLeft}
                y1={uclY}
                x2={paddingLeft + innerW}
                y2={uclY}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeWidth="1.5"
                opacity="0.9"
              />
              <text
                x={paddingLeft + innerW + 8}
                y={uclY + 3.5}
                fill="#f87171"
                fontSize="10"
                fontFamily="var(--font-mono)"
                fontWeight="700"
              >
                UCL (+2σ)
              </text>

              {/* Y-axis Labels on Left */}
              <text
                x={paddingLeft - 8}
                y={paddingTop + 4}
                textAnchor="end"
                fill="#64748b"
                fontSize="9.5"
                fontFamily="var(--font-mono)"
              >
                {maxVal}
              </text>
              <text
                x={paddingLeft - 8}
                y={paddingTop + innerH + 3}
                textAnchor="end"
                fill="#64748b"
                fontSize="9.5"
                fontFamily="var(--font-mono)"
              >
                0
              </text>

              {/* Area under curve */}
              {areaPath && <path d={areaPath} fill="url(#areaGradient)" />}

              {/* Polyline */}
              <polyline
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.2"
                strokeLinejoin="round"
                strokeLinecap="round"
                filter="url(#glow)"
                points={actualPolyline}
              />

              {/* Time axis ticks & labels at bottom */}
              {timeIndices.map((idx) => {
                const p = points[idx];
                if (!p) return null;
                const cx = getX(idx);
                const isLast = idx === points.length - 1;
                return (
                  <g key={`time-${idx}`}>
                    <line
                      x1={cx}
                      y1={paddingTop + innerH}
                      x2={cx}
                      y2={paddingTop + innerH + 4}
                      stroke="#475569"
                      strokeWidth="1"
                    />
                    <text
                      x={cx}
                      y={paddingTop + innerH + 18}
                      textAnchor="middle"
                      fill={isLast ? '#38bdf8' : '#64748b'}
                      fontSize="9.5"
                      fontFamily="var(--font-mono)"
                      fontWeight={isLast ? '600' : '400'}
                    >
                      {isLast ? `${p.timestamp} (Şimdi)` : p.timestamp}
                    </text>
                  </g>
                );
              })}

              {/* Interactive Hover Guides & Tooltip */}
              {hoveredIdx !== null && points[hoveredIdx] && (
                <line
                  x1={getX(hoveredIdx)}
                  y1={paddingTop}
                  x2={getX(hoveredIdx)}
                  y2={paddingTop + innerH}
                  stroke="#38bdf8"
                  strokeDasharray="2 2"
                  strokeWidth="1"
                  opacity="0.8"
                />
              )}

              {/* Data Points */}
              {points.map((p, i) => {
                const cx = getX(i);
                const cy = getY(p.value);
                const isSpike = p.is_anomaly;
                const isHovered = hoveredIdx === i;

                return (
                  <g
                    key={`point-${i}`}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredIdx(i)}
                  >
                    {/* Invisible larger hit target for smooth hover */}
                    <circle cx={cx} cy={cy} r="14" fill="transparent" />

                    {isSpike && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isHovered ? 8 : 6.5}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="1.5"
                        opacity="0.6"
                      />
                    )}

                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered ? 5.5 : isSpike ? 4.5 : 3}
                      fill={isSpike ? '#ef4444' : isHovered ? '#ffffff' : '#38bdf8'}
                      stroke={isSpike ? '#ffffff' : '#080d1a'}
                      strokeWidth={isHovered ? 2 : 1.5}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Floating Tooltip Box */}
            {hoveredPoint && hoveredIdx !== null && (
              <div
                className={styles.chartTooltip}
                style={{
                  left: `${(getX(hoveredIdx) / svgWidth) * 100}%`,
                  top: `${(getY(hoveredPoint.value) / svgHeight) * 100}%`,
                }}
              >
                <div className={styles.tooltipTime}>{hoveredPoint.timestamp}</div>
                <div className={styles.tooltipRow}>
                  <span>Değer:</span>
                  <strong>{hoveredPoint.value} {activeSeries.unit}</strong>
                </div>
                <div className={styles.tooltipRow}>
                  <span>Z-Score:</span>
                  <span className={hoveredPoint.is_anomaly ? styles.tooltipCritical : styles.tooltipNormal}>
                    +{hoveredPoint.z_score}σ {hoveredPoint.is_anomaly ? '(Kritik Sapma)' : '(Normal)'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Anomaly Alerts - Side-by-Side Responsive Grid */}
      {data.alerts.length > 0 && (
        <div className={styles.alertsSection}>
          <div className={styles.alertsSectionTitle}>
            <AlertTriangle size={15} color="#f59e0b" aria-hidden="true" />
            <span>Tespit Edilen Kritik Sapmalar & Aksiyon Planı ({data.alerts.length})</span>
          </div>

          <div className={styles.alertsGrid}>
            {data.alerts.map((alert) => (
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
