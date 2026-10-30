import React, { useState, useEffect } from 'react';
import {
  Clock,
  AlertTriangle,
  Database,
  HardDrive,
  Copy,
  Check,
  RefreshCw,
  Zap,
  ShieldAlert,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { getOpenTransactionsSummary } from '../../../lib/api';
import type {
  OpenTransactionsSummary,
  OpenTransaction,
  LogReuseWaitDetail,
} from '../../../lib/types';
import DataTable, { type Column } from '../../../components/ui/DataTable';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import styles from './OpenTransactionsViewer.module.css';

export default function OpenTransactionsViewer() {
  const [data, setData] = useState<OpenTransactionsSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getOpenTransactionsSummary();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Açık işlemler bilgisi alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (loading) {
    return <LoadingSpinner text="Açık işlemler ve Transaction Log kesilme durumu sorgulanıyor..." />;
  }

  if (error || !data) {
    return <ErrorState message={error || 'Veri yüklenemedi.'} onRetry={loadData} />;
  }

  const columns: Column<OpenTransaction>[] = [
    {
      key: 'session_id',
      label: 'SPID & Oturum',
      sortable: true,
      render: (t) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
              SPID {t.session_id}
            </span>
            {t.is_dormant_active ? (
              <span className={styles.dormantBadge} title="Oturum uykuda (sleeping) ancak transaction açık bırakılmış!">
                <Flame size={11} /> ASKIDA / UYKUDA
              </span>
            ) : (
              <span className={styles.activeBadge}>
                {t.session_status}
              </span>
            )}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {t.login_name} @ {t.host_name || 'localhost'}
          </div>
        </div>
      ),
    },
    {
      key: 'database_name',
      label: 'Veritabanı',
      sortable: true,
      render: (t) => <strong>{t.database_name}</strong>,
    },
    {
      key: 'duration_seconds',
      label: 'Açık Kalma Süresi',
      sortable: true,
      render: (t) => (
        <div>
          <span
            className={t.duration_seconds > 600 ? styles.durationBadgeCritical : styles.durationBadgeNormal}
          >
            {t.duration_formatted}
          </span>
          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{t.begin_time}</div>
        </div>
      ),
    },
    {
      key: 'log_bytes_used_mb',
      label: 'Log Dosyası Tüketimi',
      sortable: true,
      render: (t) => (
        <div>
          <span style={{ fontWeight: 600, color: t.log_bytes_used_mb > 100 ? '#ef4444' : 'var(--text-primary)' }}>
            {t.log_bytes_used_mb.toFixed(1)} MB
          </span>
          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
            {t.log_records_count.toLocaleString()} log kaydı
          </div>
        </div>
      ),
    },
    {
      key: 'blocking_session_count',
      label: 'Bloklanan Oturum',
      sortable: true,
      render: (t) => (
        <span
          style={{
            fontWeight: 700,
            color: t.blocking_session_count > 0 ? '#ef4444' : 'var(--text-muted)',
          }}
        >
          {t.blocking_session_count > 0 ? `${t.blocking_session_count} Oturum` : 'Yok'}
        </span>
      ),
    },
    {
      key: 'sql_text',
      label: 'Yürütülen / Son Komut (SQL Text)',
      render: (t) => (
        <div style={{ minWidth: '220px', maxWidth: '380px' }}>
          {t.sql_text ? (
            <div className={styles.sqlCodeBox}>{t.sql_text}</div>
          ) : (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>SQL metni bulunamadı</span>
          )}
        </div>
      ),
    },
    {
      key: 'kill_script',
      label: 'Eylemler (Review Only)',
      render: (t) => (
        <button
          type="button"
          className={styles.copyKillBtn}
          onClick={() => handleCopy(t.kill_script, `kill-${t.session_id}`)}
          title="Güvenli KILL komutunu panoya kopyala"
        >
          {copiedKey === `kill-${t.session_id}` ? <Check size={12} /> : <Copy size={12} />}
          {copiedKey === `kill-${t.session_id}` ? 'Kopyalandı' : `KILL ${t.session_id}`}
        </button>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      {/* Metrics Row */}
      <div className={styles.metricsRow}>
        <div className={styles.statCard}>
          <div className={styles.statIconWrap} style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
            <Clock size={20} />
          </div>
          <div>
            <div className={styles.statTitle}>Toplam Açık İşlem</div>
            <div className={styles.statValue}>{data.total_active_transactions}</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div
            className={styles.statIconWrap}
            style={{
              background: data.dormant_open_transactions_count > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
              color: data.dormant_open_transactions_count > 0 ? '#ef4444' : 'var(--status-success)',
            }}
          >
            <Flame size={20} />
          </div>
          <div>
            <div className={styles.statTitle}>Askıda Kalan İşlem</div>
            <div
              className={styles.statValue}
              style={{ color: data.dormant_open_transactions_count > 0 ? '#ef4444' : 'inherit' }}
            >
              {data.dormant_open_transactions_count}
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconWrap} style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <div className={styles.statTitle}>En Uzun Açık İşlem</div>
            <div className={styles.statValue}>
              {data.longest_running_duration_sec > 60
                ? `${Math.floor(data.longest_running_duration_sec / 60)} dk`
                : `${data.longest_running_duration_sec} sn`}
              {data.longest_running_spid && ` (SPID ${data.longest_running_spid})`}
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconWrap} style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
            <HardDrive size={20} />
          </div>
          <div>
            <div className={styles.statTitle}>Rezerve Edilen Log Alanı</div>
            <div className={styles.statValue}>{data.total_log_space_held_mb.toFixed(1)} MB</div>
          </div>
        </div>
      </div>

      {/* Alert Banner for Dormant Open Transactions */}
      {data.dormant_open_transactions_count > 0 && (
        <div className={styles.alertBox}>
          <ShieldAlert size={20} className={styles.alertIcon} />
          <div>
            <strong>Kritik Teşhis — Sahipsiz / Askıda İşlem (Dormant Open Transaction):</strong> Sistemde oturum durumu
            'sleeping' olmasına rağmen açık işlem (open_transaction_count &gt; 0) tutan bağlantılar tespit edildi. Bu durum,
            uygulamada veya sorguda <code>BEGIN TRAN</code> çalıştırılıp ardından <code>COMMIT</code> veya{' '}
            <code>ROLLBACK</code> yapılmadan bağlantının havuza bırakılmasından kaynaklanır. Bu işlemler sonlandırılmadıkça
            Transaction Log asla kesilemez ve diski doldurana kadar büyür!
          </div>
        </div>
      )}

      {/* Section 1: Open Transactions Table */}
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>
          <Clock size={16} color="var(--accent)" />
          Canlı Açık & Askıda Kalan İşlemler (sys.dm_tran_active_transactions)
        </div>
      </div>

      <div className={styles.tableWrap}>
        <DataTable
          columns={columns}
          data={data.transactions}
          keyField="transaction_id"
          emptyMessage="Şu anda SQL Server üzerinde uzun süredir açık kalan veya askıda bekleyen aktif işlem bulunmuyor."
        />
      </div>

      {/* Section 2: Log Reuse Wait Analysis */}
      <div className={styles.sectionHeader} style={{ marginTop: 'var(--space-4)' }}>
        <div className={styles.sectionTitle}>
          <Database size={16} color="var(--accent)" />
          Log Kesilmesini Engelleyen Sebepler (log_reuse_wait_desc Teşhisi)
        </div>
      </div>

      <div className={styles.reuseGrid}>
        {data.log_reuse_waits.map((w) => {
          const isCrit = w.status === 'CRITICAL';
          const isWarn = w.status === 'WARNING';
          const cardClass = isCrit
            ? `${styles.reuseCard} ${styles.reuseCardCritical}`
            : isWarn
            ? `${styles.reuseCard} ${styles.reuseCardWarning}`
            : styles.reuseCard;

          const pillClass = isCrit
            ? `${styles.waitPill} ${styles.waitPillCritical}`
            : isWarn
            ? `${styles.waitPill} ${styles.waitPillWarning}`
            : `${styles.waitPill} ${styles.waitPillHealthy}`;

          return (
            <div key={w.database_name} className={cardClass}>
              <div className={styles.reuseCardHeader}>
                <span className={styles.dbTitle}>{w.database_name}</span>
                <span className={pillClass}>{w.log_reuse_wait_desc}</span>
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Kurtarma Modeli: <strong>{w.recovery_model}</strong> • Log Boyutu:{' '}
                <strong>{w.log_size_mb.toFixed(1)} MB</strong>
              </div>

              <div className={styles.rootCauseText}>
                <strong>Kök Neden:</strong> {w.root_cause_explanation}
              </div>

              <div>
                <strong style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Önerilen Aksiyonlar:</strong>
                <ul className={styles.stepsList}>
                  {w.remediation_steps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              </div>

              <div className={styles.scriptBox}>
                <button
                  type="button"
                  className={styles.copyScriptBtn}
                  onClick={() => handleCopy(w.remediation_script, `remed-${w.database_name}`)}
                  title="T-SQL betiğini kopyala"
                >
                  {copiedKey === `remed-${w.database_name}` ? <Check size={11} /> : <Copy size={11} />}
                  {copiedKey === `remed-${w.database_name}` ? 'Kopyalandı' : 'Kodu Kopyala'}
                </button>
                <pre className={styles.scriptCode}>{w.remediation_script}</pre>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
