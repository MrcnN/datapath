import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Activity,
  Cpu,
  HardDrive,
  Database,
  FileCheck,
} from 'lucide-react';
import { getHealthScore } from '../../../lib/api';
import type { HealthScoreResponse, HealthPillar } from '../../../lib/types';
import styles from './HealthScoreCard.module.css';

const pillarIcons: Record<string, React.ReactNode> = {
  cpu_waits: <Cpu size={13} />,
  memory: <Activity size={13} />,
  storage_io: <HardDrive size={13} />,
  integrity: <ShieldCheck size={13} />,
  backups: <Database size={13} />,
};

export default function HealthScoreCard() {
  const [data, setData] = useState<HealthScoreResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showDetails, setShowDetails] = useState<boolean>(false);

  const fetchScore = async () => {
    try {
      setLoading(true);
      const res = await getHealthScore();
      setData(res);
    } catch (err) {
      console.warn('Failed to load health score:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScore();
  }, []);

  if (!data && !loading) {
    return null;
  }

  const score = data?.overall_score ?? 0;
  const grade = data?.grade ?? '—';
  const status = data?.status ?? 'healthy';

  const dialClass =
    status === 'healthy'
      ? styles.dialHealthy
      : status === 'warning'
      ? styles.dialWarning
      : styles.dialCritical;

  const statusLabel =
    status === 'healthy' ? 'Sağlıklı' : status === 'warning' ? 'Uyarı' : 'Kritik';

  const statusPillStyle = {
    backgroundColor:
      status === 'healthy'
        ? 'rgba(16, 185, 129, 0.15)'
        : status === 'warning'
        ? 'rgba(245, 158, 11, 0.15)'
        : 'rgba(239, 68, 68, 0.15)',
    color:
      status === 'healthy'
        ? '#10b981'
        : status === 'warning'
        ? '#f59e0b'
        : '#ef4444',
  };

  return (
    <div className={styles.card}>
      <div className={styles.topRow}>
        <div className={styles.scoreBanner}>
          <div className={`${styles.dialBox} ${dialClass}`}>
            <span className={styles.scoreNumber}>{loading ? '...' : score}</span>
            <span
              className={styles.scoreGrade}
              style={{
                color:
                  grade === 'A'
                    ? '#10b981'
                    : grade === 'B'
                    ? '#38bdf8'
                    : grade === 'C'
                    ? '#f59e0b'
                    : '#ef4444',
              }}
            >
              Grade {grade}
            </span>
          </div>

          <div className={styles.titleArea}>
            <div className={styles.titleRow}>
              <h2 className={styles.cardTitle}>Veritabanı Kümülatif Sağlık Skoru</h2>
              <span className={styles.statusPill} style={statusPillStyle}>
                {statusLabel}
              </span>
            </div>
            <p className={styles.summaryText}>
              {data?.summary || 'Sistem bileşenleri denetleniyor...'}
            </p>
          </div>
        </div>

        <div className={styles.actionsArea}>
          <button
            type="button"
            className={styles.toggleDetailsBtn}
            onClick={() => setShowDetails(!showDetails)}
          >
            <span>{showDetails ? 'Detayları Gizle' : 'Kök Neden & Teşhis'}</span>
            {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <button
            type="button"
            className={styles.refreshBtn}
            onClick={fetchScore}
            disabled={loading}
            title="Skoru Yeniden Hesapla"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* 5 Pillars Progress Bar Grid */}
      {data?.pillars && data.pillars.length > 0 && (
        <div className={styles.pillarsGrid}>
          {data.pillars.map((pillar) => {
            const pct = Math.round((pillar.score / pillar.weight) * 100);
            const fillClass =
              pillar.status === 'healthy'
                ? styles.fillHealthy
                : pillar.status === 'warning'
                ? styles.fillWarning
                : styles.fillCritical;

            return (
              <div key={pillar.id} className={styles.pillarCard}>
                <div className={styles.pillarHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {pillarIcons[pillar.id] || <FileCheck size={13} />}
                    </span>
                    <span className={styles.pillarName}>{pillar.name}</span>
                  </div>
                  <span className={styles.pillarScore}>
                    {pillar.score}/{pillar.weight}
                  </span>
                </div>
                <div className={styles.progressBarTrack}>
                  <div
                    className={`${styles.progressBarFill} ${fillClass}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Expandable Diagnostic Findings & Recommendations */}
      {showDetails && data?.pillars && (
        <div className={styles.detailsDrawer}>
          <div className={styles.detailsHeader}>Bileşen Bazlı Cerrahi Teşhis ve Bulgular</div>
          <div className={styles.detailsList}>
            {data.pillars.map((p) => (
              <div key={p.id} className={styles.detailItem}>
                <div className={styles.detailPillarTitle}>
                  {p.name} ({p.score}/{p.weight} Puan)
                </div>
                {p.findings.map((f, i) => (
                  <div key={i} className={styles.findingBullet}>
                    {f}
                  </div>
                ))}
                {p.recommendations.map((r, i) => (
                  <div key={i} className={styles.recBullet}>
                    {r}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
