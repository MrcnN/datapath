import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Key,
  AlertOctagon,
  HardDrive,
  Search,
  RefreshCw,
  Copy,
  Check,
  FileCode,
  Terminal,
  UserX,
  Layers,
  Flame,
  Info,
} from 'lucide-react';
import DataTable, { type Column } from '../../../components/ui/DataTable';
import CodeBlock from '../../../components/ui/CodeBlock';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import EmptyState from '../../../components/ui/EmptyState';
import { getErrorLogForensicsAnalysis } from '../../../lib/api';
import type {
  ErrorLogForensicsResponse,
  LoginFailureDetail,
  ClassifiedErrorLogEntry,
  ErrorLogEntry,
} from '../../../lib/types';
import styles from './ErrorLogViewer.module.css';

interface ErrorLogViewerProps {
  entries?: ErrorLogEntry[];
  loading?: boolean;
}

export default function ErrorLogViewer({ entries }: ErrorLogViewerProps) {
  const [data, setData] = useState<ErrorLogForensicsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'sentinel' | 'critical' | 'all'>('sentinel');
  const [search, setSearch] = useState<string>('');
  const [showRunbook, setShowRunbook] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getErrorLogForensicsAnalysis(1000);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Hata günlüğü adli bilişim analizi alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !data) {
    return <LoadingSpinner message="SQL Server hata günlüğü (xp_readerrorlog) ve güvenlik olayları taranıyor..." />;
  }

  if (error && !data) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  const summary = data?.summary;
  const topFailed = data?.top_failed_logins || [];
  const criticalEntries = data?.recent_critical_entries || [];

  const filteredLogins = topFailed.filter((f) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      f.user_name.toLowerCase().includes(s) ||
      f.client_ip.toLowerCase().includes(s) ||
      f.state_description.toLowerCase().includes(s)
    );
  });

  const filteredCritical = criticalEntries.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.message.toLowerCase().includes(s) ||
      c.process_info.toLowerCase().includes(s) ||
      c.category.toLowerCase().includes(s)
    );
  });

  const loginColumns: Column<LoginFailureDetail>[] = [
    {
      key: 'user_name',
      label: 'Hedef Hesap (User)',
      render: (f) => (
        <div>
          <div style={{ fontWeight: 600, color: f.user_name.toLowerCase() === 'sa' ? '#ef4444' : 'var(--text-primary)' }}>
            {f.user_name}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            İlk: {f.first_attempt}
          </div>
        </div>
      ),
    },
    {
      key: 'client_ip',
      label: 'Saldıran İstemci (Client IP)',
      render: (f) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {f.client_ip}
        </span>
      ),
    },
    {
      key: 'state_code',
      label: 'Hata Durumu (State Code)',
      render: (f) => (
        <div>
          <div style={{ fontWeight: 600, color: f.state_code === 8 ? '#f59e0b' : '#38bdf8', fontSize: '0.8rem' }}>
            State {f.state_code}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {f.state_description}
          </div>
        </div>
      ),
    },
    {
      key: 'failure_count',
      label: 'Başarısız Deneme Sayısı',
      sortable: true,
      render: (f) => (
        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: f.failure_count >= 10 ? '#ef4444' : '#f59e0b' }}>
          {f.failure_count.toLocaleString()} kez
        </span>
      ),
    },
    {
      key: 'last_attempt',
      label: 'Son Deneme Zamanı',
      render: (f) => (
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          {f.last_attempt}
        </span>
      ),
    },
  ];

  const criticalColumns: Column<ClassifiedErrorLogEntry>[] = [
    {
      key: 'log_date',
      label: 'Zaman',
      render: (c) => (
        <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
          {c.log_date}
        </span>
      ),
    },
    {
      key: 'category',
      label: 'Kategori & Önem',
      render: (c) => {
        const cls =
          c.severity === 'CRITICAL'
            ? styles.badgeCritical
            : c.severity === 'HIGH'
            ? styles.badgeHigh
            : c.severity === 'WARNING'
            ? styles.badgeWarning
            : styles.badgeInfo;

        return (
          <div>
            <span className={cls}>{c.severity}</span>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {c.category}
            </div>
          </div>
        );
      },
    },
    {
      key: 'process_info',
      label: 'İşlem (Process)',
      render: (c) => (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          [{c.process_info}]
        </span>
      ),
    },
    {
      key: 'message',
      label: 'Hata Günlüğü Açıklaması',
      render: (c) => (
        <div style={{ maxWidth: 460, wordBreak: 'break-word', fontSize: '0.78rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
          {c.message}
        </div>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      {/* 1. Header Card */}
      <div className={styles.headerCard}>
        <div className={styles.titleArea}>
          <div className={styles.titleRow}>
            <ShieldAlert size={20} color="var(--primary-color, #2563eb)" />
            <h3 className={styles.title}>Hata Günlüğü &amp; Güvenlik Olayları Adli Bilişim Stüdyosu</h3>
            <span className={styles.badgeLive}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              Live Error Log
            </span>
          </div>
          <p className={styles.subtitle}>
            SQL Server Error Log (xp_readerrorlog) kayıtlarını ayrıştırır; Error 18456 kaba kuvvet (brute-force) saldırılarını, State kodlarını ve donanım I/O hatalarını analiz eder.
          </p>
        </div>

        <div className={styles.actionsArea}>
          <button className={styles.btnSecondary} onClick={() => setShowRunbook(!showRunbook)}>
            <FileCode size={14} />
            {showRunbook ? 'Reçeteyi Gizle' : 'Güvenlik Reçetesi (T-SQL)'}
          </button>
          <button className={styles.btnSecondary} onClick={fetchData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Yenile
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      {summary && (
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span>Başarısız Giriş Olayları</span>
              <UserX size={16} color={summary.login_failures_count > 0 ? '#ef4444' : '#10b981'} />
            </div>
            <div className={styles.kpiValue} style={{ color: summary.login_failures_count > 0 ? '#ef4444' : 'var(--text-primary)' }}>
              {summary.login_failures_count.toLocaleString()}
            </div>
            <div className={styles.kpiFooter}>
              {summary.unique_attacking_ips} Farklı İstemci IP Adresi
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span>Donanım &amp; I/O Hataları</span>
              <HardDrive size={16} color={summary.corruption_events_count > 0 ? '#ef4444' : '#10b981'} />
            </div>
            <div className={styles.kpiValue} style={{ color: summary.corruption_events_count > 0 ? '#ef4444' : '#10b981' }}>
              {summary.corruption_events_count}
              <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)' }}>Olay</span>
            </div>
            <div className={styles.kpiFooter}>
              Error 823, 824, 825, torn page denetimi
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span>Bellek Dökümü / Çökme</span>
              <AlertOctagon size={16} color={summary.memory_dump_count > 0 ? '#ef4444' : '#10b981'} />
            </div>
            <div className={styles.kpiValue} style={{ color: summary.memory_dump_count > 0 ? '#ef4444' : '#10b981' }}>
              {summary.memory_dump_count}
            </div>
            <div className={styles.kpiFooter}>
              Stack dump, .mdmp dosya kayıtları
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span>Giriş Denetim Seviyesi</span>
              <Key size={16} color="var(--primary-color, #2563eb)" />
            </div>
            <div className={styles.kpiValue} style={{ fontSize: '1.05rem' }}>
              {summary.audit_level}
            </div>
            <div className={styles.kpiFooter}>
              SERVERPROPERTY('AuditLevel')
            </div>
          </div>
        </div>
      )}

      {/* 3. Sub-tabs Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className={styles.tabsBar}>
          <button
            className={`${styles.tabBtn} ${activeSubTab === 'sentinel' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveSubTab('sentinel')}
          >
            <Key size={14} />
            Brute-Force &amp; Giriş Başarısızlıkları ({topFailed.length})
          </button>
          <button
            className={`${styles.tabBtn} ${activeSubTab === 'critical' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveSubTab('critical')}
          >
            <AlertOctagon size={14} />
            Kritik &amp; Donanım Hata Kayıtları ({criticalEntries.length})
          </button>
        </div>

        <div style={{ position: 'relative', width: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Hesap, IP veya hata metni ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 10px 6px 30px',
              fontSize: '0.82rem',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* 4. Active Tab Content */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
        {activeSubTab === 'sentinel' ? (
          filteredLogins.length === 0 ? (
            <EmptyState
              title="Başarısız Giriş Denemesi Yok"
              message="Hata günlüğünde son incelenen aralıkta şüpheli giriş başarısızlığı (Error 18456) tespit edilmedi."
            />
          ) : (
            <DataTable data={filteredLogins} columns={loginColumns} />
          )
        ) : filteredCritical.length === 0 ? (
          <EmptyState
            title="Kritik Motor veya Donanım Hatası Yok"
            message="Hata günlüğünde son incelenen aralıkta Error 823/824/825 veya bellek dökümü (crash) bulunamadı."
          />
        ) : (
          <DataTable data={filteredCritical} columns={criticalColumns} />
        )}
      </div>

      {/* 5. Remediation Runbook T-SQL */}
      {showRunbook && data && (
        <div className={styles.runbookSection}>
          <div className={styles.runbookHeader}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Terminal size={15} color="var(--primary-color, #2563eb)" />
              Önerilen Güvenlik ve Giriş Denetimi T-SQL Reçetesi
            </span>
            <button className={styles.btnPrimary} onClick={() => handleCopy(data.remediation_runbook)}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Kopyalandı' : 'Betiği Kopyala'}
            </button>
          </div>
          <div className={styles.runbookCodeArea}>
            <CodeBlock code={data.remediation_runbook} language="sql" />
          </div>
        </div>
      )}
    </div>
  );
}
