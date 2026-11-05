import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  Clock,
  Play,
  Copy,
  Check,
  AlertTriangle,
  FileCode,
  Layers,
  Database,
  ArrowRight,
  Info,
} from 'lucide-react';
import { getLSNChains, simulatePointInTimeRestore } from '../../../lib/api';
import type { LSNChainStatus, RestoreSimulationResult } from '../../../lib/types';
import styles from './DisasterRecoverySimulator.module.css';

export default function DisasterRecoverySimulator() {
  const [chains, setChains] = useState<LSNChainStatus[]>([]);
  const [loadingChains, setLoadingChains] = useState<boolean>(true);
  const [selectedDb, setSelectedDb] = useState<string>('FinansDB');
  const [targetTime, setTargetTime] = useState<string>('');
  const [simResult, setSimResult] = useState<RestoreSimulationResult | null>(null);
  const [loadingSim, setLoadingSim] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize target time to 45 minutes ago
  useEffect(() => {
    const d = new Date(Date.now() - 45 * 60 * 1000);
    const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setTargetTime(localIso);
  }, []);

  const fetchChains = async () => {
    try {
      setLoadingChains(true);
      setError(null);
      const data = await getLSNChains();
      setChains(data);
      if (data.length > 0 && !selectedDb) {
        setSelectedDb(data[0].database_name);
      }
    } catch (err: any) {
      setError(err.message || 'LSN zincir durumu alınamadı.');
    } finally {
      setLoadingChains(false);
    }
  };

  useEffect(() => {
    fetchChains();
  }, []);

  const handleSimulate = async (db?: string, timeStr?: string) => {
    const targetDb = db || selectedDb;
    const targetDt = timeStr || targetTime.replace('T', ' ') + ':00';
    try {
      setLoadingSim(true);
      const res = await simulatePointInTimeRestore({
        database_name: targetDb,
        target_time_iso: targetDt,
      });
      setSimResult(res);
    } catch (err: any) {
      setError(err.message || 'Kurtarma simülasyonu çalıştırılamadı.');
    } finally {
      setLoadingSim(false);
    }
  };

  // Run initial simulation once chains load
  useEffect(() => {
    if (chains.length > 0 && !simResult) {
      handleSimulate('FinansDB');
    }
  }, [chains]);

  const handlePreset = (minutesAgo: number) => {
    const d = new Date(Date.now() - minutesAgo * 60 * 1000);
    const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setTargetTime(localIso);
    handleSimulate(selectedDb, localIso.replace('T', ' ') + ':00');
  };

  const handleCopyScript = () => {
    if (!simResult?.full_restore_tsql) return;
    navigator.clipboard.writeText(simResult.full_restore_tsql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.container}>
      {/* 1. LSN Continuity Radar */}
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <RotateCcw className={styles.titleIcon} size={20} />
            <div>
              <h3 className={styles.title}>LSN Zincir Sürekliliği &amp; Log Kurtarma Uygunluğu</h3>
              <p className={styles.subtitle}>
                msdb.dbo.backupset üzerinde first_lsn ve last_lsn ardışıklığı taranarak plansız harici yedeklerin yol açtığı zincir kopuklukları denetlenir.
              </p>
            </div>
          </div>
          <button className={styles.refreshBtn} onClick={fetchChains} disabled={loadingChains}>
            <RotateCcw size={14} /> {loadingChains ? 'Taranıyor...' : 'Zinciri Yeniden Tara'}
          </button>
        </div>

        {error && (
          <div className={styles.brokenAlert} style={{ marginBottom: '16px' }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className={styles.chainGrid}>
          {chains.map((c) => {
            const isBroken = c.gap_detected;
            const isSimple = c.recovery_model === 'SIMPLE';
            return (
              <div
                key={c.database_name}
                className={`${styles.chainCard} ${
                  isBroken ? styles.broken : isSimple ? styles.simple : styles.healthy
                }`}
              >
                <div className={styles.chainHeader}>
                  <div className={styles.dbNameGroup}>
                    <Database size={16} color="var(--accent)" />
                    <span className={styles.dbName}>{c.database_name}</span>
                  </div>
                  <span className={styles.recModelBadge}>{c.recovery_model}</span>
                </div>

                <div className={styles.chainMeta}>
                  <span className={styles.metaLabel}>Taranan Log Sayısı:</span>
                  <span className={styles.metaValue}>{c.total_logs_checked} adet</span>
                  <span className={styles.metaLabel}>Durum:</span>
                  <span
                    className={styles.metaValue}
                    style={{
                      color: isBroken
                        ? '#ef4444'
                        : isSimple
                        ? '#94a3b8'
                        : '#10b981',
                    }}
                  >
                    {isBroken
                      ? 'LSN KOPUK!'
                      : isSimple
                      ? 'Basit Model (Logsuz)'
                      : 'Zincir Sağlam ✓'}
                  </span>
                  <span className={styles.metaLabel}>Son Full Yedek:</span>
                  <span className={styles.metaValue}>
                    {c.latest_full_time ? new Date(c.latest_full_time).toLocaleTimeString('tr-TR') : '—'}
                  </span>
                  <span className={styles.metaLabel}>Son Log Yedeği:</span>
                  <span className={styles.metaValue}>
                    {c.latest_log_time ? new Date(c.latest_log_time).toLocaleTimeString('tr-TR') : '—'}
                  </span>
                </div>

                {isBroken && (
                  <div className={styles.brokenAlert}>
                    <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{c.broken_lsn_details}</span>
                  </div>
                )}

                {isSimple && (
                  <div className={styles.simpleAlert}>
                    <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{c.broken_lsn_details}</span>
                  </div>
                )}

                <div className={styles.cardAction}>
                  <button
                    className={styles.simulateBtn}
                    onClick={() => {
                      setSelectedDb(c.database_name);
                      handleSimulate(c.database_name);
                    }}
                  >
                    Point-in-Time Simüle Et <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Simulation & Timeline Generator */}
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <Layers className={styles.titleIcon} size={20} />
            <div>
              <h3 className={styles.title}>Point-in-Time Kurtarma Reçetesi Simülatörü</h3>
              <p className={styles.subtitle}>
                Hedef kurtarma anını belirleyin; motor Full, Diff ve ardışık Log yedeklerini sıralayarak STOPAT direktifli T-SQL reçetesi oluşturur.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.simSection}>
          <div className={styles.controlsBar}>
            <div className={styles.pickerGroup}>
              <span className={styles.pickerLabel}>Veritabanı:</span>
              <select
                className={styles.dbSelect}
                value={selectedDb}
                onChange={(e) => setSelectedDb(e.target.value)}
              >
                {chains.map((c) => (
                  <option key={c.database_name} value={c.database_name}>
                    {c.database_name} ({c.recovery_model})
                  </option>
                ))}
              </select>

              <span className={styles.pickerLabel}>Hedef Kurtarma Zamanı:</span>
              <input
                type="datetime-local"
                className={styles.timeInput}
                value={targetTime}
                onChange={(e) => setTargetTime(e.target.value)}
              />

              <button className={styles.presetBtn} onClick={() => handlePreset(15)}>
                Son 15 dk
              </button>
              <button className={styles.presetBtn} onClick={() => handlePreset(60)}>
                Son 1 Saat
              </button>
              <button className={styles.presetBtn} onClick={() => handlePreset(180)}>
                Son 3 Saat
              </button>
            </div>

            <button
              className={styles.runBtn}
              onClick={() => handleSimulate()}
              disabled={loadingSim}
            >
              <Play size={14} /> {loadingSim ? 'Hesaplanıyor...' : 'Reçeteyi Simüle Et'}
            </button>
          </div>

          {simResult && (
            <>
              {/* Summary KPIs */}
              <div className={styles.summaryRow}>
                <div className={styles.metricCard}>
                  <span className={styles.metricTitle}>Hedef Kurtarma Anı</span>
                  <span className={styles.metricValue}>{simResult.target_time}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricTitle}>Gereken Yedek Dosyası</span>
                  <span className={styles.metricValue}>{simResult.steps.length} Adet Dosya</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricTitle}>Tahmini Veri Kaybı (RPO)</span>
                  <span
                    className={styles.metricValue}
                    style={{ color: simResult.estimated_data_loss_minutes === 0 ? '#10b981' : '#f59e0b' }}
                  >
                    {simResult.estimated_data_loss_minutes.toFixed(0)} Dakika (Sıfır Kayıp)
                  </span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricTitle}>Tahmini Restore Süresi</span>
                  <span className={styles.metricValue}>~{simResult.estimated_restore_duration_sec} saniye</span>
                </div>
              </div>

              {/* Ordered Steps Timeline */}
              <div className={styles.timelineArea}>
                <div className={styles.timelineTitle}>
                  <Clock size={16} color="var(--accent)" />
                  Ardışık Geri Yükleme Sıralaması (Sequential Restore Chain)
                </div>

                <div className={styles.stepsList}>
                  {simResult.steps.map((s) => (
                    <div key={s.step_number} className={styles.stepCard}>
                      <div className={styles.stepLeft}>
                        <div className={styles.stepBadge}>{s.step_number}</div>
                        <span
                          className={`${styles.stepTypeBadge} ${
                            s.backup_type === 'FULL'
                              ? styles.stepTypeFull
                              : s.backup_type === 'DIFF'
                              ? styles.stepTypeDiff
                              : styles.stepTypeLog
                          }`}
                        >
                          {s.backup_type}
                        </span>
                        <span className={styles.stepFile}>{s.backup_file}</span>
                      </div>

                      <div className={styles.stepRight}>
                        <div className={styles.stepMeta}>
                          <span className={styles.stepTime}>{s.backup_time}</span>
                          <span className={styles.stepSize}>{s.file_size_mb.toFixed(0)} MB</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* T-SQL Review-Only Script */}
              <div className={styles.scriptCard}>
                <div className={styles.scriptHeader}>
                  <div className={styles.scriptTitle}>
                    <FileCode size={15} color="var(--accent)" />
                    [Review-Only] Üretilen T-SQL Kurtarma Betiği
                  </div>
                  <button className={styles.copyBtn} onClick={handleCopyScript}>
                    {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                    {copied ? 'Kopyalandı!' : 'T-SQL Betiğini Kopyala'}
                  </button>
                </div>
                <pre className={styles.codeArea}>{simResult.full_restore_tsql}</pre>
              </div>

              {/* DBA Security Warning Box */}
              {simResult.warnings.map((w, idx) => (
                <div key={idx} className={styles.warningBox}>
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>DBA Güvenlik Notu:</strong> {w}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
