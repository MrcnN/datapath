import React, { useState, useEffect } from 'react';
import {
  FileText,
  Copy,
  Check,
  Download,
  Printer,
  X,
  FileCode,
  ShieldAlert,
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

        let md = `# DATAPATH — SQL SERVER TEKNİK TEŞHİS VE SAĞLIK DOSYASI\n\n`;
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
        const mailFailed = alertsMail?.mail_status?.total_failed_items || 0;

        md += `- **Genel Teşhis Durumu:** ${suspectCount > 0 || waitingGrants > 0 ? '🔴 KRİTİK MÜDAHALE GEREKLİ' : missingAlerts > 0 ? '🟡 UYARILAR VAR' : '🟢 SİSTEM SAĞLIKLI'}\n`;
        md += `- **Fiziksel Disk Bozuk Sayfa Radarı (suspect_pages):** ${suspectCount > 0 ? `🚨 ${suspectCount} ADET BOZUK SAYFA MEVCUT!` : 'Temiz (0 Bozuk Sayfa)'}\n`;
        md += `- **Bellek Hibesi Kuyruğu (RESOURCE_SEMAPHORE):** ${waitingGrants > 0 ? `⚠️ ${waitingGrants} sorgu bellek bekliyor` : 'Kuyruk yok (Normal)'}\n`;
        md += `- **Kritik Sistem Alarmları:** ${missingAlerts > 0 ? `⚠️ ${missingAlerts} kritik alarm eksik (Severity 17-25, Error 823-825)` : 'Eksiksiz yapılandırıldı'}\n`;
        md += `- **Database Mail Durumu:** ${mailFailed > 0 ? `⚠️ ${mailFailed} adet iletilemeyen başarısız mail var` : 'Kuyruk sağlıklı'}\n\n`;
        md += `---\n\n`;

        // Section 2: Integrity & Corruption
        md += `## 2. VERİTABANI BÜTÜNLÜĞÜ VE BOZUK SAYFA RADARI (msdb.dbo.suspect_pages)\n\n`;
        if (integrity) {
          md += `Toplam Çevrimiçi Veritabanı: ${integrity.total_databases} adet | Sağlıklı CHECKDB: ${integrity.healthy_checkdb_count} adet | Gecikmiş: ${integrity.stale_checkdb_count + integrity.critical_checkdb_count} adet\n\n`;
          if (integrity.suspect_pages && integrity.suspect_pages.length > 0) {
            md += `### 🚨 BOZUK SAYFA LİSTESİ:\n`;
            integrity.suspect_pages.forEach((sp: any) => {
              md += `- **${sp.database_name}** | Dosya ${sp.file_id} : Sayfa ${sp.page_id} | Olay: ${sp.event_desc} | Hata Adedi: ${sp.error_count} | Son Tespit: ${sp.last_update_date}\n`;
            });
            md += `\n`;
          } else {
            md += `*msdb.dbo.suspect_pages tablosunda kayıtlı bozuk sayfa bulunamadı (Fiziksel depolama sağlıklı).*\n\n`;
          }

          md += `### DBCC CHECKDB Durumu:\n`;
          integrity.checkdb_list.forEach((c: any) => {
            md += `- **${c.database_name}**: ${c.last_clean_checkdb} [${c.status}] | Doğrulama Modu: ${c.page_verify_option}\n`;
          });
          md += `\n`;
        }
        md += `---\n\n`;

        // Section 3: Memory Grants
        md += `## 3. BELLEK HİBELERİ VE RESOURCE_SEMAPHORE (sys.dm_exec_query_memory_grants)\n\n`;
        if (memGrants) {
          md += `- **Toplam Tahsis Edilen Bellek:** ${memGrants.total_granted_mb} MB\n`;
          md += `- **Talep Edilen Bellek:** ${memGrants.total_requested_mb} MB\n`;
          md += `- **Kuyruk Baskı Seviyesi:** ${memGrants.semaphore_pressure}\n\n`;
          if (memGrants.grants && memGrants.grants.length > 0) {
            md += `### Aktif & Bekleyen Bellek Talepleri:\n`;
            memGrants.grants.forEach((g: any) => {
              md += `- SPID ${g.session_id} | ${g.is_waiting ? `BEKLİYOR (${(g.wait_time_ms/1000).toFixed(1)} sn)` : 'TAHSİS EDİLDİ'} | Talep: ${g.requested_memory_mb} MB | Tahsis: ${g.granted_memory_mb} MB | İsraf: %${g.waste_ratio_percent}\n`;
              md += `  Sorgu: \`${g.query_text.substring(0, 100)}...\`\n`;
            });
            md += `\n`;
          }
        }
        md += `---\n\n`;

        // Section 4: Critical Alerts & Database Mail
        md += `## 4. KRİTİK SİSTEM ALARMLARI VE DATABASE MAIL\n\n`;
        if (alertsMail) {
          md += `- **Tanımlı Alarmlar:** ${alertsMail.total_alerts} adet\n`;
          md += `- **Eksik Kritik Alarmlar:** ${alertsMail.critical_alerts_missing_count} adet\n`;
          md += `- **Database Mail Servis Durumu:** ${alertsMail.mail_status.mail_queue_status}\n`;
          md += `- **Toplam Başarısız Mail:** ${alertsMail.mail_status.total_failed_items} adet\n\n`;

          if (alertsMail.mail_status.recent_failed_items && alertsMail.mail_status.recent_failed_items.length > 0) {
            md += `### Son Başarısız Mailler:\n`;
            alertsMail.mail_status.recent_failed_items.forEach((m: any) => {
              md += `- #${m.mailitem_id} | Alıcı: ${m.recipients} | Konu: ${m.subject} | Hata: ${m.error_description || 'Belirtilmedi'}\n`;
            });
            md += `\n`;
          }
        }

        md += `---\n*Rapor Datapath — Veritabanı Zekası Platformu tarafından otomatik olarak oluşturulmuştur.*`;
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
    link.download = `Datapath_Dossier_Report_${new Date().toISOString().substring(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(rawDossierData, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Datapath_Dossier_Data_${new Date().toISOString().substring(0, 10)}.json`;
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
          <title>Datapath — SQL Server Teşhis Raporu</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; padding: 40px; max-width: 900px; margin: 0 auto; }
            h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
            h2 { color: #1e293b; margin-top: 32px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
            h3 { color: #334155; }
            pre { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; font-family: monospace; white-space: pre-wrap; font-size: 13px; }
            blockquote { border-left: 4px solid #3b82f6; padding-left: 12px; margin: 0; color: #64748b; }
            hr { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
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

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.titleArea}>
            <FileText size={20} color="var(--accent-blue)" />
            <div>
              <h3>Kapsamlı Mühendislik Teşhis Dosyası (DBA Dossier)</h3>
              <p>Tüm operasyonel sağlık ve kriz teşhis verilerini tek tıkla derlenmiş teknik rapor olarak dışa aktarın.</p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <LoadingSpinner message="Sunucu sağlık ve teşhis verileri derleniyor..." />
          </div>
        ) : (
          <pre className={styles.reportBody}>{reportMarkdown}</pre>
        )}

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
    </div>
  );
}
