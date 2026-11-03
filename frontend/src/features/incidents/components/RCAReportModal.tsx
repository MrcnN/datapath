import React, { useState, useEffect } from 'react';
import {
  FileText,
  Copy,
  Check,
  Printer,
  X,
  AlertOctagon,
  Clock,
  Wrench,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';
import CodeBlock from '../../../components/ui/CodeBlock';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import { generateRCAReport } from '../../../lib/api';
import type { RCAReport, RCARequest } from '../../../lib/types';
import styles from './RCAReportModal.module.css';

interface RCAReportModalProps {
  onClose: () => void;
  incidentType?: 'DEADLOCK' | 'BLOCKING_STORM' | 'TEMPDB_EXHAUSTION' | 'MEMORY_GRANT_TIMEOUT' | 'CUSTOM';
  database?: string;
  title?: string;
  spids?: number[];
}

export default function RCAReportModal({
  onClose,
  incidentType = 'DEADLOCK',
  database = 'ProductionDB',
  title,
  spids = [],
}: RCAReportModalProps) {
  const [report, setReport] = useState<RCAReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedMd, setCopiedMd] = useState<boolean>(false);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await generateRCAReport({
        incident_type: incidentType,
        database,
        incident_title: title,
        spids,
      });
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Kök neden analizi oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [incidentType, database]);

  const handleCopyMd = () => {
    if (!report) return;
    navigator.clipboard.writeText(report.markdown_content);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const getPriorityBadgeClass = (priority: string) => {
    if (priority === 'P0') return styles.priorityP0;
    if (priority === 'P1') return styles.priorityP1;
    return styles.priorityP2;
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <div className={styles.reportIconBox}>
              <AlertOctagon size={20} />
            </div>
            <div className={styles.reportTitles}>
              <h3 className={styles.reportTitle}>
                {report ? report.incident_title : 'Olay Kök Neden Analizi (RCA Post-Mortem)'}
              </h3>
              <span className={styles.reportMeta}>
                Rapor ID: <strong>{report?.report_id || 'Oluşturuluyor...'}</strong> • Veritabanı: {database} • Tarih: {report?.generated_at}
              </span>
            </div>
          </div>

          <div className={styles.headerActions}>
            {report && (
              <>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={handleCopyMd}
                  title="Markdown formatında kopyala (Slack, Jira, Confluence için)"
                >
                  {copiedMd ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedMd ? 'Kopyalandı!' : 'Markdown Kopyala'}</span>
                </button>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={handlePrint}
                  title="Raporu yazdır veya PDF olarak kaydet"
                >
                  <Printer size={13} />
                  <span>Yazdır / PDF</span>
                </button>
              </>
            )}
            <button type="button" className={styles.closeBtn} onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {loading && <LoadingSpinner message="Olay kronolojisi, kilit hiyerarşisi ve kök neden analizi derleniyor..." />}
          {error && <ErrorState message={error} onRetry={fetchReport} />}

          {!loading && !error && report && (
            <>
              {/* Executive Summary */}
              <div className={`${styles.sectionCard} ${styles.execSummaryBox}`}>
                <h4 className={styles.sectionTitle}>
                  <FileText size={15} color="var(--accent-primary, #3b82f6)" />
                  1. Yönetici Özeti (Executive Summary)
                </h4>
                <p className={styles.sectionText}>{report.executive_summary}</p>
              </div>

              {/* Technical Root Cause */}
              <div className={styles.sectionCard}>
                <h4 className={styles.sectionTitle}>
                  <AlertOctagon size={15} color="#ef4444" />
                  2. Teknik Kök Neden Analizi (Root Cause Deep-Dive)
                </h4>
                <p className={styles.sectionText}>{report.root_cause_analysis}</p>
              </div>

              {/* Impact Assessment */}
              <div className={styles.sectionCard}>
                <h4 className={styles.sectionTitle}>
                  <ShieldCheck size={15} color="#f59e0b" />
                  3. İşletimsel ve Hizmet Etkisi (Impact Assessment)
                </h4>
                <p className={styles.sectionText}>{report.impact_assessment}</p>
              </div>

              {/* Timeline of Events */}
              <div className={styles.sectionCard}>
                <h4 className={styles.sectionTitle}>
                  <Clock size={15} color="var(--text-muted)" />
                  4. Olay Kronolojisi (Timeline of Events)
                </h4>
                <div className={styles.timelineList}>
                  {report.timeline.map((item, idx) => (
                    <div key={idx} className={styles.timelineItem}>
                      <span className={styles.timeTag}>{item.timestamp}</span>
                      <span className={styles.eventText}>{item.event}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CAPA Action Plan */}
              <div className={styles.sectionCard}>
                <h4 className={styles.sectionTitle}>
                  <CheckCircle size={15} color="#10b981" />
                  5. Düzeltici ve Önleyici Eylemler (CAPA Action Items)
                </h4>
                <table className={styles.actionsTable}>
                  <thead>
                    <tr>
                      <th style={{ width: 80 }}>Öncelik</th>
                      <th>Eylem Planı</th>
                      <th style={{ width: 140 }}>Sorumlu</th>
                      <th style={{ width: 80 }}>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.corrective_actions.map((act, idx) => (
                      <tr key={idx}>
                        <td>
                          <span className={getPriorityBadgeClass(act.priority)}>{act.priority}</span>
                        </td>
                        <td>{act.action}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{act.owner}</td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                            {act.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Remediation T-SQL */}
              <div className={styles.sectionCard}>
                <h4 className={styles.sectionTitle}>
                  <Wrench size={15} color="var(--accent-primary, #3b82f6)" />
                  6. Önerilen Düzeltme Betiği (Remediation T-SQL)
                </h4>
                <CodeBlock code={report.remediation_tsql} language="sql" maxLines={8} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
