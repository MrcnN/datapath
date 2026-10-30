import React, { useState, useEffect } from 'react';
import {
  Flame,
  AlertTriangle,
  Layers,
  Database,
  RefreshCw,
  Code2,
  Check,
  Copy,
  Clock,
  ShieldCheck,
  HardDrive,
  UserX,
} from 'lucide-react';
import { getTempDBContentionSummary } from '../../../lib/api';
import type {
  TempDBContentionSummary,
  TempDBContentionWaiter,
  TempDBSessionSpaceUsage,
} from '../../../lib/types';
import DataTable, { type Column } from '../../../components/ui/DataTable';
import StatusBadge from '../../../components/ui/StatusBadge';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import styles from './TempDBContentionViewer.module.css';

export default function TempDBContentionViewer() {
  const [data, setData] = useState<TempDBContentionSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeModalSql, setActiveModalSql] = useState<{ title: string; sql: string } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getTempDBContentionSummary();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'TempDB tahsis ve sayfa mandallanması verileri alınamadı.');
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
    return <LoadingSpinner message="TempDB PFS/GAM/SGAM sayfa mandallanmaları ve alan tüketimi sorgulanıyor..." />;
  }

  if (error || !data) {
    return <ErrorState message={error || 'Veri yüklenemedi.'} onRetry={loadData} />;
  }

  const waiterColumns: Column<TempDBContentionWaiter>[] = [
    {
      key: 'session_id',
      label: 'Bekleyen SPID',
      sortable: true,
      render: (w) => (
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          SPID {w.session_id}
        </span>
      ),
    },
    {
      key: 'wait_type',
      label: 'Mandal Türü',
      sortable: true,
      render: (w) => (
        <code style={{ fontSize: '12px', color: 'var(--warning, #eab308)' }}>
          {w.wait_type}
        </code>
      ),
    },
    {
      key: 'page_type',
      label: 'Sayfa Türü',
      sortable: true,
      render: (w) => {
        let variant: 'error' | 'warning' | 'info' = 'info';
        if (w.page_type === 'PFS') variant = 'error';
        if (w.page_type === 'SGAM') variant = 'warning';
        return <StatusBadge variant={variant} label={`${w.page_type} (${w.wait_resource})`} />;
      },
    },
    {
      key: 'wait_duration_ms',
      label: 'Bekleme Süresi',
      sortable: true,
      render: (w) => (
        <span style={{ color: w.wait_duration_ms > 500 ? 'var(--error)' : 'var(--text-primary)' }}>
          {w.wait_duration_ms} ms
        </span>
      ),
    },
    {
      key: 'blocking_session_id',
      label: 'Bloklayan SPID',
      render: (w) => (
        w.blocking_session_id ? (
          <span style={{ color: 'var(--error, #ef4444)', fontWeight: 600 }}>
            SPID {w.blocking_session_id}
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>Yok</span>
        )
      ),
    },
    {
      key: 'status_desc',
      label: 'Kök Neden Teşhisi',
      render: (w) => <span style={{ fontSize: '12px' }}>{w.status_desc}</span>,
    },
  ];

  const spaceColumns: Column<TempDBSessionSpaceUsage>[] = [
    {
      key: 'session_id',
      label: 'Oturum (SPID)',
      sortable: true,
      render: (s) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>SPID {s.session_id}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{s.login_name}</div>
        </div>
      ),
    },
    {
      key: 'program_name',
      label: 'Uygulama & İstemci',
      render: (s) => (
        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{s.program_name || 'Bilinmiyor'}</div>
          {s.host_name && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.host_name}</div>}
        </div>
      ),
    },
    {
      key: 'user_net_mb',
      label: 'User Objects (#Temp)',
      sortable: true,
      render: (s) => (
        <div>
          <span style={{ fontWeight: 600, color: s.user_net_mb > 1000 ? 'var(--error)' : 'var(--text-primary)' }}>
            {s.user_net_mb.toLocaleString()} MB
          </span>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            Tahsis: {s.user_objects_alloc_mb.toLocaleString()} MB
          </div>
        </div>
      ),
    },
    {
      key: 'internal_net_mb',
      label: 'Internal Objects (Sort/Hash)',
      sortable: true,
      render: (s) => (
        <div>
          <span style={{ fontWeight: 600, color: s.internal_net_mb > 1000 ? 'var(--warning)' : 'var(--text-primary)' }}>
            {s.internal_net_mb.toLocaleString()} MB
          </span>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            Tahsis: {s.internal_objects_alloc_mb.toLocaleString()} MB
          </div>
        </div>
      ),
    },
    {
      key: 'is_sleeping_open_tran',
      label: 'Oturum Durumu',
      render: (s) => (
        s.is_sleeping_open_tran ? (
          <StatusBadge variant="error" label="Açık İşlemde Uyuyor" />
        ) : (
          <StatusBadge variant="info" label="Aktif" />
        )
      ),
    },
    {
      key: 'actions',
      label: 'Reçete',
      render: (s) => (
        <button
          onClick={() => setActiveModalSql({
            title: `SPID ${s.session_id} TempDB Alan Sızıntısı İnceleme`,
            sql: s.remediation_sql,
          })}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            borderRadius: '4px',
            background: 'rgba(0, 210, 255, 0.1)',
            border: '1px solid rgba(0, 210, 255, 0.25)',
            color: 'var(--accent, #00d2ff)',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          <Code2 size={13} />
          İncele
        </button>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: data.has_contention ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)' }}>
            {data.has_contention ? <Flame size={20} color="#ef4444" /> : <ShieldCheck size={20} color="#22c55e" />}
          </div>
          <div>
            <div className={styles.kpiLabel}>Mandal Çekişme Durumu</div>
            <div className={styles.kpiValue} style={{ color: data.has_contention ? 'var(--error, #ef4444)' : 'var(--success, #22c55e)' }}>
              {data.has_contention ? 'DARBOĞAZ VAR' : 'SAĞLIKLI'}
            </div>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(245, 158, 11, 0.15)' }}>
            <Layers size={20} color="#f59e0b" />
          </div>
          <div>
            <div className={styles.kpiLabel}>PFS Mandallanması</div>
            <div className={styles.kpiValue}>{data.pfs_wait_count} Sayfa</div>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(59, 130, 246, 0.15)' }}>
            <HardDrive size={20} color="#3b82f6" />
          </div>
          <div>
            <div className={styles.kpiLabel}>SGAM & GAM Çekişmesi</div>
            <div className={styles.kpiValue}>{data.sgam_wait_count + data.gam_wait_count} Sayfa</div>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon} style={{ background: 'rgba(168, 85, 247, 0.15)' }}>
            <UserX size={20} color="#a855f7" />
          </div>
          <div>
            <div className={styles.kpiLabel}>En Çok Alan Tutan SPID</div>
            <div className={styles.kpiValue}>{data.top_space_consumers.length} Oturum</div>
          </div>
        </div>
      </div>

      {/* Action Banner */}
      <div className={styles.actionBanner}>
        <AlertTriangle size={20} style={{ color: data.has_contention ? 'var(--warning)' : 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ flex: 1 }}>
          <strong>DBA Önerisi & Çözüm Yolu:</strong> {data.recommended_action}
        </div>
        <button
          onClick={() => setActiveModalSql({
            title: 'TempDB Çoklu Dosya ve AUTOGROW_ALL_FILES Reçetesi',
            sql: data.remediation_sql,
          })}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '6px',
            background: 'var(--primary, #0284c7)',
            color: '#fff',
            border: 'none',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Code2 size={14} />
          T-SQL Reçetesi
        </button>
      </div>

      {/* Section 1: Active Latch Waiters */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <Flame size={18} style={{ color: 'var(--error)' }} />
            TempDB Aktif Sayfa Mandallanmaları (PAGELATCH Waits)
          </div>
          <button
            onClick={loadData}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
            }}
          >
            <RefreshCw size={14} /> Yenile
          </button>
        </div>
        <DataTable
          data={data.waiters}
          columns={waiterColumns}
          emptyMessage="Şu anda TempDB üzerinde aktif PFS/GAM/SGAM sayfa mandallanması (PAGELATCH) bulunmuyor."
        />
      </div>

      {/* Section 2: Session Space Leak Detector */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <Database size={18} style={{ color: 'var(--accent)' }} />
            TempDB Alan Tüketim & Sızıntı Takibi (User & Internal Space Leaks)
          </div>
        </div>
        <DataTable
          data={data.top_space_consumers}
          columns={spaceColumns}
          emptyMessage="TempDB üzerinde aşırı alan tutan oturum tespit edilmedi."
        />
      </div>

      {/* T-SQL Remediation Modal */}
      {activeModalSql && (
        <div className={styles.sqlModalOverlay} onClick={() => setActiveModalSql(null)}>
          <div className={styles.sqlModalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sqlModalHeader}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {activeModalSql.title}
              </div>
              <button
                onClick={() => setActiveModalSql(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '18px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
            <div className={styles.sqlCodeBox}>
              <pre style={{ margin: 0 }}>{activeModalSql.sql}</pre>
            </div>
            <div className={styles.sqlModalFooter}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                * Salt okunur politika: Bu betik incelenip SSMS üzerinden yürütülmelidir.
              </span>
              <button className={styles.copyBtn} onClick={() => handleCopy(activeModalSql.sql)}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Kopyalandı!' : 'Kodu Kopyala'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
