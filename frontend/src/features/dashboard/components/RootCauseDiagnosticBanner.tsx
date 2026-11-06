import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  ArrowRight,
  Flame,
  Zap,
  Activity,
  Layers,
  Database,
} from 'lucide-react';
import type { BlockingResult, RecoveryReadiness } from '../../../lib/types';
import styles from './RootCauseDiagnosticBanner.module.css';

interface RootCauseDiagnosticBannerProps {
  blocking: BlockingResult | null;
  readiness: RecoveryReadiness[];
  activeSessionsCount: number;
}

export default function RootCauseDiagnosticBanner({
  blocking,
  readiness,
  activeSessionsCount,
}: RootCauseDiagnosticBannerProps) {
  const navigate = useNavigate();

  const blockedChains = blocking?.chains || [];
  const hasBlocking = blocking?.has_blocking || blockedChains.length > 0;
  const rootBlockerSpid = blockedChains[0]?.blocking_session_id;
  const blockedCount = blockedChains.reduce(
    (acc, c) => acc + (c.blocked_sessions?.length || 0),
    0
  );

  const criticalBackups = readiness.filter(
    (r) =>
      r.recovery_point_objective_risk === 'critical' ||
      r.recovery_point_objective_risk === 'high'
  );

  const isCritical = hasBlocking || criticalBackups.length > 0;

  return (
    <div
      className={`${styles.container} ${
        isCritical ? styles.containerCritical : styles.containerHealthy
      }`}
      role="region"
      aria-label="Kök Neden ve Teşhis Özeti"
    >
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <div className={styles.badgeBox}>
            {isCritical ? (
              <Flame size={14} className={styles.iconCritical} />
            ) : (
              <CheckCircle2 size={14} className={styles.iconHealthy} />
            )}
            <span className={styles.badgeText}>
              {isCritical ? 'KÖK NEDEN & TEŞHİS ÖZETİ' : 'SİSTEM SAĞLIKLI & SERBEST AKIŞ'}
            </span>
          </div>
          <span className={styles.headerSub}>
            {isCritical
              ? 'Canlı telemetri üzerinden anlık kök neden ve darboğaz tespiti:'
              : 'Aktif kilitlenme, RPO veri kaybı riski veya CPU kuyruk baskısı tespit edilmedi.'}
          </span>
        </div>

        <button
          type="button"
          className={styles.triageQuickBtn}
          onClick={() => navigate('/instances')}
          title="Canlı Süreç ve Oturum Kokpitini Aç"
        >
          <Activity size={12} />
          <span>Canlı Kokpite Git</span>
        </button>
      </div>

      {isCritical && (
        <div className={styles.findingsList}>
          {/* Finding 1: Root Blocker */}
          {hasBlocking && (
            <div className={styles.findingItem}>
              <div className={styles.findingIndicatorCritical} />
              <div className={styles.findingContent}>
                <div className={styles.findingTitleRow}>
                  <AlertTriangle size={14} className={styles.findingIconCrit} />
                  <span className={styles.findingTitle}>
                    Kök Kilit Bloklayıcı:{' '}
                    <strong>{rootBlockerSpid ? `SPID #${rootBlockerSpid}` : 'Aktif Kilit Zinciri'}</strong>
                  </span>
                  <span className={styles.severityBadge}>Kritik Kilit</span>
                </div>
                <p className={styles.findingDesc}>
                  Sunucuda <strong>{blockedCount || 1} oturum</strong> kilit kaynağı bekliyor.
                  Kök kilit sahibi işlem tamamlanmadıkça kuyruk birikmeye devam eder.
                </p>
              </div>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => navigate('/instances')}
              >
                <span>İncele &amp; KILL Reçetesi</span>
                <ArrowRight size={12} />
              </button>
            </div>
          )}

          {/* Finding 2: Critical RPO Backup */}
          {criticalBackups.length > 0 && (
            <div className={styles.findingItem}>
              <div className={styles.findingIndicatorWarning} />
              <div className={styles.findingContent}>
                <div className={styles.findingTitleRow}>
                  <ShieldAlert size={14} className={styles.findingIconWarn} />
                  <span className={styles.findingTitle}>
                    Yedekleme &amp; RPO Riski:{' '}
                    <strong>{criticalBackups.length} Veritabanı</strong>
                  </span>
                  <span className={styles.severityBadgeWarn}>Veri Kaybı Riski</span>
                </div>
                <p className={styles.findingDesc}>
                  <strong>{criticalBackups.map((c) => c.database_name).slice(0, 4).join(', ')}</strong>{' '}
                  veritabanlarında son 24 saat içinde başarılı tam yedek bulunamadı.
                </p>
              </div>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => navigate('/incidents')}
              >
                <span>Yedekleri Denetle</span>
                <ArrowRight size={12} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
