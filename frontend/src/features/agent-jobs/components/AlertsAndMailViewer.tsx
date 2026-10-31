import React, { useState, useEffect } from 'react';
import {
  Bell,
  Mail,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  Play,
  RotateCcw,
  Trash2,
  ShieldAlert,
  Inbox,
  UserCheck,
  Send,
} from 'lucide-react';
import WebhookSettingsView from './WebhookSettingsView';
import { getAlertsAndMailSummary } from '../../../lib/api';
import type {
  AlertsAndMailSummary,
  SQLAlertDetail,
  DatabaseMailItem,
} from '../../../lib/types';
import DataTable, { type Column } from '../../../components/ui/DataTable';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import styles from './AlertsAndMailViewer.module.css';

export default function AlertsAndMailViewer() {
  const [data, setData] = useState<AlertsAndMailSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<'alerts' | 'mail' | 'webhook'>('alerts');

  const [sqlModal, setSqlModal] = useState<{ title: string; sql: string } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAlertsAndMailSummary();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Alarmlar ve Database Mail bilgisi alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopy = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <LoadingSpinner message="SQL Server alarmları ve Database Mail kuyruğu denetleniyor..." />;
  }

  if (error || !data) {
    return <ErrorState message={error || 'Veri yüklenemedi.'} onRetry={loadData} />;
  }

  const alertColumns: Column<SQLAlertDetail>[] = [
    {
      key: 'name',
      label: 'Alarm Adı & Kural',
      sortable: true,
      render: (a) => (
        <div>
          <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{a.name}</strong>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {a.message_id > 0 ? `Hata Kodu: ${a.message_id}` : `Severity: ${a.severity}`}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Durum',
      sortable: true,
      render: (a) => {
        if (a.is_best_practice_missing) {
          return (
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--status-danger)', fontWeight: 700 }}>
              TANIMLI DEĞİL (KRİTİK)
            </span>
          );
        }
        if (a.status === 'NO_OPERATOR') {
          return (
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(234, 179, 8, 0.15)', color: 'var(--status-warning)', fontWeight: 700 }}>
              OPERATÖR ATANMAMIŞ
            </span>
          );
        }
        return (
          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.15)', color: 'var(--status-success)', fontWeight: 700 }}>
            YAPILANDIRILDI
          </span>
        );
      },
    },
    {
      key: 'operator_name',
      label: 'Bildirim Operatörü',
      sortable: true,
      render: (a) => (
        <span style={{ fontSize: '12px', color: a.operator_name ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
          {a.operator_name || 'Yok (E-posta gitmez)'}
        </span>
      ),
    },
    {
      key: 'occurrence_count',
      label: 'Tetiklenme Adedi',
      sortable: true,
      render: (a) => (
        <span style={{ fontSize: '12px', fontWeight: a.occurrence_count > 0 ? 700 : 400, color: a.occurrence_count > 0 ? 'var(--status-danger)' : 'var(--text-muted)' }}>
          {a.occurrence_count} kez
        </span>
      ),
    },
    {
      key: 'last_occurrence',
      label: 'Son Tetiklenme',
      sortable: true,
      render: (a) => (
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
          {a.last_occurrence || 'Hiç tetiklenmedi'}
        </span>
      ),
    },
  ];

  const mailColumns: Column<DatabaseMailItem>[] = [
    {
      key: 'mailitem_id',
      label: 'ID',
      sortable: true,
      render: (m) => <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>#{m.mailitem_id}</span>,
    },
    {
      key: 'recipients',
      label: 'Alıcı',
      sortable: true,
      render: (m) => <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{m.recipients}</span>,
    },
    {
      key: 'subject',
      label: 'Konu',
      sortable: true,
      render: (m) => (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{m.subject}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>İsteyen: {m.send_request_user} • {m.send_request_date}</div>
        </div>
      ),
    },
    {
      key: 'error_description',
      label: 'Hata Nedeni / Teşhis',
      render: (m) => (
        <div style={{ fontSize: '11px', color: 'var(--status-danger)', maxWidth: '380px', wordBreak: 'break-word', fontFamily: 'monospace' }}>
          {m.error_description || 'Açıklama belirtilmedi.'}
        </div>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Tanımlı Alarmlar</span>
            <Bell size={18} color="var(--accent-blue)" />
          </div>
          <div className={styles.kpiValue}>{data.total_alerts}</div>
          <div className={styles.kpiSub}>msdb.dbo.sysalerts</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Eksik Kritik Alarmlar</span>
            <ShieldAlert size={18} color={data.critical_alerts_missing_count > 0 ? 'var(--status-danger)' : 'var(--status-success)'} />
          </div>
          <div className={styles.kpiValue} style={{ color: data.critical_alerts_missing_count > 0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
            {data.critical_alerts_missing_count} Eksik
          </div>
          <div className={styles.kpiSub}>Severity 17-25 ve Error 823-825</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Database Mail Kuyruğu</span>
            <Inbox size={18} color={data.mail_status.mail_queue_status === 'STARTED' ? 'var(--status-success)' : 'var(--status-danger)'} />
          </div>
          <div className={styles.kpiValue} style={{ color: data.mail_status.mail_queue_status === 'STARTED' ? 'var(--status-success)' : 'var(--status-danger)' }}>
            {data.mail_status.mail_queue_status}
          </div>
          <div className={styles.kpiSub}>Servis Kuyruk Durumu</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiTitle}>Başarısız / Bekleyen Mail</span>
            <Mail size={18} color={data.mail_status.total_failed_items > 0 ? 'var(--status-danger)' : 'var(--status-success)'} />
          </div>
          <div className={styles.kpiValue} style={{ color: data.mail_status.total_failed_items > 0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
            {data.mail_status.total_failed_items} Hata
          </div>
          <div className={styles.kpiSub}>{data.mail_status.total_unsent_items} iletilemeyen kuyrukta</div>
        </div>
      </div>

      {/* Critical Missing Alerts Banner */}
      {data.critical_alerts_missing_count > 0 && (
        <div className={styles.alertBanner}>
          <div className={styles.alertContent}>
            <AlertTriangle size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Kritik Sistem Alarmları Eksik (Kör Nokta Riski)</strong>
              <div>
                SQL Server donanım I/O hataları (823, 824, 825) ve kritik motor arızaları (Severity 17-25) için tanımlı alarm bulunamadı.
                Bir kriz anında nöbetçi DBA'e e-posta bildirimi gitmeyecektir.
              </div>
            </div>
          </div>
          <button
            className={styles.scriptBtn}
            onClick={() => setSqlModal({ title: 'Eksik Kritik Alarmları Oluşturma T-SQL Betiği', sql: data.create_missing_alerts_sql })}
          >
            <Copy size={13} />
            Alarmları Oluşturma Betiği
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabsBar}>
        <button
          className={`${styles.tabBtn} ${subTab === 'alerts' ? styles.activeTab : ''}`}
          onClick={() => setSubTab('alerts')}
        >
          <Bell size={15} />
          Sistem Alarmları ({data.alerts.length})
        </button>
        <button
          className={`${styles.tabBtn} ${subTab === 'mail' ? styles.activeTab : ''}`}
          onClick={() => setSubTab('mail')}
        >
          <Mail size={15} />
          Database Mail Kuyruğu & Hataları ({data.mail_status.recent_failed_items.length})
        </button>
        <button
          className={`${styles.tabBtn} ${subTab === 'webhook' ? styles.activeTab : ''}`}
          onClick={() => setSubTab('webhook')}
        >
          <Send size={14} />
          Kriz Webhook Bildirimi (Slack / Teams / Discord)
        </button>
      </div>

      {/* Tab 1: Alerts Table */}
      {subTab === 'alerts' && (
        <div className={styles.cardWrap}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <Bell size={16} />
              SQL Server Agent Sistem Alarmları Listesi
            </div>
            <button
              className={styles.scriptBtn}
              onClick={() => setSqlModal({ title: 'Kritik Sistem Alarmlarını Oluşturma Betiği', sql: data.create_missing_alerts_sql })}
            >
              <Copy size={13} />
              Toplu T-SQL Betiği
            </button>
          </div>
          <DataTable
            data={data.alerts}
            columns={alertColumns}
            keyField="name"
            emptyMessage="Tanımlı SQL Server alarmı bulunamadı."
          />
        </div>
      )}

      {/* Tab 2: Mail Queue & Failures */}
      {subTab === 'mail' && (
        <div className={styles.cardWrap}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <Mail size={16} />
              Son Başarısız Database Mail Gönderimleri
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={styles.scriptBtn}
                onClick={() => setSqlModal({ title: 'Database Mail Kuyruğunu Yeniden Başlatma Betiği', sql: data.mail_status.restart_queue_sql })}
              >
                <RotateCcw size={13} />
                Kuyruğu Yeniden Başlat (T-SQL)
              </button>
              <button
                className={styles.scriptBtn}
                onClick={() => setSqlModal({ title: 'Eski Başarısız Mailleri Temizleme Betiği', sql: data.mail_status.cleanup_failed_sql })}
              >
                <Trash2 size={13} />
                Hataları Temizle (T-SQL)
              </button>
            </div>
          </div>
          <DataTable
            data={data.mail_status.recent_failed_items}
            columns={mailColumns}
            keyField="mailitem_id"
            emptyMessage="Kayıtlı başarısız mail bulunamadı; Database Mail sorunsuz çalışıyor."
          />
        </div>
      )}

      {/* Tab 3: Webhook Settings */}
      {subTab === 'webhook' && <WebhookSettingsView />}

      {/* T-SQL Review Modal */}
      {sqlModal && (
        <div className={styles.modalOverlay} onClick={() => setSqlModal(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{sqlModal.title}</h3>
              <button className={styles.closeBtn} onClick={() => setSqlModal(null)}>✕</button>
            </div>
            <pre className={styles.sqlCode}>{sqlModal.sql}</pre>
            <div className={styles.modalFooter}>
              <button className={styles.copyBtn} onClick={() => handleCopy(sqlModal.sql)}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Kopyalandı!' : 'T-SQL Betiğini Kopyala'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
