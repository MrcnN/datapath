import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Activity,
  Play,
  Pause,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  Database,
  Clock,
  Terminal,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Search,
  X,
  Cpu,
  Layers,
  Flame,
} from 'lucide-react';
import { getLiveSessionsSummary } from '../../../lib/api';
import type { LiveProcessSummary, Session } from '../../../lib/types';
import DemoDataBanner from '../../../components/ui/DemoDataBanner';
import styles from './LiveSessionCockpit.module.css';

export default function LiveSessionCockpit() {
  const [summary, setSummary] = useState<LiveProcessSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Controls
  const [refreshInterval, setRefreshInterval] = useState<number>(5); // 0 = paused, 3, 5, 10
  const [search, setSearch] = useState<string>('');
  const [selectedDb, setSelectedDb] = useState<string>('ALL');
  const [onlyBlockers, setOnlyBlockers] = useState<boolean>(false);
  const [expandedSpid, setExpandedSpid] = useState<number | null>(null);

  // Safe Kill Modal
  const [killModalSession, setKillModalSession] = useState<Session | null>(null);
  const [copiedKill, setCopiedKill] = useState<boolean>(false);

  const timerRef = useRef<any>(null);

  const loadData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setError(null);
      const res = await getLiveSessionsSummary({ active_only: false });
      setSummary(res);
    } catch (err: any) {
      setError(err.message || 'Canlı oturum verileri alınamadı.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Periodic Auto-Refresh
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (refreshInterval > 0) {
      timerRef.current = setInterval(() => {
        loadData(true);
      }, refreshInterval * 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refreshInterval, loadData]);

  // Extract unique database names
  const databases = useMemo(() => {
    if (!summary?.sessions) return [];
    const set = new Set<string>();
    summary.sessions.forEach((s) => {
      if (s.db_name) set.add(s.db_name);
    });
    return Array.from(set).sort();
  }, [summary?.sessions]);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    if (!summary?.sessions) return [];
    return summary.sessions.filter((s) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        String(s.session_id).includes(q) ||
        (s.login_name && s.login_name.toLowerCase().includes(q)) ||
        (s.host_name && s.host_name.toLowerCase().includes(q)) ||
        (s.program_name && s.program_name.toLowerCase().includes(q)) ||
        (s.wait_type && s.wait_type.toLowerCase().includes(q)) ||
        (s.sql_text && s.sql_text.toLowerCase().includes(q));

      const matchesDb = selectedDb === 'ALL' || s.db_name === selectedDb;
      const matchesBlocker = !onlyBlockers || s.is_root_blocker || (s.blocking_session_id && s.blocking_session_id > 0);

      return matchesSearch && matchesDb && matchesBlocker;
    });
  }, [summary?.sessions, search, selectedDb, onlyBlockers]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleCopyKill = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedKill(true);
    setTimeout(() => setCopiedKill(false), 2000);
  };

  const formatElapsed = (ms?: number | null) => {
    if (!ms || ms <= 0) return '0 sn';
    const totalSec = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) return `${hrs} sa ${mins} dk`;
    if (mins > 0) return `${mins} dk ${secs} sn`;
    return `${secs} sn`;
  };

  return (
    <div className={styles.container}>
      {summary?.is_demo && <DemoDataBanner />}

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>Toplam Oturum</span>
            <Activity size={14} color="var(--accent)" />
          </div>
          <div className={styles.kpiValue}>{summary?.total_active_sessions ?? 0}</div>
          <span className={styles.kpiSubText}>Aktif kullanıcı &amp; arka plan oturumları</span>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>Çalışan (Running)</span>
            <Cpu size={14} color="#10b981" />
          </div>
          <div className={`${styles.kpiValue} ${styles.kpiValueSuccess}`}>
            {summary?.running_sessions ?? 0}
          </div>
          <span className={styles.kpiSubText}>Aktif CPU/IO döngüsündeki sorgular</span>
        </div>

        <div className={`${styles.kpiCard} ${(summary?.blocked_sessions ?? 0) > 0 ? styles.kpiCardAlert : ''}`}>
          <div className={styles.kpiHeader}>
            <span>Kilitlenen (Blocked)</span>
            <AlertTriangle size={14} color="#f59e0b" />
          </div>
          <div className={`${styles.kpiValue} ${(summary?.blocked_sessions ?? 0) > 0 ? styles.kpiValueWarning : ''}`}>
            {summary?.blocked_sessions ?? 0}
          </div>
          <span className={styles.kpiSubText}>Kilit kuyruğunda bekletilen SPID'ler</span>
        </div>

        <div className={`${styles.kpiCard} ${(summary?.root_blockers_count ?? 0) > 0 ? styles.kpiCardAlert : ''}`}>
          <div className={styles.kpiHeader}>
            <span>Kök Bloklayıcılar</span>
            <ShieldAlert size={14} color="#ef4444" />
          </div>
          <div className={`${styles.kpiValue} ${(summary?.root_blockers_count ?? 0) > 0 ? styles.kpiValueAlert : ''}`}>
            {summary?.root_blockers_count ?? 0}
          </div>
          <span className={styles.kpiSubText}>Krizin ana kaynağı olan kilit açıcılar</span>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>TempDB Harcaması</span>
            <Layers size={14} color="#38bdf8" />
          </div>
          <div className={styles.kpiValue}>
            {summary?.total_tempdb_mb ? `${summary.total_tempdb_mb} MB` : '0 MB'}
          </div>
          <span className={styles.kpiSubText}>Kullanıcı geçici nesneleri &amp; dökülmeler</span>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>Bellek Hibesi (Grant)</span>
            <Clock size={14} color="#a855f7" />
          </div>
          <div className={styles.kpiValue}>
            {summary?.total_memory_grant_mb ? `${summary.total_memory_grant_mb} MB` : '0 MB'}
          </div>
          <span className={styles.kpiSubText}>Execution memory workspace tahsisleri</span>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.searchBox}>
            <Search size={13} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="SPID, Kullanıcı, SQL, Wait..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className={styles.filterSelect}
            value={selectedDb}
            onChange={(e) => setSelectedDb(e.target.value)}
          >
            <option value="ALL">Tüm Veritabanları</option>
            {databases.map((db) => (
              <option key={db} value={db}>
                {db}
              </option>
            ))}
          </select>

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              className={styles.checkboxInput}
              checked={onlyBlockers}
              onChange={(e) => setOnlyBlockers(e.target.checked)}
            />
            <span>Sadece Kilitlenen &amp; Bloklayanlar</span>
          </label>
        </div>

        <div className={styles.toolbarRight}>
          {/* Refresh Intervals */}
          <div className={styles.refreshGroup}>
            <span
              className={`${styles.pulseDot} ${refreshInterval === 0 ? styles.pulseDotPaused : ''}`}
              title={refreshInterval > 0 ? `Canlı İzleme Aktif (${refreshInterval} sn)` : 'İzleme Duraklatıldı'}
            />
            <button
              type="button"
              className={`${styles.refreshIntervalBtn} ${refreshInterval === 3 ? styles.refreshIntervalActive : ''}`}
              onClick={() => setRefreshInterval(3)}
            >
              3s
            </button>
            <button
              type="button"
              className={`${styles.refreshIntervalBtn} ${refreshInterval === 5 ? styles.refreshIntervalActive : ''}`}
              onClick={() => setRefreshInterval(5)}
            >
              5s
            </button>
            <button
              type="button"
              className={`${styles.refreshIntervalBtn} ${refreshInterval === 10 ? styles.refreshIntervalActive : ''}`}
              onClick={() => setRefreshInterval(10)}
            >
              10s
            </button>
            <button
              type="button"
              className={`${styles.refreshIntervalBtn} ${refreshInterval === 0 ? styles.refreshIntervalActive : ''}`}
              onClick={() => setRefreshInterval(0)}
              title="Otomatik yenilemeyi duraklat"
            >
              <Pause size={10} style={{ display: 'inline', marginRight: 2 }} /> Duraklat
            </button>
          </div>

          <button
            type="button"
            className={styles.manualRefreshBtn}
            onClick={() => loadData(false)}
            disabled={loading}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* Main Process Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableWrapper}>
          <table className={styles.sessionTable}>
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>SPID</th>
                <th>Durum</th>
                <th>Veritabanı</th>
                <th>Kullanıcı &amp; Host</th>
                <th>Uygulama</th>
                <th>Bekleme Türü (Wait)</th>
                <th>Geçen Süre</th>
                <th>CPU / I/O</th>
                <th>TempDB / RAM</th>
                <th>Aksiyonlar</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    Filtre kriterlerine uygun aktif oturum bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((s) => {
                  const isExpanded = expandedSpid === s.session_id;
                  const isRoot = s.is_root_blocker;
                  const isBlocked = s.blocking_session_id && s.blocking_session_id > 0;

                  return (
                    <React.Fragment key={s.session_id}>
                      <tr
                        className={`${styles.sessionRow} ${
                          isRoot ? styles.sessionRowRootBlocker : isBlocked ? styles.sessionRowBlocked : ''
                        }`}
                      >
                        {/* Expand toggle icon */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className={styles.expandBtn}
                            onClick={() => setExpandedSpid(isExpanded ? null : s.session_id)}
                            title={isExpanded ? 'Detayı Kapat' : 'SQL Metnini & Detayları Aç'}
                          >
                            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          </button>
                        </td>

                        {/* SPID & Blocker status */}
                        <td>
                          <div className={styles.spidBadge}>SPID #{s.session_id}</div>
                          {isRoot && (
                            <div className={styles.rootBlockerPill}>
                              <Flame size={10} /> KÖK BLOKLAYICI
                            </div>
                          )}
                          {isBlocked && (
                            <div className={styles.blockedPill}>
                              Kilit: #{s.blocking_session_id}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td>
                          <span
                            className={`${styles.statusPill} ${
                              s.status === 'running'
                                ? styles.statusRunning
                                : s.status === 'suspended'
                                ? styles.statusSuspended
                                : styles.statusSleeping
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>

                        {/* Database */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#f8fafc', fontWeight: 600 }}>
                            <Database size={12} color="var(--accent)" />
                            {s.db_name || 'master'}
                          </div>
                        </td>

                        {/* User & Host */}
                        <td>
                          <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{s.login_name || 'system'}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{s.host_name || 'localhost'}</div>
                        </td>

                        {/* Program */}
                        <td>
                          <span style={{ fontSize: 11, color: '#94a3b8' }} title={s.program_name || ''}>
                            {s.program_name ? (s.program_name.length > 25 ? `${s.program_name.slice(0, 25)}...` : s.program_name) : '-'}
                          </span>
                        </td>

                        {/* Wait info */}
                        <td>
                          {s.wait_type ? (
                            <div>
                              <span className={styles.waitTypePill} title={s.wait_type}>
                                {s.wait_type}
                              </span>
                              <div style={{ fontSize: 10.5, color: '#f59e0b', marginTop: 2 }}>
                                {s.wait_time_ms ? `${s.wait_time_ms} ms` : ''}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Kaynak serbest</span>
                          )}
                        </td>

                        {/* Elapsed time */}
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#f1f5f9' }}>
                            {formatElapsed(s.elapsed_time_ms)}
                          </span>
                        </td>

                        {/* CPU / Reads */}
                        <td>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                            CPU: <span style={{ color: '#38bdf8' }}>{s.cpu_time ?? 0} ms</span>
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-muted)' }}>
                            Reads: {s.logical_reads ? Number(s.logical_reads).toLocaleString() : 0}
                          </div>
                        </td>

                        {/* TempDB / RAM */}
                        <td>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                            TempDB: <span style={{ color: '#a855f7' }}>{s.tempdb_allocations_mb ?? 0} MB</span>
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-muted)' }}>
                            RAM: {s.memory_grant_mb ?? 0} MB
                          </div>
                        </td>

                        {/* Actions */}
                        <td>
                          <div className={styles.actionBtnGroup}>
                            <button
                              type="button"
                              className={styles.killBtn}
                              onClick={() => setKillModalSession(s)}
                              title="Güvenli KILL reçetesi oluştur ve incele"
                            >
                              <Terminal size={11} />
                              <span>KILL Reçetesi</span>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded SQL and Execution Context Details */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={11} style={{ padding: 0 }}>
                            <div className={styles.detailRow}>
                              <div className={styles.detailGrid}>
                                {/* Left: Running Statement */}
                                <div className={styles.detailSqlArea}>
                                  <div className={styles.detailSqlHeader}>
                                    <span>Aktif Çalışan T-SQL Komutu</span>
                                    <button
                                      type="button"
                                      className={styles.expandBtn}
                                      onClick={() => handleCopy(s.current_statement || s.sql_text || '')}
                                      title="Sorguyu panoya kopyala"
                                    >
                                      <Copy size={11} /> Kopyala
                                    </button>
                                  </div>
                                  <pre className={styles.sqlCodeBox}>
                                    {s.current_statement || s.sql_text || '-- SQL metni DMV tarafından yakalanamadı veya arka plan komutu.'}
                                  </pre>
                                </div>

                                {/* Right: Session Context Metadata */}
                                <div className={styles.detailMetaList}>
                                  <div className={styles.metaItem}>
                                    <span className={styles.metaLabel}>İzolasyon Seviyesi:</span>
                                    <span className={styles.metaVal}>{s.transaction_isolation_level || 'ReadCommitted'}</span>
                                  </div>
                                  <div className={styles.metaItem}>
                                    <span className={styles.metaLabel}>Açık Transaction:</span>
                                    <span className={styles.metaVal}>{s.open_transaction_count ?? 0}</span>
                                  </div>
                                  <div className={styles.metaItem}>
                                    <span className={styles.metaLabel}>Komut Türü:</span>
                                    <span className={styles.metaVal}>{s.command || 'SELECT'}</span>
                                  </div>
                                  <div className={styles.metaItem}>
                                    <span className={styles.metaLabel}>Başlangıç Zamanı:</span>
                                    <span className={styles.metaVal}>
                                      {s.last_request_start_time ? new Date(s.last_request_start_time).toLocaleTimeString() : '-'}
                                    </span>
                                  </div>
                                  {isRoot && (
                                    <div style={{ marginTop: 6, padding: '8px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: 4, color: '#fca5a5', fontSize: 11 }}>
                                      ⚠️ Bu oturum kök kilit bloklayıcıdır. Arkasındaki {s.blocked_session_count ?? 1} işlemi doğrudan durdurmaktadır.
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Safe Kill Recipe Modal */}
      {killModalSession && (
        <div className={styles.modalBackdrop} onClick={() => setKillModalSession(null)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleArea}>
                <ShieldAlert size={18} color="#ef4444" />
                <h3 className={styles.modalTitle}>
                  Acil Durum Müdahale Reçetesi — SPID #{killModalSession.session_id}
                </h3>
              </div>
              <button
                type="button"
                className={styles.closeModalBtn}
                onClick={() => setKillModalSession(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.warningBox}>
                <strong>⚠️ Güvenlik &amp; Read-Only Prensibi:</strong> Datapath hedef veritabanında asla otonom KILL çalıştırmaz. Bir oturumu sonlandırmadan önce transaction'ın rollback (geri alma) süresini <code>WITH STATUSONLY</code> ile doğrulayınız.
              </div>

              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                  1. Adım: Geri Alma (Rollback) Süresi &amp; Durum Kontrolü
                </span>
                <pre className={styles.sqlCodeBox} style={{ marginTop: 4 }}>
{`-- Oturumun transaction rollback ilerlemesini denetleyin:
KILL ${killModalSession.session_id} WITH STATUSONLY;
GO`}
                </pre>
              </div>

              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                  2. Adım: Kontrollü Sonlandırma Komutu (Emergency Kill)
                </span>
                <pre className={styles.sqlCodeBox} style={{ marginTop: 4 }}>
{`-- Oturum: ${killModalSession.login_name || 'User'} | DB: ${killModalSession.db_name || 'master'} | Geçen Süre: ${formatElapsed(killModalSession.elapsed_time_ms)}
KILL ${killModalSession.session_id};
GO`}
                </pre>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setKillModalSession(null)}
              >
                Kapat
              </button>

              <button
                type="button"
                className={styles.copyKillBtn}
                onClick={() =>
                  handleCopyKill(
                    `-- 1. Rollback Durumu:\nKILL ${killModalSession.session_id} WITH STATUSONLY;\nGO\n\n-- 2. Sonlandırma Komutu:\nKILL ${killModalSession.session_id};\nGO`
                  )
                }
              >
                {copiedKill ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedKill ? 'Kopyalandı!' : 'Reçeteyi Panoya Kopyala'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
