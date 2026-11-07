import React, { useState } from 'react';
import {
  X,
  Zap,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Clock,
  Play,
  Database,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { simulateLock } from '../../../lib/api';
import type { IncidentSimulationResponse } from '../../../lib/types';
import styles from './IncidentSimulatorModal.module.css';

interface IncidentSimulatorModalProps {
  onClose: () => void;
  onSimulationStarted?: (result: IncidentSimulationResponse) => void;
}

export default function IncidentSimulatorModal({
  onClose,
  onSimulationStarted,
}: IncidentSimulatorModalProps) {
  const [scenario, setScenario] = useState<'BLOCKING' | 'DEADLOCK'>('BLOCKING');
  const [duration, setDuration] = useState<number>(15);
  const [database, setDatabase] = useState<string>('Datapath_TestDB');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<IncidentSimulationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStartSimulation = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await simulateLock({
        simulation_type: scenario,
        duration_seconds: duration,
        target_database: database,
      });
      setResult(res);
      if (onSimulationStarted) {
        onSimulationStarted(res);
      }
    } catch (err: any) {
      setError(err?.message || 'Simülasyon başlatılırken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.iconBox}>
              <Zap size={18} />
            </div>
            <div>
              <h3 className={styles.title}>Canlı Kriz &amp; Kilitlenme Simülatörü</h3>
              <p className={styles.subtitle}>
                Test ortamında kontrollü kilitlenme zinciri veya deadlock oluşturarak Datapath teşhis araçlarını canlı doğrulayın.
              </p>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Kapat">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className={styles.body}>
          {/* Target DB Selector */}
          <div className={styles.fieldRow}>
            <label className={styles.label}>
              <Database size={13} />
              <span>Hedef Test Veritabanı:</span>
            </label>
            <input
              type="text"
              className={styles.input}
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
              placeholder="Örn: Datapath_TestDB"
            />
          </div>

          {/* Scenario Cards */}
          <div className={styles.scenariosGrid}>
            <div
              className={`${styles.scenarioCard} ${scenario === 'BLOCKING' ? styles.scenarioCardActive : ''}`}
              onClick={() => setScenario('BLOCKING')}
              role="button"
              tabIndex={0}
            >
              <div className={styles.scenarioCardTop}>
                <AlertTriangle size={16} color="#f59e0b" />
                <span className={styles.scenarioName}>Geçici Kilit Zinciri (Blocking Storm)</span>
              </div>
              <p className={styles.scenarioDesc}>
                Arka planda özel bir işlem başlatıp <strong>{duration} saniye</strong> boyunca <code>Orders</code> tablosunu kilitler. İkinci oturum <code>LCK_M_S</code> beklemesine girer. <strong>WhoIsActive</strong> ve <strong>Kök Engelleyici Ağacı</strong> canlı SPID ile dolar.
              </p>
              <div className={styles.durationRow}>
                <Clock size={12} />
                <span>Otomatik Çözülme: <strong>{duration} saniye</strong> (Safe Rollback)</span>
              </div>
            </div>

            <div
              className={`${styles.scenarioCard} ${scenario === 'DEADLOCK' ? styles.scenarioCardActive : ''}`}
              onClick={() => setScenario('DEADLOCK')}
              role="button"
              tabIndex={0}
            >
              <div className={styles.scenarioCardTop}>
                <Flame size={16} color="#ef4444" />
                <span className={styles.scenarioName}>Karşılıklı Kilitlenme (Deadlock)</span>
              </div>
              <p className={styles.scenarioDesc}>
                İki işlem arasında çapraz kilitlenme (Customers &harr; Orders) tetikler. SQL Server motoru <strong>1205</strong> kurbanını seçer ve <strong>Deadlock Grafiği</strong> Extended Events ring buffer'ına yazılır.
              </p>
              <div className={styles.durationRow}>
                <ShieldAlert size={12} />
                <span>Öncelik: <code>DEADLOCK_PRIORITY LOW</code> ile güvenli kurban</span>
              </div>
            </div>
          </div>

          {error && <div className={styles.errorAlert}>{error}</div>}

          {/* Active Result Banner */}
          {result && (
            <div className={styles.resultBanner}>
              <div className={styles.resultTop}>
                <CheckCircle2 size={16} color="#10b981" />
                <strong>{result.message}</strong>
              </div>
              <div className={styles.spidRow}>
                {result.blocker_spid && (
                  <span className={styles.spidBadgeBlocker}>
                    Kök Engelleyici: <strong>SPID #{result.blocker_spid}</strong>
                  </span>
                )}
                {result.waiter_spid && (
                  <span className={styles.spidBadgeWaiter}>
                    Bekleyen Kurban: <strong>SPID #{result.waiter_spid}</strong>
                  </span>
                )}
                {result.victim_spid && (
                  <span className={styles.spidBadgeVictim}>
                    Deadlock Kurbanı: <strong>SPID #{result.victim_spid}</strong>
                  </span>
                )}
              </div>
              <p className={styles.resultHint}>
                {scenario === 'BLOCKING'
                  ? 'Şimdi "Canlı Süreç & Oturumlar" veya "Engelleme Zincirleri" sekmesini yenileyerek kilitlenmeyi canlı gözlemleyebilirsiniz.'
                  : 'Şimdi "Kilitlenme Analizi (Deadlock)" sekmesinden yeni oluşan interaktif XML grafiğini inceleyebilirsiniz.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            {result ? 'Kapat' : 'Vazgeç'}
          </button>
          <button
            type="button"
            className={styles.startBtn}
            onClick={handleStartSimulation}
            disabled={loading}
          >
            <Play size={13} />
            <span>{loading ? 'Simülasyon Başlatılıyor...' : 'Kriz Simülasyonunu Çalıştır'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
