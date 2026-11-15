import React, { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  Layers,
  HardDrive,
  DollarSign,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  Terminal,
  X,
  FileCode,
  ArrowRight,
  ShieldAlert,
  Server,
  Zap,
} from 'lucide-react';
import styles from './ResourceRightSizingStudio.module.css';
import { getRightSizingAdvisor } from '../../../lib/api';
import type {
  RightSizingResponse,
  RightSizingAdvice,
  ResourceMetricUtilization,
} from '../../../lib/types';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';

export default function ResourceRightSizingStudio() {
  const [data, setData] = useState<RightSizingResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [modalSql, setModalSql] = useState<{ title: string; desc: string; sql: string } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getRightSizingAdvisor();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Kaynak boyutlandırma verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopy = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <LoadingSpinner message="Donanım tahsisleri, CPU/RAM metrikleri ve kaynak boyutlandırma fırsatları taranıyor..." />;
  }

  if (error || !data) {
    return <ErrorState message={error || 'Boyutlandırma verisi yüklenemedi.'} onRetry={loadData} />;
  }

  const { summary, metrics, recommendations } = data;

  return (
    <div className={styles.container}>
      {/* High-Level KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Boyutlandırma Sağlığı</span>
            <div
              className={styles.kpiIconWrap}
              style={{
                background:
                  summary.overall_sizing_health === 'UNDER_PROVISIONED'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : summary.overall_sizing_health === 'OVER_PROVISIONED'
                    ? 'rgba(234, 179, 8, 0.15)'
                    : 'rgba(34, 197, 94, 0.15)',
                color:
                  summary.overall_sizing_health === 'UNDER_PROVISIONED'
                    ? 'var(--status-danger)'
                    : summary.overall_sizing_health === 'OVER_PROVISIONED'
                    ? '#eab308'
                    : 'var(--status-success)',
              }}
            >
              <Server size={17} />
            </div>
          </div>
          <div
            className={styles.kpiValue}
            style={{
              fontSize: '18px',
              color:
                summary.overall_sizing_health === 'UNDER_PROVISIONED'
                  ? 'var(--status-danger)'
                  : summary.overall_sizing_health === 'OVER_PROVISIONED'
                  ? '#eab308'
                  : 'var(--status-success)',
            }}
          >
            {summary.overall_sizing_health === 'UNDER_PROVISIONED'
              ? 'Yetersiz Kaynak (Darboğaz)'
              : summary.overall_sizing_health === 'OVER_PROVISIONED'
              ? 'Aşırı Tahsis (Tasarruf Fırsatı)'
              : 'Optimal Boyutlandırma'}
          </div>
          <div className={styles.kpiSub}>{summary.edition}</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Tahmini Aylık Tasarruf</span>
            <div className={styles.kpiIconWrap} style={{ background: 'rgba(34, 197, 94, 0.15)', color: 'var(--status-success)' }}>
              <DollarSign size={17} />
            </div>
          </div>
          <div className={styles.kpiValue} style={{ color: 'var(--status-success)' }}>
            ${summary.potential_monthly_savings_usd.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: 500 }}>/ ay</span>
          </div>
          <div className={styles.kpiSub}>vCPU &amp; Bulut lisans optimizasyonu</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Mevcut Donanım Tahsisi</span>
            <div className={styles.kpiIconWrap} style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)' }}>
              <Cpu size={17} />
            </div>
          </div>
          <div className={styles.kpiValue}>
            {summary.cpu_cores} vCPU • {summary.total_ram_gb.toFixed(0)} GB
          </div>
          <div className={styles.kpiSub}>Sunucu: {summary.server_name}</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Optimizasyon Fırsatları</span>
            <div className={styles.kpiIconWrap} style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}>
              <TrendingDown size={17} />
            </div>
          </div>
          <div className={styles.kpiValue}>
            {summary.waste_opportunities_count + summary.bottlenecks_count}{' '}
            <span style={{ fontSize: '14px', fontWeight: 500 }}>Aksiyon</span>
          </div>
          <div className={styles.kpiSub}>
            {summary.bottlenecks_count} kritik darboğaz, {summary.waste_opportunities_count} maliyet fırsatı
          </div>
        </div>
      </div>

      {/* Hardware Utilization Cards */}
      <div className={styles.metricsGrid}>
        {metrics.map((m, idx) => {
          const isOver = m.status === 'OVER_PROVISIONED';
          const isUnder = m.status === 'UNDER_PROVISIONED';
          const barColor = isUnder ? 'var(--status-danger)' : isOver ? '#eab308' : 'var(--accent-blue)';
          return (
            <div key={idx} className={styles.metricCard}>
              <div className={styles.metricCardHeader}>
                <span className={styles.metricTypeName}>
                  {m.resource_type === 'CPU' ? (
                    <Cpu size={16} color="var(--accent-blue)" />
                  ) : m.resource_type === 'MEMORY' ? (
                    <Layers size={16} color="var(--accent-purple)" />
                  ) : (
                    <HardDrive size={16} color="var(--accent-cyan)" />
                  )}
                  {m.allocated_capacity}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: isUnder ? 'rgba(239, 68, 68, 0.15)' : isOver ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                    color: isUnder ? 'var(--status-danger)' : isOver ? '#eab308' : 'var(--status-success)',
                    fontWeight: 600,
                  }}
                >
                  {isUnder ? 'Yetersiz (Baskı)' : isOver ? 'Aşırı Tahsis' : 'Dengeli'}
                </span>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Ortalama Kullanım</span>
                  <strong style={{ color: 'var(--text-primary)' }}>%{m.avg_utilization_pct.toFixed(1)}</strong>
                </div>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{
                      width: `${Math.min(100, Math.max(5, m.avg_utilization_pct))}%`,
                      background: barColor,
                    }}
                  />
                </div>
              </div>

              <div className={styles.statsRow}>
                <span>Zirve (Peak): %{m.peak_utilization_pct.toFixed(0)}</span>
                <span>P95 Tüketim: %{m.p95_utilization_pct.toFixed(0)}</span>
              </div>

              <div className={styles.verdictBox}>{m.verdict_text}</div>
            </div>
          );
        })}
      </div>

      {/* Recommendations Matrix */}
      <div className={styles.recsSection}>
        <div className={styles.recsHeader}>
          <span className={styles.recsTitle}>
            <Zap size={16} color="var(--accent-blue)" />
            Kaynak Boyutlandırma &amp; Yapılandırma Reçeteleri ({recommendations.length})
          </span>
          <button type="button" className={styles.actionBtn} onClick={loadData}>
            <RefreshCw size={13} /> Yenile
          </button>
        </div>

        {recommendations.map((rec, idx) => (
          <div key={idx} className={styles.recItem}>
            <div className={styles.recMain}>
              <div className={styles.recTop}>
                <span className={styles.recHeading}>{rec.title}</span>
                <span
                  style={{
                    fontSize: '10.5px',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background:
                      rec.urgency === 'HIGH'
                        ? 'rgba(239, 68, 68, 0.15)'
                        : rec.urgency === 'MEDIUM'
                        ? 'rgba(234, 179, 8, 0.15)'
                        : 'rgba(34, 197, 94, 0.15)',
                    color:
                      rec.urgency === 'HIGH'
                        ? 'var(--status-danger)'
                        : rec.urgency === 'MEDIUM'
                        ? '#eab308'
                        : 'var(--status-success)',
                    fontWeight: 600,
                  }}
                >
                  {rec.urgency === 'HIGH' ? 'Önemli Darboğaz' : rec.urgency === 'MEDIUM' ? 'Orta Öncelik' : 'Tasarruf Fırsatı'}
                </span>
              </div>

              <div className={styles.configComparison}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Mevcut: </span>
                  <strong style={{ color: 'var(--text-primary)' }}>{rec.current_configuration}</strong>
                </div>
                <ArrowRight size={14} color="var(--text-muted)" style={{ marginTop: '2px' }} />
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Hedef: </span>
                  <strong style={{ color: 'var(--accent-blue)' }}>{rec.recommended_configuration}</strong>
                </div>
              </div>

              <div className={styles.recRationale}>{rec.rationale}</div>
            </div>

            <div className={styles.recActions}>
              {rec.estimated_monthly_savings_usd > 0 && (
                <div className={styles.savingsPill}>
                  <TrendingDown size={12} />
                  +${rec.estimated_monthly_savings_usd.toLocaleString()}/ay
                </div>
              )}
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() =>
                  setModalSql({
                    title: rec.title,
                    desc: rec.rationale,
                    sql: rec.remediation_sql,
                  })
                }
              >
                <FileCode size={12} /> Reçeteyi İncele
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Drawer */}
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
