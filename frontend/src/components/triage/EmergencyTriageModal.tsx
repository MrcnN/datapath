import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Copy,
  Check,
  Zap,
  Activity,
  Cpu,
  HardDrive,
  Database,
  Lock,
  Layers,
} from 'lucide-react';
import { getEmergencyTriage } from '../../lib/api';
import type { TriageResponse, TriageFinding } from '../../lib/types';
import LoadingSpinner from '../ui/LoadingSpinner';
import styles from './EmergencyTriageModal.module.css';

interface EmergencyTriageModalProps {
  onClose: () => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  BLOCKING: <Lock size={13} />,
  TRANSACTIONS: <Layers size={13} />,
  MEMORY: <Activity size={13} />,
  CPU: <Cpu size={13} />,
  TEMPDB: <Database size={13} />,
  STORAGE_IO: <HardDrive size={13} />,
  INTEGRITY: <AlertTriangle size={13} />,
};

export default function EmergencyTriageModal({ onClose }: EmergencyTriageModalProps) {
  const [data, setData] = useState<TriageResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchTriage = async () => {
    try {
      setLoading(true);
      const res = await getEmergencyTriage();
      setData(res);
    } catch (err) {
      console.error('Triage failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTriage();
  }, []);

  const handleCopy = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const status = data?.overall_status ?? 'HEALTHY';
  const isCritical = status === 'CRITICAL';
  const isWarning = status === 'WARNING';

  const cardStyle = isCritical
    ? styles.verdictCritical
    : isWarning
    ? styles.verdictWarning
    : styles.verdictHealthy;

  const pillClass = isCritical
    ? styles.pillCritical
    : isWarning
    ? styles.pillWarning
    : styles.pillHealthy;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <Zap size={18} className={styles.titleIcon} />
            <div className={styles.titleText}>
              <span>Acil Kriz Triyajı (Emergency Triage)</span>
              {data && <span className={styles.durationBadge}>{data.duration_ms} ms</span>}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Kapat">
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className={styles.body}>
          {loading && (
            <div style={{ padding: '40px 0' }}>
              <LoadingSpinner message="7 kritik alt sistem eşzamanlı taranıyor (Kilitler, CPU, Bellek, TempDB, Disk, Bütünlük)..." />
            </div>
          )}

          {!loading && data && (
            <>
              {/* Verdict Hero Banner */}
              <div className={`${styles.verdictCard} ${cardStyle}`}>
                <div className={styles.verdictTop}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isCritical ? (
                      <AlertTriangle size={18} color="#ef4444" />
                    ) : isWarning ? (
                      <AlertCircle size={18} color="#f59e0b" />
                    ) : (
                      <CheckCircle2 size={18} color="#10b981" />
                    )}
                    <span className={`${styles.verdictStatusPill} ${pillClass}`}>
                      {status === 'CRITICAL' ? 'Acil Müdahale Gerekli' : status === 'WARNING' ? 'Kritik Risk Uyarısı' : 'Sistem Normal'}
                    </span>
                  </div>
                  <span className={styles.bottleneckTag}>
                    Kök Neden ID: <strong>{data.primary_bottleneck}</strong>
                  </span>
                </div>

                <div className={styles.verdictTitle}>{data.verdict_title}</div>
                <div className={styles.verdictSummary}>{data.verdict_summary}</div>
              </div>

              {/* 7 Subsystems Readings Grid */}
              <div className={styles.subsystemsSection}>
                <div className={styles.sectionLabel}>Eşzamanlı 7 Alt Sistem Teşhis Bulguları</div>
                <div className={styles.findingsGrid}>
                  {data.findings.map((finding, idx) => {
                    const isFindCrit = finding.severity === 'CRITICAL';
                    const isFindWarn = finding.severity === 'WARNING';
                    const badgeColor = isFindCrit ? '#ef4444' : isFindWarn ? '#f59e0b' : '#10b981';

                    return (
                      <div key={idx} className={styles.findingCard}>
                        <div className={styles.findingHeader}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {categoryIcons[finding.category] || <Activity size={13} />}
                            <span className={styles.findingCat}>{finding.category}</span>
                          </span>
                          <span style={{ color: badgeColor, fontWeight: 700 }}>
                            {finding.severity}
                          </span>
                        </div>
                        <div className={styles.findingTitle}>{finding.title}</div>
                        <div className={styles.findingValue}>{finding.metric_value}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actionable Remediation T-SQL */}
              <div className={styles.remediationSection}>
                <div className={styles.remediationHeader}>
                  <div className={styles.sectionLabel}>Cerrahi T-SQL Acil Müdahale Reçetesi (Review-Only)</div>
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={() => handleCopy(data.remediation_sql)}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copied ? 'Kopyalandı!' : 'T-SQL Kopyala'}</span>
                  </button>
                </div>
                <pre className={styles.codeBox}>{data.remediation_sql}</pre>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            Hedef: <strong>{data?.server_name || 'SQL Server'}</strong> • Tarih: {data?.analyzed_at || '—'}
          </div>

          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.rescanBtn}
              onClick={fetchTriage}
              disabled={loading}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Yeniden Tara</span>
            </button>
            <button
              type="button"
              className={styles.rescanBtn}
              onClick={onClose}
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
