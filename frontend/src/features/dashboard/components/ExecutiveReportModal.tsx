import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  Copy,
  Check,
  X,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Server,
  Clock,
  Layers,
  Sparkles,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { getExecutiveHealthReport } from '../../../lib/api';
import type { ExecutiveReportResponse } from '../../../lib/types';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import styles from './ExecutiveReportModal.module.css';

interface ExecutiveReportModalProps {
  onClose: () => void;
}

export default function ExecutiveReportModal({ onClose }: ExecutiveReportModalProps) {
  const [data, setData] = useState<ExecutiveReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'VISUAL' | 'MARKDOWN'>('VISUAL');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    async function loadReport() {
      try {
        setLoading(true);
        setError(null);
        const res = await getExecutiveHealthReport();
        setData(res);
      } catch (err: any) {
        setError(err?.message || 'Yönetici sağlık raporu oluşturulamadı.');
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, []);

  const handleCopyMarkdown = () => {
    if (!data?.markdown_content) return;
    navigator.clipboard.writeText(data.markdown_content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const scoreColor =
    (data?.overall_score ?? 100) >= 80
      ? '#10b981'
      : (data?.overall_score ?? 100) >= 60
      ? '#f59e0b'
      : '#ef4444';

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <div className={styles.titleRow}>
              <FileText size={18} color="var(--accent)" />
              <h2 className={styles.title}>Yönetici Veritabanı Sağlık &amp; Denetim Raporu</h2>
            </div>
            <p className={styles.subtitle}>
              Bütünleşik sağlık skoru, 5 mimari sütun telemetrisi, kritik riskler ve öncelikli DBA eylem planı.
            </p>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.btnAction}
              onClick={handleCopyMarkdown}
              disabled={loading || !data}
              title="Markdown formatında kopyala"
            >
              {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
              <span>{copied ? 'Kopyalandı' : 'Raporu Kopyala'}</span>
            </button>

            <button
              type="button"
              className={styles.btnAction}
              onClick={handlePrint}
              disabled={loading || !data}
              title="Yazdır veya PDF olarak kaydet"
            >
              <Printer size={13} />
              <span>Yazdır / PDF</span>
            </button>

            <button
              type="button"
              className={styles.btnClose}
              onClick={onClose}
              title="Kapat"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className={styles.tabsRow}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'VISUAL' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('VISUAL')}
          >
            <Layers size={13} />
            <span>Yönetici Görsel Özeti</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'MARKDOWN' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('MARKDOWN')}
          >
            <FileText size={13} />
            <span>Tam Rapor Metni (Markdown)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.body}>
          {loading && (
            <LoadingSpinner message="Adli telemetri verileri toplanıyor ve yönetici raporu derleniyor..." />
          )}

          {error && (
            <ErrorState message={error} onRetry={() => window.location.reload()} />
          )}

          {!loading && !error && data && activeTab === 'VISUAL' && (
            <>
              {/* Score Overview Row */}
              <div className={styles.scoreOverview}>
                <div className={styles.scoreBadgeArea}>
                  <span className={styles.bigScore} style={{ color: scoreColor }}>
                    {data.overall_score}
                  </span>
                  <span className={styles.scoreLabel}>Bütünleşik Sağlık Skoru</span>
                </div>

                <div className={styles.scoreMetaArea}>
                  <div className={styles.metaRow}>
                    <Server size={14} color="var(--accent)" />
                    <span>Hedef Sunucu: <strong>{data.server_name}</strong></span>
                  </div>
                  <div className={styles.metaRow}>
                    <Clock size={14} color="var(--accent)" />
                    <span>Üretim Tarihi: {data.generated_at}</span>
                  </div>
                  <div className={styles.metaRow}>
                    <ShieldAlert size={14} color={data.key_risks.length > 0 ? '#ef4444' : '#10b981'} />
                    <span>
                      {data.key_risks.length > 0
                        ? `${data.key_risks.length} adet dikkat gerektiren mimari risk tespit edildi.`
                        : 'Kritik operasyonel risk tespit edilmedi.'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Architectural Pillars Grid */}
              <div className={styles.pillarsGrid}>
                {data.pillars.map((p) => {
                  const pct = Math.round((p.score / p.max_weight) * 100);
                  const isHealthy = p.status === 'healthy';
                  const isWarning = p.status === 'warning';
                  const col = isHealthy ? '#10b981' : isWarning ? '#f59e0b' : '#ef4444';

                  return (
                    <div key={p.id} className={styles.pillarCard}>
                      <div className={styles.pillarTop}>
                        <span className={styles.pillarName}>{p.name}</span>
                        <span className={styles.pillarScore} style={{ color: col }}>
                          {p.score} / {p.max_weight}
                        </span>
                      </div>

                      <div className={styles.pillarBar}>
                        <div
                          className={styles.pillarFill}
                          style={{ width: `${pct}%`, background: col }}
                        />
                      </div>

                      <span className={styles.pillarSub}>
                        {p.findings.length > 0 ? p.findings[0] : 'Sistem parametreleri standartlara uygun.'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Priority Action Plan */}
              <div className={styles.actionsSection}>
                <span className={styles.sectionTitle}>
                  <Sparkles size={15} color="var(--accent)" />
                  Öncelikli DBA Eylem Planı (Review-Only Runbook)
                </span>

                {data.priority_actions.map((act) => (
                  <div key={act.rank} className={styles.actionCard}>
                    <div className={styles.actionHeader}>
                      <div className={styles.actionTitle}>
                        <span className={styles.rankBadge}>{act.rank}</span>
                        <span>{act.title}</span>
                      </div>

                      <span
                        className={`${styles.urgencyBadge} ${
                          act.urgency === 'CRITICAL'
                            ? styles.urgencyCritical
                            : act.urgency === 'HIGH'
                            ? styles.urgencyHigh
                            : styles.urgencyMedium
                        }`}
                      >
                        {act.urgency}
                      </span>
                    </div>

                    <p className={act.impact ? styles.actionImpact : undefined}>{act.impact}</p>

                    {act.remediation_tsql && (
                      <pre className={styles.codeBox}>{act.remediation_tsql}</pre>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {!loading && !error && data && activeTab === 'MARKDOWN' && (
            <pre className={styles.markdownCard}>{data.markdown_content}</pre>
          )}
        </div>
      </div>
    </div>
  );
}
