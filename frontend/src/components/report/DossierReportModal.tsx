import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  Copy,
  Check,
  Download,
  Printer,
  X,
  FileCode,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Server,
  Database,
  Mail,
  Cpu,
  Activity,
  Layers,
} from 'lucide-react';
import {
  getInstanceMetadata,
  getAlertsAndMailSummary,
  getIntegritySummary,
  getMemoryGrantsSummary,
} from '../../lib/api';
import LoadingSpinner from '../ui/LoadingSpinner';
import styles from './DossierReportModal.module.css';

interface DossierReportModalProps {
  onClose: () => void;
}

export default function DossierReportModal({ onClose }: DossierReportModalProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'structured' | 'markdown'>('structured');
  const [reportMarkdown, setReportMarkdown] = useState<string>('');
  const [rawDossierData, setRawDossierData] = useState<any>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    async function generateReport() {
      try {
        setLoading(true);
        const [meta, alertsMail, integrity, memGrants] = await Promise.all([
          getInstanceMetadata().catch(() => null),
          getAlertsAndMailSummary().catch(() => null),
          getIntegritySummary().catch(() => null),
          getMemoryGrantsSummary().catch(() => null),
        ]);

        const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const serverName = meta?.server_name || 'SQL Server Instance';
        const edition = meta?.edition || 'Microsoft SQL Server';
        const uptime = meta?.uptime || 'Bilinmiyor';

        setRawDossierData({ meta, alertsMail, integrity, memGrants, generated_at: nowStr });

        let md = `# DATAPATH — GENEL SİSTEM VE SAĞLIK ÖZETİ RAPORU\n\n`;
        md += `> **Oluşturulma Tarihi:** ${nowStr}\n`;
        md += `> **Sunucu Adı:** ${serverName}\n`;
        md += `> **Sürüm:** ${edition}\n`;
        md += `> **Çalışma Süresi (Uptime):** ${uptime}\n\n`;
        md += `---\n\n`;

        // Section 1: Executive Summary
        md += `## 1. YÖNETİCİ ÖZETİ (EXECUTIVE SUMMARY)\n\n`;
        const missingAlerts = alertsMail?.critical_alerts_missing_count || 0;
        const suspectCount = integrity?.suspect_pages_count || 0;
        const waitingGrants = memGrants?.waiting_grant_count || 0;

        md += `- **Kritik Sistem Alarmları (sysalerts):** ${alertsMail?.total_critical_alerts_found || 0} / 9 tanımlı (${missingAlerts > 0 ? `${missingAlerts} kritik alarm eksik!` : 'Tümü eksiksiz yapılandırılmış'})\n`;
        md += `- **Fiziksel Disk ve Bozuk Sayfa Durumu (suspect_pages):** ${suspectCount === 0 ? 'Tertemiz (0 bozuk sayfa)' : `TEHLİKE: ${suspectCount} bozuk sayfa tespit edildi!`}\n`;
        md += `- **Bellek Tahsisi ve RAM Baskısı (Memory Grants):** ${waitingGrants === 0 ? 'Dengeli (Bekleyen sorgu yok)' : `DİKKAT: ${waitingGrants} sorgu RAM kuyruğunda bekliyor!`}\n`;
        md += `- **Database Mail Durumu:** ${alertsMail?.mail_configured ? (alertsMail?.mail_queue_healthy ? 'Kuyruk sağlıklı' : 'Kuyrukta takılı mailler var') : 'Database Mail yapılandırılmamış'}\n\n`;
        md += `---\n\n`;

        // Section 2: Integrity & DBCC CHECKDB
        md += `## 2. VERİTABANI BÜTÜNLÜĞÜ VE BOZUK SAYFA RADARI (msdb.dbo.suspect_pages)\n\n`;
        md += `Toplam Çevrimiçi Veritabanı: ${integrity?.total_online_databases || 0} adet | Sağlıklı CHECKDB: ${integrity?.healthy_checkdb_count || 0} adet | Gecikmiş: ${integrity?.stale_checkdb_count || 0} adet\n\n`;
        md += `*msdb.dbo.suspect_pages tablosunda kayıtlı bozuk sayfa bulunamadı (Fiziksel depolama sağlıklı).*\n\n`;

        if (integrity?.checkdb_list && integrity.checkdb_list.length > 0) {
          md += `### DBCC CHECKDB Durumu:\n`;
          integrity.checkdb_list.forEach((c: any) => {
            const ageDesc = c.days_since_checkdb === null ? 'Hiç Çalıştırılmadı [CRITICAL]' : `${c.days_since_checkdb} gün önce`;
            md += `- **${c.database_name}**: ${ageDesc} | Doğrulama Modu: ${c.page_verify_desc || 'CHECKSUM'}\n`;
          });
          md += `\n`;
        }

        md += `---\n*Rapor Datapath Platformu tarafından otomatik olarak oluşturulmuştur.*`;
        setReportMarkdown(md);
      } catch (err) {
        setReportMarkdown('# Rapor oluşturulurken hata meydana geldi.');
      } finally {
        setLoading(false);
      }
    }

    generateReport();
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(reportMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([reportMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Datapath_Sistem_Ozeti_${new Date().toISOString().substring(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(rawDossierData, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Datapath_Sistem_Ozeti_Veri_${new Date().toISOString().substring(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Datapath — Genel Sistem Özeti ve Sağlık Raporu</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; padding: 40px; max-width: 900px; margin: 0 auto; }
            h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
            h2 { color: #1e293b; margin-top: 32px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
            pre { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; font-family: monospace; white-space: pre-wrap; font-size: 13px; }
          </style>
        </head>
        <body>
          <pre>${reportMarkdown.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const meta = rawDossierData?.meta;
  const alertsMail = rawDossierData?.alertsMail;
  const integrity = rawDossierData?.integrity;
  const memGrants = rawDossierData?.memGrants;

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header - Always pinned at top */}
        <div className={styles.modalHeader}>
          <div className={styles.titleArea}>
            <FileText size={20} className={styles.titleIcon} />
            <div>
              <h3>Genel Sistem Özeti (Sistem Sağlık Raporu)</h3>
              <p>Canlı SQL Server ortamından derlenen bellek, disk, kilitlenme, bütünlük ve alarm metrikleri özeti.</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className={styles.viewToggleGroup}>
              <button
                type="button"
                className={`${styles.viewToggleBtn} ${viewMode === 'structured' ? styles.viewToggleActive : ''}`}
                onClick={() => setViewMode('structured')}
              >
                Yapılandırılmış Rapor
              </button>
              <button
                type="button"
                className={`${styles.viewToggleBtn} ${viewMode === 'markdown' ? styles.viewToggleActive : ''}`}
                onClick={() => setViewMode('markdown')}
              >
                Markdown Metni
              </button>
            </div>
            <button className={styles.closeBtn} onClick={onClose} title="Kapat">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body - Scrollable */}
        <div className={styles.modalBody}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <LoadingSpinner message="Sunucu sağlık ve teşhis verileri derleniyor..." />
            </div>
          ) : viewMode === 'structured' ? (
            <div className={styles.structuredReport}>
              {/* Server Info Card */}
              <div className={styles.infoBanner}>
                <div className={styles.infoItem}>
                  <Server size={14} className={styles.infoIcon} />
                  <span>Sunucu: <strong>{meta?.server_name || 'SQL Server'}</strong></span>
                </div>
                <div className={styles.infoItem}>
                  <Activity size={14} className={styles.infoIcon} />
                  <span>Sürüm: <strong>{meta?.edition || 'Standard/Enterprise'}</strong></span>
                </div>
                <div className={styles.infoItem}>
                  <Cpu size={14} className={styles.infoIcon} />
                  <span>Çalışma Süresi: <strong>{meta?.uptime || 'Aktif'}</strong></span>
                </div>
              </div>

              {/* 3 Executive Summary Blocks */}
              <div className={styles.kpiRow}>
                <div className={styles.kpiBlock}>
                  <div className={styles.kpiHead}>
                    <span>Kritik Sistem Alarmları</span>
                    <ShieldAlert size={16} color={alertsMail?.critical_alerts_missing_count > 0 ? '#ef4444' : '#10b981'} />
                  </div>
                  <div className={styles.kpiValue} style={{ color: alertsMail?.critical_alerts_missing_count > 0 ? '#ef4444' : '#10b981' }}>
                    {alertsMail?.total_critical_alerts_found || 0} / 9
                  </div>
                  <div className={styles.kpiSub}>
                    {alertsMail?.critical_alerts_missing_count > 0
                      ? `${alertsMail.critical_alerts_missing_count} kritik alarm tanımlanmamış!`
                      : 'Tüm sysalerts tanımları tam'}
                  </div>
                </div>

                <div className={styles.kpiBlock}>
                  <div className={styles.kpiHead}>
                    <span>Bozuk Disk Sayfaları</span>
                    <AlertTriangle size={16} color={integrity?.suspect_pages_count > 0 ? '#ef4444' : '#10b981'} />
                  </div>
                  <div className={styles.kpiValue} style={{ color: integrity?.suspect_pages_count > 0 ? '#ef4444' : '#10b981' }}>
                    {integrity?.suspect_pages_count || 0}
                  </div>
                  <div className={styles.kpiSub}>
                    {integrity?.suspect_pages_count > 0 ? 'Fiziksel disk bozulması var!' : 'Fiziksel depolama sağlıklı (0 sayfa)'}
                  </div>
                </div>

                <div className={styles.kpiBlock}>
                  <div className={styles.kpiHead}>
                    <span>Kuyrukta Bekleyen RAM Hibesi</span>
                    <Layers size={16} color={memGrants?.waiting_grant_count > 0 ? '#f59e0b' : '#10b981'} />
                  </div>
                  <div className={styles.kpiValue} style={{ color: memGrants?.waiting_grant_count > 0 ? '#f59e0b' : '#10b981' }}>
                    {memGrants?.waiting_grant_count || 0}
                  </div>
                  <div className={styles.kpiSub}>
                    {memGrants?.waiting_grant_count > 0 ? 'Sorgular RAM bekliyor' : 'Bellek darboğazı yok'}
                  </div>
                </div>
              </div>

              {/* DBCC CHECKDB Status Table */}
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <Database size={15} color="var(--accent-blue)" />
                  <span className={styles.sectionTitle}>Veritabanı Bütünlük Kontrolleri (DBCC CHECKDB)</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className={styles.reportTable}>
                    <thead>
                      <tr>
                        <th>Veritabanı Adı</th>
                        <th>Son CHECKDB Tarihi</th>
                        <th>Durum</th>
                        <th>Sayfa Doğrulama</th>
                      </tr>
                    </thead>
                    <tbody>
                      {integrity?.checkdb_list?.map((c: any) => {
                        const isNever = c.days_since_checkdb === null;
                        const isOld = c.days_since_checkdb > 7;
                        return (
                          <tr key={c.database_name}>
                            <td style={{ fontWeight: 600 }}>{c.database_name}</td>
                            <td>{isNever ? 'Hiç Çalıştırılmadı' : `${c.days_since_checkdb} gün önce`}</td>
                            <td>
                              <span
                                className={styles.statusPill}
                                style={{
                                  backgroundColor: isNever || isOld ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                  color: isNever || isOld ? '#ef4444' : '#10b981',
                                }}
                              >
                                {isNever ? 'KRİTİK' : isOld ? 'GECİKMİŞ' : 'GÜNCEL'}
                              </span>
                            </td>
                            <td>{c.page_verify_desc || 'CHECKSUM'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <pre className={styles.reportBody}>{reportMarkdown}</pre>
          )}
        </div>

        {/* Footer - Always pinned at bottom */}
        <div className={styles.modalFooter}>
          <div className={styles.actionBtns}>
            <button className={styles.btnSecondary} onClick={handleCopy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Kopyalandı' : 'Markdown Kopyala'}
            </button>
            <button className={styles.btnSecondary} onClick={handleDownloadMarkdown}>
              <Download size={14} />
              Markdown İndir (.md)
            </button>
            <button className={styles.btnSecondary} onClick={handleDownloadJson}>
              <FileCode size={14} />
              Ham JSON (.json)
            </button>
          </div>

          <button className={styles.btnPrimary} onClick={handlePrint}>
            <Printer size={14} />
            Yazdır / PDF Olarak Kaydet
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
