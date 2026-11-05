import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Check,
  Copy,
  Zap,
  Info,
} from 'lucide-react';
import { getAnomalyRadar } from '../../../lib/api';
import type { AnomalyRadarResponse, AnomalyMetricSeries } from '../../../lib/types';
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

  // Calculate SVG coordinates for active series
  const points = activeSeries?.datapoints || [];
  const maxVal = Math.max(...points.map((p) => Math.max(p.value, p.upper_bound)), 10);
  const minVal = 0;
  const svgWidth = 800;
  const svgHeight = 150;
  const paddingX = 40;
  const paddingY = 20;
  const innerW = svgWidth - paddingX * 2;
  const innerH = svgHeight - paddingY * 2;

  const getX = (idx: number) => paddingX + (idx / Math.max(points.length - 1, 1)) * innerW;
  const getY = (val: number) => svgHeight - paddingY - ((val - minVal) / (maxVal - minVal)) * innerH;

  // Polyline coordinates
  const actualPolyline = points.map((p, i) => `${getX(i)},${getY(p.value)}`).join(' ');
  const meanY = points.length > 0 ? getY(points[0].rolling_mean) : getY(0);
  const uclY = points.length > 0 ? getY(points[0].upper_bound) : getY(0);

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
              onClick={() => setActiveMetricId(s.metric_id)}
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
            <div className={styles.metaItem}>
              <span>Canlı Değer:</span>
              <span className={styles.metaValue}>
                {activeSeries.current_value} {activeSeries.unit}
              </span>
            </div>
            <div className={styles.metaItem}>
              <span>Taban Ortalaması (μ):</span>
              <span className={styles.metaValue}>
                {activeSeries.baseline_mean} {activeSeries.unit}
              </span>
            </div>
            <div className={styles.legendArea}>
              <span className={styles.metaItem}>
                <span className={styles.legendDot} style={{ background: '#38bdf8' }} /> Telemetre
              </span>
              <span className={styles.metaItem}>
                <span className={styles.legendDot} style={{ background: '#ef4444' }} /> Eşik (+2σ)
              </span>
            </div>
          </div>

          <div className={styles.svgWrapper}>
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: '100%' }}>
              {/* UCL Line (+2 sigma) */}
              <line
                x1={paddingX}
                y1={uclY}
                x2={svgWidth - paddingX}
                y2={uclY}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeWidth="1.5"
                opacity="0.8"
              />
              <text x={paddingX + 4} y={uclY - 6} fill="#ef4444" fontSize="10" fontWeight="600">
                Üst Kontrol Eşiği (UCL: +2σ)
              </text>

              {/* Baseline Mean Line */}
              <line
                x1={paddingX}
                y1={meanY}
                x2={svgWidth - paddingX}
                y2={meanY}
                stroke="#64748b"
                strokeDasharray="2 2"
                strokeWidth="1"
                opacity="0.5"
              />

              {/* Data Line */}
              <polyline
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeLinejoin="round"
                points={actualPolyline}
              />

              {/* Points */}
              {points.map((p, i) => {
                const cx = getX(i);
                const cy = getY(p.value);
                const isSpike = p.is_anomaly;
                return (
                  <circle
                    key={i}
                    cx={cx}
                    cy={cy}
                    r={isSpike ? 5 : 3}
                    fill={isSpike ? '#ef4444' : '#38bdf8'}
                    stroke={isSpike ? '#ffffff' : '#080d1a'}
                    strokeWidth="1.5"
                  />
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* Active Anomaly Alerts */}
      {data.alerts.length > 0 && (
        <div className={styles.alertsSection}>
          <div className={styles.alertsSectionTitle}>
            <AlertTriangle size={15} color="#f59e0b" aria-hidden="true" />
            <span>Tespit Edilen Kritik Sapmalar & Aksiyon Planı ({data.alerts.length})</span>
          </div>

          {data.alerts.map((alert) => (
            <div
              key={alert.id}
              className={`${styles.alertCard} ${
                alert.severity === 'CRITICAL' ? styles.alertCardCritical : styles.alertCardWarning
              }`}
            >
              <div className={styles.alertCardHeader}>
                <span className={styles.alertMetricName}>{alert.metric_name}</span>
                <span
                  className={`${styles.riskBadge} ${
                    alert.severity === 'CRITICAL' ? styles.riskCritical : styles.riskWarning
                  }`}
                >
                  Z-Score: +{alert.z_score}σ ({alert.deviation_percent > 0 ? `+${alert.deviation_percent}%` : `${alert.deviation_percent}%`})
                </span>
              </div>

              <p className={styles.alertDesc}>{alert.description}</p>

              <div className={styles.alertHypothesis}>
                <strong>Kök Neden Hipotezi:</strong> {alert.root_cause_hypothesis}
              </div>

              {alert.surgical_tsql && (
                <div className={styles.codeArea}>
                  <button
                    type="button"
                    className={styles.copyCodeBtn}
                    onClick={() => handleCopy(alert.id, alert.surgical_tsql!)}
                  >
                    {copiedId === alert.id ? (
                      <>
                        <Check size={11} color="#4ade80" aria-hidden="true" />
                        <span>Kopyalandı</span>
                      </>
                    ) : (
                      <>
                        <Copy size={11} aria-hidden="true" />
                        <span>T-SQL Kopyala</span>
                      </>
                    )}
                  </button>
                  <code>{alert.surgical_tsql}</code>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
