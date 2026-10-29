import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity,
  Flame,
  ShieldAlert,
  RefreshCw,
  Code2,
  Trash2,
  Clock,
  Database,
  Search,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import { getLiveSessionsSummary } from '../../../lib/api';
import { formatDuration, formatDate } from '../../../lib/utils';
import DataTable, { type Column } from '../../../components/ui/DataTable';
import StatusBadge, { type BadgeStatus } from '../../../components/ui/StatusBadge';
import ErrorState from '../../../components/ui/ErrorState';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import CodeBlock from '../../../components/ui/CodeBlock';
import CopyButton from '../../../components/ui/CopyButton';
import type { Session, LiveProcessSummary } from '../../../lib/types';
import styles from '../IncidentCenterPage.module.css';

function sessionStatus(status: string): BadgeStatus {
  if (status === 'running') return 'success';
  if (status === 'sleeping') return 'neutral';
  if (status === 'suspended' || status === 'blocked') return 'error';
  return 'info';
}

function formatElapsed(ms: number): string {
  if (!ms || ms <= 0) return '0s';
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec} sn`;
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins < 60) return `${mins} dk ${secs} sn`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours} sa ${remMins} dk`;
}

interface SessionsTableProps {
  activeOnly?: boolean;
  onToggleActive?: () => void;
  sessions?: Session[];
  onRefresh?: () => void;
}

export default function SessionsTable({
  activeOnly: propActiveOnly = true,
  sessions: initialSessions,
  onRefresh: propRefresh,
}: SessionsTableProps) {
  const [activeOnly, setActiveOnly] = useState<boolean>(propActiveOnly);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'blocked' | 'root_blocker'>('all');
  const [refreshInterval, setRefreshInterval] = useState<number>(5); // default 5 seconds
  const [summary, setSummary] = useState<LiveProcessSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(!initialSessions);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeScript, setActiveScript] = useState<{ title: string; sql: string; isKill?: boolean } | null>(null);

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    else setIsFetching(true);
    setError(null);
    try {
      const res = await getLiveSessionsSummary({ active_only: activeOnly });
      setSummary(res);
    } catch (err: any) {
      if (isInitial) {
        setError(err.message || 'Canlı oturum verileri alınamadı.');
      }
    } finally {
      if (isInitial) setLoading(false);
      else setIsFetching(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    if (!initialSessions) {
      fetchData(true);
    }
  }, [fetchData, initialSessions]);

  // Auto-refresh interval effect
  useEffect(() => {
    if (refreshInterval <= 0 || initialSessions) return;

    const timer = setInterval(() => {
      fetchData(false);
    }, refreshInterval * 1000);

    return () => clearInterval(timer);
  }, [refreshInterval, fetchData, initialSessions]);

  const rawSessions = initialSessions ?? summary?.sessions ?? [];

  const filtered = useMemo(() => {
    let result = rawSessions;

    if (statusFilter === 'running') {
      result = result.filter((s) => s.status === 'running');
    } else if (statusFilter === 'blocked') {
      result = result.filter((s) => s.blocking_session_id && s.blocking_session_id > 0);
    } else if (statusFilter === 'root_blocker') {
      result = result.filter((s) => s.is_root_blocker);
    }

    if (!filter.trim()) return result;
    const q = filter.toLowerCase();
    return result.filter(
      (s) =>
        (s.login_name ?? '').toLowerCase().includes(q) ||
        (s.host_name ?? '').toLowerCase().includes(q) ||
        (s.program_name ?? '').toLowerCase().includes(q) ||
        (s.db_name ?? (s as any).database_name ?? '').toLowerCase().includes(q) ||
        (s.sql_text ?? '').toLowerCase().includes(q) ||
        (s.current_statement ?? '').toLowerCase().includes(q) ||
        String(s.session_id).includes(q)
    );
  }, [rawSessions, filter, statusFilter]);

  const columns: Column<Session>[] = [
    {
      key: 'session_id',
      label: 'SPID',
      sortable: true,
      width: '100px',
      render: (s) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <strong style={{ color: '#ffffff', fontSize: '13px' }}>#{s.session_id}</strong>
          {s.is_root_blocker ? (
            <span className={styles.rootBlockerTag}>
              <Flame size={12} /> KÖK BLOKER
            </span>
          ) : s.blocking_session_id && s.blocking_session_id > 0 ? (
            <span style={{ fontSize: '10.5px', color: '#ef4444', fontWeight: 600 }}>
              ← SPID {s.blocking_session_id}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'login_name',
      label: 'Kullanıcı & Host',
      sortable: true,
      render: (s) => (
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>{s.login_name || 'Bilinmiyor'}</strong>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {s.host_name || '—'} {s.program_name ? `• ${s.program_name}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'db_name',
      label: 'Veritabanı',
      sortable: true,
      render: (s) => (
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)' }}>
          {s.db_name ?? (s as any).database_name ?? '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Durum',
      render: (s) => (
        <StatusBadge
          status={sessionStatus(s.status ?? '')}
          label={s.status ?? 'unknown'}
        />
      ),
    },
    {
      key: 'elapsed_time_ms',
      label: 'Süre (Elapsed)',
      sortable: true,
      render: (s) => {
        const ms = s.elapsed_time_ms ?? 0;
        const color = ms >= 60000 ? '#ef4444' : ms >= 15000 ? '#f59e0b' : 'var(--text-secondary)';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Clock size={12} style={{ color }} />
            <span style={{ fontWeight: 600, fontSize: '12px', color }}>
              {formatElapsed(ms)}
            </span>
          </div>
        );
      },
    },
    {
      key: 'current_statement',
      label: 'Yürütülen SQL Komutu',
      render: (s) => {
        const stmt = s.current_statement || s.sql_text || s.command || '—';
        const display = stmt.length > 90 ? stmt.substring(0, 90) + '...' : stmt;
        return (
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: '11.5px',
              color: 'var(--text-primary)',
              maxWidth: '320px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={stmt}
          >
            {display}
          </div>
        );
      },
    },
    {
      key: 'wait_type',
      label: 'Bekleme (Wait)',
      render: (s) =>
        s.wait_type ? (
          <div>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#f59e0b' }}>
              {s.wait_type}
            </span>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {formatDuration(s.wait_time_ms ?? (s as any).wait_time ?? 0)}
            </div>
          </div>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        ),
    },
    {
      key: 'tempdb_allocations_mb',
      label: 'TempDB / Bellek',
      sortable: true,
      render: (s) => (
        <div style={{ fontSize: '11.5px' }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>T-DB: </span>
            <strong style={{ color: (s.tempdb_allocations_mb ?? 0) > 50 ? '#ef4444' : 'inherit' }}>
              {(s.tempdb_allocations_mb ?? 0).toFixed(1)} MB
            </strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>RAM: </span>
            <span>{(s.memory_grant_mb ?? 0).toFixed(1)} MB</span>
          </div>
        </div>
      ),
    },
    {
      key: 'open_transaction_count',
      label: 'TX / İzolasyon',
      render: (s) => (
        <div style={{ fontSize: '11px' }}>
          <div>
            <strong style={{ color: (s.open_transaction_count ?? 0) > 0 ? '#10b981' : 'var(--text-muted)' }}>
              {s.open_transaction_count ?? 0} Açık TX
            </strong>
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
            {s.transaction_isolation_level || 'ReadCommitted'}
          </div>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'İşlemler',
      render: (s) => (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            className={styles.tabBtn}
            style={{ padding: '3px 8px', fontSize: '11px' }}
            title="Sorgu Metnini İncele"
            onClick={() =>
              setActiveScript({
                title: `SPID #${s.session_id} — Yürütülen SQL İfadesi`,
                sql: s.current_statement || s.sql_text || `-- Komut: ${s.command ?? 'Bilinmiyor'}`,
                isKill: false,
              })
            }
          >
            <Code2 size={13} />
            SQL
          </button>
          <button
            type="button"
            className={styles.tabBtn}
            style={{ padding: '3px 8px', fontSize: '11px', color: '#ef4444' }}
            title="Güvenli KILL Betiğini Görüntüle"
            onClick={() =>
              setActiveScript({
                title: `Acil Durum Müdahalesi — SPID #${s.session_id} KILL Betiği`,
                sql: `-- =======================================================
-- Datapath Acil Durum Oturum Sonlandırma Betiği
-- Hedef SPID: ${s.session_id} | Login: ${s.login_name || 'Bilinmiyor'} | Host: ${s.host_name || 'Bilinmiyor'}
-- Durum: ${s.status || 'unknown'} | Veritabanı: ${s.db_name || 'master'}
-- Açık Transaction: ${s.open_transaction_count ?? 0}
-- =======================================================

-- 1. Oturumun o anki giriş arabelleğini kontrol ediniz:
DBCC INPUTBUFFER(${s.session_id});
GO

-- 2. Gerekli onay verildikten sonra oturumu sonlandırınız:
KILL ${s.session_id};
GO`,
                isKill: true,
              })
            }
          >
            <Trash2 size={13} />
            KILL
          </button>
        </div>
      ),
    },
  ];

  if (error && !initialSessions && !summary) {
    return <ErrorState message={error} onRetry={() => fetchData(true)} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {/* KPI Cards Summary Strip */}
      {summary && (
        <div className={styles.processKpiGrid}>
          <div className={styles.processKpiCard}>
            <div className={styles.processKpiTitle}>Toplam Oturumlar</div>
            <div className={styles.processKpiValue} style={{ color: 'var(--accent)' }}>
              {summary.total_active_sessions}
            </div>
            <div className={styles.processKpiSub}>İzlenen kullanıcı süreçleri</div>
          </div>

          <div className={styles.processKpiCard}>
            <div className={styles.processKpiTitle}>Çalışan (Running)</div>
            <div className={styles.processKpiValue} style={{ color: '#10b981' }}>
              {summary.running_sessions}
            </div>
            <div className={styles.processKpiSub}>CPU üzerinde aktif işlenen</div>
          </div>

          <div className={styles.processKpiCard}>
            <div className={styles.processKpiTitle}>Kilitlenen (Blocked)</div>
            <div className={styles.processKpiValue} style={{ color: summary.blocked_sessions > 0 ? '#ef4444' : 'var(--text-secondary)' }}>
              {summary.blocked_sessions}
            </div>
            <div className={styles.processKpiSub}>Kilit kuyruğunda bekleyenler</div>
          </div>

          <div
            className={styles.processKpiCard}
            style={summary.root_blockers_count > 0 ? { borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.05)' } : {}}
          >
            <div className={styles.processKpiTitle} style={summary.root_blockers_count > 0 ? { color: '#ef4444' } : {}}>
              Kök Engelleyiciler
            </div>
            <div className={styles.processKpiValue} style={{ color: summary.root_blockers_count > 0 ? '#ef4444' : 'var(--status-success)' }}>
              {summary.root_blockers_count}
            </div>
            <div className={styles.processKpiSub}>Diğer süreçleri kilitleyen başlar</div>
          </div>

          <div className={styles.processKpiCard}>
            <div className={styles.processKpiTitle}>TempDB & Bellek</div>
            <div className={styles.processKpiValue} style={{ color: '#f59e0b', fontSize: '18px' }}>
              {summary.total_tempdb_mb} MB
            </div>
            <div className={styles.processKpiSub}>
              Bellek Hibe: <strong>{summary.total_memory_grant_mb} MB</strong>
            </div>
          </div>
        </div>
      )}

      {/* Live Toolbar */}
      <div className={styles.liveToolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Oturumlarda ara (SPID, kullanıcı, DB, host, SQL)..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                padding: '6px 10px 6px 30px',
                fontSize: '12.5px',
                width: '300px',
                outline: 'none',
              }}
            />
          </div>

          {/* Quick status filters */}
          <div className={styles.filterGroup}>
            <button
              type="button"
              className={`${styles.badgeFilter} ${statusFilter === 'all' ? styles.badgeFilterActive : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              Tümü ({rawSessions.length})
            </button>
            <button
              type="button"
              className={`${styles.badgeFilter} ${statusFilter === 'running' ? styles.badgeFilterActive : ''}`}
              onClick={() => setStatusFilter('running')}
            >
              Running ({rawSessions.filter((s) => s.status === 'running').length})
            </button>
            <button
              type="button"
              className={`${styles.badgeFilter} ${statusFilter === 'blocked' ? styles.badgeFilterActive : ''}`}
              onClick={() => setStatusFilter('blocked')}
            >
              Kilitlenen ({rawSessions.filter((s) => s.blocking_session_id && s.blocking_session_id > 0).length})
            </button>
            <button
              type="button"
              className={`${styles.badgeFilter} ${statusFilter === 'root_blocker' ? styles.badgeFilterActive : ''}`}
              onClick={() => setStatusFilter('root_blocker')}
            >
              Kök Bloker ({rawSessions.filter((s) => s.is_root_blocker).length})
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            Yalnızca Aktif İstekler
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Yenileme:
            </span>
            <select
              className={styles.refreshSelect}
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
            >
              <option value={0}>Manuel (Kapalı)</option>
              <option value={3}>3 sn</option>
              <option value={5}>5 sn</option>
              <option value={10}>10 sn</option>
              <option value={30}>30 sn</option>
            </select>
          </div>

          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => (propRefresh ? propRefresh() : fetchData(false))}
            disabled={isFetching}
            title="Oturumları Şimdi Yenile"
          >
            <RefreshCw size={13} className={isFetching ? styles.spinning : ''} />
            Hemen Yenile
          </button>
        </div>
      </div>

      {/* Script / Review Drawer */}
      {activeScript && (
        <div className={styles.scriptModal}>
          <div className={styles.scriptHeader}>
            <strong style={activeScript.isKill ? { color: '#ef4444' } : { color: 'var(--accent)' }}>
              {activeScript.title}
            </strong>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <CopyButton text={activeScript.sql} label={activeScript.isKill ? 'KILL Betiğini Kopyala' : 'SQL Kopyala'} />
              <button
                type="button"
                className={styles.tabBtn}
                style={{ padding: '2px 8px', fontSize: '11px' }}
                onClick={() => setActiveScript(null)}
              >
                Kapat
              </button>
            </div>
          </div>
          <CodeBlock code={activeScript.sql} language="sql" />
          <div style={{ fontSize: '11px', color: '#f59e0b' }}>
            ⚠️ <strong>Güvenlik ve İnceleme İlkesi:</strong> Datapath asla sunucuda otomatik `KILL` işlemi çalıştırmaz. Sorguyu DBA onayından geçirip SSMS üzerinden kontrollü şekilde uygulayınız.
          </div>
        </div>
      )}

      {/* Main Table */}
      {loading ? (
        <LoadingSpinner label="Canlı süreçler ve DMV oturumları taranıyor..." />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          loading={isFetching}
          emptyMessage="Kriterlere uygun aktif kullanıcı oturumu bulunamadı."
          emptyTitle="Aktif Oturum Yok"
        />
      )}
    </div>
  );
}
