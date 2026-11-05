import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  TrendingUp,
  AlertTriangle,
  Clock,
  Calendar,
  Check,
  Copy,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { getCapacityRunway } from '../../../lib/api';
import type { CapacityRunwayResponse } from '../../../lib/types';
import styles from './CapacityRunwayForecasting.module.css';

export default function CapacityRunwayForecasting() {
  const [data, setData] = useState<CapacityRunwayResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedDb, setCopiedDb] = useState<string | null>(null);

  const fetchRunway = () => {
    setLoading(true);
    getCapacityRunway()
      .then((res) => setData(res))
      .catch((err) => console.warn('Failed to load capacity runway:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRunway();
  }, []);

  const handleCopy = (dbName: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDb(dbName);
    setTimeout(() => setCopiedDb(null), 2000);
  };

  if (!data && loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Kapasite ve disk tükenme tahminlemesi hesaplanıyor...
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={styles.container}>
      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiTitle}>En Düşük Disk Runway</span>
          <div
            className={styles.kpiValue}
            style={{
              color:
                data.min_runway_days && data.min_runway_days < 30
                  ? '#ef4444'
                  : data.min_runway_days && data.min_runway_days < 90
                  ? '#f59e0b'
                  : '#10b981',
            }}
          >
            {data.min_runway_days !== null ? `${data.min_runway_days} Gün` : 'Geniş Alan'}
          </div>
          <span className={styles.kpiSub}>%90 doluluk eşiğine kalan süre</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiTitle}>Kritik Sürücüler</span>
          <div
            className={styles.kpiValue}
            style={{ color: data.critical_drives_count > 0 ? '#ef4444' : '#10b981' }}
          >
            {data.critical_drives_count} Sürücü
          </div>
          <span className={styles.kpiSub}>30 günden az alanı kalanlar</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiTitle}>Takip Edilen Veritabanları</span>
          <div className={styles.kpiValue}>{data.total_tracked_databases}</div>
          <span className={styles.kpiSub}>Lineer regresyon ile modellenen</span>
        </div>
      </div>

      {/* Runway Database Items */}
      <div className={styles.itemsList}>
        {data.items.map((item) => {
          const isCritical = item.status === 'CRITICAL_RUNWAY';
          const isWarning = item.status === 'WARNING_RUNWAY';

          return (
            <div
              key={item.database_name}
              className={`${styles.runwayCard} ${
                isCritical
                  ? styles.runwayCardCritical
                  : isWarning
                  ? styles.runwayCardWarning
                  : styles.runwayCardHealthy
              }`}
            >
              {/* Card Header */}
              <div className={styles.cardHeader}>
                <div className={styles.dbTitleArea}>
                  <HardDrive size={16} color="var(--accent)" aria-hidden="true" />
                  <span className={styles.dbName}>{item.database_name}</span>
                  <span className={styles.driveTag}>Sürücü {item.drive_letter}</span>
                </div>

                <div
                  className={`${styles.statusBadge} ${
                    isCritical
                      ? styles.badgeCritical
                      : isWarning
                      ? styles.badgeWarning
                      : styles.badgeHealthy
                  }`}
                >
                  {isCritical
                    ? 'Kritik Kapasite Riski'
                    : isWarning
                    ? 'Yakın Dönem Dolum Riski'
                    : 'Yeterli Kapasite'}
                </div>
              </div>

              {/* Card Body */}
              <div className={styles.cardBody}>
                {/* Left: Metrics & Statistics */}
                <div className={styles.metricsCol}>
                  <div className={styles.runwayHighlight}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        %90 Doluma Kalan Süre
                      </div>
                      <div
                        className={styles.runwayDaysVal}
                        style={{ color: isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981' }}
                      >
                        {item.runway_days_to_90pct !== null ? `${item.runway_days_to_90pct} Gün` : '—'}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Tahmini Dolum Tarihi
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                        {item.forecast_exhaustion_date || 'Güvenli'}
                      </div>
                    </div>
                  </div>

                  <div className={styles.metricRow}>
                    <span className={styles.metricLabel}>Sürücü Boş / Toplam:</span>
                    <span className={styles.metricVal}>
                      {item.drive_free_gb} GB / {item.drive_total_gb} GB
                    </span>
                  </div>

                  <div className={styles.metricRow}>
                    <span className={styles.metricLabel}>Günlük Büyüme Hızı:</span>
                    <span className={styles.metricVal}>
                      +{item.daily_growth_mb.toLocaleString()} MB/gün (R²: {item.regression_r_squared})
                    </span>
                  </div>

                  <div className={styles.metricRow}>
                    <span className={styles.metricLabel}>Veri (MDF) / Log (LDF):</span>
                    <span className={styles.metricVal}>
                      {(item.data_size_mb / 1024).toFixed(1)} GB / {(item.log_size_mb / 1024).toFixed(1)} GB
                    </span>
                  </div>
                </div>

                {/* Right: Remediation T-SQL */}
                <div className={styles.remedBox}>
                  <div className={styles.remedHeader}>
                    <span>Önerilen Proaktif T-SQL Reçetesi (Pre-sizing)</span>
                    <button
                      type="button"
                      className={styles.copyBtn}
                      onClick={() => handleCopy(item.database_name, item.remediation_tsql)}
                    >
                      {copiedDb === item.database_name ? (
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
                  </div>
                  <code>{item.remediation_tsql}</code>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
