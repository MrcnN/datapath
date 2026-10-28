import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  FileCode2,
  Copy,
  Check,
  Cpu,
  HardDrive,
  Info,
} from 'lucide-react';
import { getServerConfigurations } from '../../../lib/api';
import type { ServerConfigurationSummary, ConfigurationItem } from '../../../lib/types';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import styles from './ServerConfigurationAudit.module.css';

export default function ServerConfigurationAudit() {
  const [summary, setSummary] = useState<ServerConfigurationSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const data = await getServerConfigurations();
        setSummary(data);
      } catch (err: any) {
        setError(err.message || 'Sunucu yapılandırma denetimi yüklenemedi.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleCopyScript = () => {
    if (!summary?.remediation_script) return;
    navigator.clipboard.writeText(summary.remediation_script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) return <LoadingSpinner message="sp_configure parametreleri denetleniyor..." />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (!summary) return null;

  const scoreClass =
    summary.compliance_score >= 85
      ? styles.scoreHigh
      : summary.compliance_score >= 65
      ? styles.scoreMedium
      : styles.scoreLow;

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <div className={`${styles.scorePill} ${scoreClass}`}>
            <ShieldCheck size={16} />
            En İyi Uygulama Uyum Skoru: %{summary.compliance_score}
          </div>

          <div className={styles.summaryBadges}>
            <span
              className={styles.badgeItem}
              style={{ background: 'rgba(34, 197, 94, 0.15)', color: 'var(--status-success)' }}
            >
              {summary.optimal_count} Optimal
            </span>
            <span
              className={styles.badgeItem}
              style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}
            >
              {summary.warning_count} Uyarı
            </span>
            {summary.critical_count > 0 && (
              <span
                className={styles.badgeItem}
                style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--status-danger)' }}
              >
                {summary.critical_count} Kritik
              </span>
            )}
          </div>
        </div>

        <button className={styles.scriptBtn} onClick={() => setShowModal(true)}>
          <FileCode2 size={15} />
          Düzeltme T-SQL Scriptini İncele
        </button>
      </div>

      <div className={styles.configList}>
        {summary.items.map((item) => {
          const isCritical = item.status === 'CRITICAL';
          const isWarning = item.status === 'WARNING';
          const isOptimal = item.status === 'OPTIMAL';

          return (
            <div key={item.configuration_id} className={styles.configCard}>
              <div className={styles.cardTop}>
                <div>
                  <div className={styles.configName}>{item.name}</div>
                  <div className={styles.configDesc}>{item.description}</div>
                </div>

                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: isCritical
                      ? 'rgba(239, 68, 68, 0.15)'
                      : isWarning
                      ? 'rgba(245, 158, 11, 0.15)'
                      : 'rgba(34, 197, 94, 0.15)',
                    color: isCritical
                      ? 'var(--status-danger)'
                      : isWarning
                      ? '#fbbf24'
                      : 'var(--status-success)',
                  }}
                >
                  {isCritical ? 'KRİTİK UYARI' : isWarning ? 'ÖNERİLEN DEĞİL' : 'OPTİMAL'}
                </span>
              </div>

              <div className={styles.valuesRow}>
                <div className={styles.valueItem}>
                  <span className={styles.valueLbl}>Kullanımdaki Değer:</span>
                  <span className={styles.valueVal}>{item.value_in_use.toLocaleString()}</span>
                </div>
                {item.recommended_value && (
                  <div className={styles.valueItem}>
                    <span className={styles.valueLbl}>Önerilen:</span>
                    <span className={styles.recVal}>{item.recommended_value}</span>
                  </div>
                )}
                <div className={styles.valueItem}>
                  <span className={styles.valueLbl}>Tür:</span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {item.is_dynamic ? 'Dinamik (Yeniden başlatma gerekmez)' : 'Statik'}
                  </span>
                </div>
              </div>

              <div className={styles.impactText}>{item.impact_description}</div>

              {item.remediation_sql && (
                <div className={styles.remSnippet}>
                  <code>{item.remediation_sql.replace(/\n/g, ' ')}</code>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Remediation Script Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3>En İyi Uygulama Yapılandırma Düzeltme Betiği</h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Aşağıdaki scripti SSMS ortamına kopyalayarak gözden geçirdikten sonra çalıştırabilirsiniz.
                </p>
              </div>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className={styles.modalBody}>
              <button className={styles.copyBtn} onClick={handleCopyScript}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Kopyalandı!' : 'T-SQL Scriptini Kopyala'}
              </button>
              <pre className={styles.scriptBox}>{summary.remediation_script}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
