import React, { useState, useEffect } from 'react';
import {
  Radio,
  Activity,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Flame,
  Cpu,
  Clock,
  Database,
  Copy,
  Check,
  RefreshCw,
  Zap,
  Info,
} from 'lucide-react';
import { getAnomalyRadar } from '../../../lib/api';
import type { AnomalyRadarResponse, DetectedAnomalyAlert, AnomalyMetricSeries } from '../../../lib/types';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import styles from './PredictiveAnomalyRadar.module.css';

export default function PredictiveAnomalyRadar() {
  const [data, setData] = useState<AnomalyRadarResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  const fetchRadar = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAnomalyRadar();
      setData(res);
      if (res.series.length > 0 && !selectedMetric) {
        setSelectedMetric(res.series[0].metric_id);
      }
    } catch (err: any) {
      setError(err?.message || 'Anomali radarı telemetrisi alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRadar();
    const timer = setInterval(fetchRadar, 15000); // 15s refresh
    return () => clearInterval(timer);
  }, []);

  const handleCopy = (id: string, tsql: string) => {
    navigator.clipboard.writeText(tsql);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading && !data) {
    return <LoadingSpinner message="İstatistiksel Z-Skoru ve anomali limitleri hesaplanıyor..." />;
  }

  if (error && !data) {
    return <ErrorState message={error} onRetry={fetchRadar} />;
  }

  if (!data) return null;

  const activeSeries = data.series.find((s) => s.metric_id === selectedMetric) || data.series[0];

  return (
    <div className={styles.container}>
      {/* Top Cockpit Card: Risk Gauge & Overview */}
      <div className={styles.topCard}>
        <div className={styles.topCardLeft}>
          <div className={styles.radarIconBox}>
            <Radio size={22} className={styles.radarPulseIcon} />
          </div>
          <div>
            <div className={styles.titleRow}>
              <h3 className={styles.cardHeading}>Tahminsel Anomali Radarı &amp; Z-Skoru Telemetrisi</h3>
              <span
                className={`${styles.statusBadge} ${
                  data.status === 'CRITICAL'
                    ? styles.badgeCritical
                    : data.status === 'WARNING'
                    ? styles.badgeWarning
                    : styles.badgeNormal
                }`}
              >
                {data.status === 'CRITICAL' ? (
                  <>
                    <Flame size={13} /> Kritik Anomali
                  </>
                ) : data.status === 'WARNING' ? (
                  <>
                    <AlertTriangle size={13} /> Sapma Uyarısı
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} /> Nominal Denge (±2σ İçi)
                  </>
                )}
              </span>
            </div>
            <p className={styles.cardSub}>
              Sistem parametreleri (CPU, PLE, Kilitlenme, TempDB) Gauss normal dağılımı ve hareketli taban çizgisi (Baseline) ile izlenir. <strong>|Z-Score| &ge; 2.0&sigma;</strong> eşiğini aşan sapmalar erken kriz uyarısı üretir.
            </p>
          </div>
        </div>

        <div className={styles.topCardRight}>
          <div className={styles.kpiBox}>
            <span className={styles.kpiLabel}>Sistem Risk İndeksi</span>
            <div className={styles.kpiValRow}>
              <span
                className={styles.riskValue}
                style={{
                  color:
                    data.overall_risk_score >= 70
                      ? '#ef4444'
                      : data.overall_risk_score >= 40
                      ? '#f59e0b'
                      : '#10b981',
                }}
              >
                {data.overall_risk_score}
              </span>
              <span className={styles.riskMax}>/ 100</span>
            </div>
          </div>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={fetchRadar}
            disabled={loading}
            title="Telemetriyi Yenile"
          >
            <RefreshCw size={13} className={loading ? styles.spin : ''} />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* Active Anomaly Alerts (if any) */}
      {data.alerts.length > 0 && (
        <div className={styles.alertsContainer}>
          <div className={styles.sectionHeaderRow}>
            <div className={styles.sectionTitleWithCount}>
              <Flame size={15} color="#ef4444" />
              <span>Aktif Anomali Alarmları ({data.alerts.length})</span>
            </div>
            <span className={styles.alertHint}>Darboğaz büyümeden önce önerilen T-SQL reçeteleri</span>
          </div>

          <div className={styles.alertsGrid}>
            {data.alerts.map((alert: DetectedAnomalyAlert) => (
              <div
                key={alert.id}
                className={`${styles.alertCard} ${
                  alert.severity === 'CRITICAL' ? styles.alertCardCritical : styles.alertCardWarning
                }`}
              >
                <div className={styles.alertHeader}>
                  <div className={styles.alertMetricName}>
                    <span className={styles.alertDot} />
                    <strong>{alert.metric_name}</strong>
                    <span className={styles.zBadge}>Z-Score: +{alert.z_score}&sigma;</span>
                    <span className={styles.devBadge}>
                      {alert.deviation_percent > 0 ? `+${alert.deviation_percent}%` : `${alert.deviation_percent}%`} Sapma
                    </span>
                  </div>
                  <span className={styles.alertTime}>{alert.timestamp}</span>
                </div>

                <p className={styles.alertDesc}>{alert.description}</p>

                <div className={styles.hypothesisBox}>
                  <div className={styles.hypoTitle}>
                    <Info size={12} />
                    <strong>Olası Kök Neden Hipotezi:</strong>
                  </div>
                  <p>{alert.root_cause_hypothesis}</p>
                </div>

                <div className={styles.actionBox}>
                  <strong>Önerilen DBA Aksiyonu:</strong>
                  <p>{alert.recommended_action}</p>
                </div>

                {alert.surgical_tsql && (
                  <div className={styles.tsqlBlock}>
                    <div className={styles.tsqlBlockHeader}>
                      <span className={styles.tsqlLabel}>Teşhis ve Çözüm T-SQL Betiği</span>
                      <button
                        type="button"
                        className={styles.copyBtn}
                        onClick={() => handleCopy(alert.id, alert.surgical_tsql!)}
                      >
                        {copiedId === alert.id ? (
                          <>
                            <Check size={12} color="#10b981" />
                            <span>Kopyalandı</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>Kodu Kopyala</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className={styles.tsqlCode}>{alert.surgical_tsql}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Statistical Series & Z-Score Telemetry Grid */}
      <div className={styles.metricsSection}>
        <div className={styles.sectionHeaderRow}>
          <div className={styles.sectionTitleWithCount}>
            <Activity size={15} color="var(--accent)" />
            <span>Kontrol Limitleri &amp; İstatistiki Dağılım Modeli</span>
          </div>
          <span className={styles.alertHint}>Hareketli ortalama (&mu;) ve kontrol limitleri (&mu; ± 2&sigma;)</span>
        </div>

        <div className={styles.seriesGrid}>
          {data.series.map((series: AnomalyMetricSeries) => {
            const isAnomaly = Math.abs(series.current_z_score) >= 2.0;
            const isElevated = Math.abs(series.current_z_score) >= 1.5;
            const isSelected = selectedMetric === series.metric_id;

            return (
              <div
                key={series.metric_id}
                className={`${styles.seriesCard} ${isSelected ? styles.seriesCardActive : ''}`}
                onClick={() => setSelectedMetric(series.metric_id)}
                role="button"
                tabIndex={0}
              >
                <div className={styles.seriesCardTop}>
                  <span className={styles.metricTitle}>{series.metric_name}</span>
                  <span
                    className={`${styles.zScoreTag} ${
                      isAnomaly ? styles.zCritical : isElevated ? styles.zWarning : styles.zNormal
                    }`}
                  >
                    {series.current_z_score >= 0 ? `+${series.current_z_score}` : series.current_z_score}&sigma;
                  </span>
                </div>

                <div className={styles.metricValRow}>
                  <span className={styles.metricMainVal}>
                    {series.current_value} {series.unit}
                  </span>
                  <span className={styles.baselineLabel}>
                    Taban: {series.baseline_mean} {series.unit} (&sigma;={series.baseline_std})
                  </span>
                </div>

                {/* Statistical Threshold Visual Bar */}
                <div className={styles.thresholdVisual}>
                  <div className={styles.thresholdLabels}>
                    <span>0</span>
                    <span className={styles.meanMark}>&mu; ({series.baseline_mean})</span>
                    <span className={styles.upperMark}>Üst Limit ({roundVal(series.baseline_mean + 2 * series.baseline_std)})</span>
                  </div>
                  <div className={styles.barTrack}>
                    {/* Safe Zone (0 to mean+2std) */}
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${Math.min(100, Math.max(8, (series.current_value / Math.max(series.baseline_mean + 2 * series.baseline_std, 1)) * 75))}%`,
                        background: isAnomaly
                          ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                          : isElevated
                          ? 'linear-gradient(90deg, #38bdf8, #f59e0b)'
                          : 'linear-gradient(90deg, #10b981, #38bdf8)',
                      }}
                    />
                  </div>
                </div>

                <div className={styles.seriesFooter}>
                  <span className={styles.seriesStatusText}>
                    Durum: <strong>{series.status}</strong>
                  </span>
                  <span className={styles.clickInspect}>Trend Grafiği →</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Metric Historical Datapoints */}
      {activeSeries && activeSeries.datapoints.length > 0 && (
        <div className={styles.trendSection}>
          <div className={styles.trendHeader}>
            <div className={styles.trendTitle}>
              <TrendingUp size={15} color="var(--accent)" />
              <strong>{activeSeries.metric_name} — Zaman Serisi Dağılımı</strong>
            </div>
            <span className={styles.trendSub}>
              Son {activeSeries.datapoints.length} ölçüm aralığı (Dakikalık örnekleme)
            </span>
          </div>

          <div className={styles.datapointsTableContainer}>
            <table className={styles.datapointsTable}>
              <thead>
                <tr>
                  <th>ZAMAN</th>
                  <th>GÖZLENEN DEĞER</th>
                  <th>HAREKETLİ ORTALAMA (&mu;)</th>
                  <th>ÜST LİMİT (&mu; + 2&sigma;)</th>
                  <th>Z-SKORU</th>
                  <th>SAPMA DURUMU</th>
                </tr>
              </thead>
              <tbody>
                {activeSeries.datapoints.slice(-12).reverse().map((pt, idx) => (
                  <tr key={idx} className={pt.is_anomaly ? styles.anomalyRow : ''}>
                    <td className={styles.timeCell}>{pt.timestamp}</td>
                    <td className={styles.monoCell}>
                      <strong>{pt.value} {activeSeries.unit}</strong>
                    </td>
                    <td className={styles.monoCell}>{pt.rolling_mean} {activeSeries.unit}</td>
                    <td className={styles.monoCell}>{pt.upper_bound} {activeSeries.unit}</td>
                    <td>
                      <span
                        className={`${styles.zScoreMini} ${
                          Math.abs(pt.z_score) >= 2.0 ? styles.zCritical : styles.zNormal
                        }`}
                      >
                        {pt.z_score >= 0 ? `+${pt.z_score}` : pt.z_score}&sigma;
                      </span>
                    </td>
                    <td>
                      <span
                        className={`${styles.statusMini} ${
                          pt.severity === 'CRITICAL'
                            ? styles.statusCrit
                            : pt.severity === 'WARNING'
                            ? styles.statusWarn
                            : styles.statusNorm
                        }`}
                      >
                        {pt.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function roundVal(v: number): number {
  return Math.round(v * 10) / 10;
}
