import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Activity,
  Users,
  Server,
  AlertTriangle,
  Clock,
  Terminal,
  Copy,
  Check,
  RefreshCw,
  Search,
  Filter,
  X,
  Code2,
  Lock,
  Flame,
  Zap,
} from 'lucide-react';
import {
  getConnectionPoolSummary,
  getKillSessionScript,
} from '../../../lib/api';
import type {
  ConnectionPoolSummary,
  SleepingTransactionItem,
  ClientConnectionGroup,
  KillSessionResponse,
} from '../../../lib/types';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorState from '../../../components/ui/ErrorState';
import StatusBadge from '../../../components/ui/StatusBadge';
import DemoDataBanner from '../../../components/ui/DemoDataBanner';
import styles from './ConnectionSentinel.module.css';

interface ConnectionSentinelProps {
  database?: string;
}

export default function ConnectionSentinel({ database }: ConnectionSentinelProps) {
  const [data, setData] = useState<ConnectionPoolSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'CRITICAL' | 'WARNING'>('ALL');

  // Modal state
  const [selectedSpid, setSelectedSpid] = useState<number | null>(null);
  const [killScriptData, setKillScriptData] = useState<KillSessionResponse | null>(null);
  const [loadingKillScript, setLoadingKillScript] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getConnectionPoolSummary(database);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Bağlantı havuzu ve zombie transaction verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [database]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenKillModal = async (spid: number) => {
    setSelectedSpid(spid);
    setLoadingKillScript(true);
    setCopied(false);
    try {
      const res = await getKillSessionScript(spid);
      setKillScriptData(res);
    } catch (err: any) {
      console.error('Kill betiği alınamadı:', err);
    } finally {
      setLoadingKillScript(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatSeconds = (sec: number) => {
    if (sec < 60) return `${sec} sn`;
    const min = Math.floor(sec / 60);
    const remainSec = sec % 60;
    if (min < 60) return `${min} dk ${remainSec} sn`;
    const hr = Math.floor(min / 60);
    return `${hr} sa ${min % 60} dk`;
  };

  // Filter sleeping transactions
  const filteredSleeping = (data?.sleeping_transactions || []).filter((item) => {
    if (filterSeverity === 'CRITICAL' && item.severity !== 'CRITICAL') return false;
    if (filterSeverity === 'WARNING' && item.severity !== 'WARNING') return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchSpid = String(item.session_id).includes(q);
      const matchApp = (item.program_name || '').toLowerCase().includes(q);
      const matchHost = (item.host_name || '').toLowerCase().includes(q);
      const matchLogin = item.login_name.toLowerCase().includes(q);
      const matchSql = (item.last_sql_text || '').toLowerCase().includes(q);
      return matchSpid || matchApp || matchHost || matchLogin || matchSql;
    }
    return true;
  });

  if (loading && !data) {
    return <LoadingSpinner message="SQL Server bağlantı havuzları ve transaction durumları taranıyor..." />;
  }

  if (error && !data) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  return (
    <div className={styles.container}>
      {data?.is_demo && <DemoDataBanner />}

      {/* Header Row */}
      <div className={styles.headerRow}>
        <div className={styles.titleArea}>
          <h3>
            <ShieldAlert size={18} color="#38bdf8" />
            Bağlantı Havuzu & Uyuyan İşlem Nöbetçisi (Connection Sentinel)
          </h3>
          <p>
            Mikroservis bağlantı havuzlarını izler; açık işlemle uyuyarak kilit blokajı yaratan (Zombie Transactions) oturumları yakalar.
          </p>
        </div>
        <button className={styles.actionBtn} onClick={fetchData} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Canlı Yenile
        </button>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>Toplam Bağlantı</span>
            <Users size={16} />
          </div>
          <div className={styles.kpiValue}>{data?.total_connections ?? 0}</div>
          <div className={styles.kpiSubtext}>
            {data?.active_sessions ?? 0} aktif / {data?.sleeping_sessions ?? 0} uyuyan
          </div>
        </div>

        <div className={styles.kpiCard} style={{ borderColor: (data?.orphaned_sleeping_transactions_count ?? 0) > 0 ? '#ef4444' : undefined }}>
          <div className={styles.kpiHeader}>
            <span style={{ color: (data?.orphaned_sleeping_transactions_count ?? 0) > 0 ? '#ef4444' : undefined }}>
              Uyuyan Açık İşlemler (Zombie)
            </span>
            <AlertTriangle size={16} color={(data?.orphaned_sleeping_transactions_count ?? 0) > 0 ? '#ef4444' : undefined} />
          </div>
          <div className={styles.kpiValue} style={{ color: (data?.orphaned_sleeping_transactions_count ?? 0) > 0 ? '#ef4444' : undefined }}>
            {data?.orphaned_sleeping_transactions_count ?? 0}
          </div>
          <div className={styles.kpiSubtext}>open_tran_count &gt; 0 olan uyuyan SPID'ler</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>Worker Threads</span>
            <Activity size={16} />
          </div>
          <div className={styles.kpiValue}>
            {data?.current_worker_threads_used ?? 0} <span style={{ fontSize: '1rem', color: '#94a3b8' }}>/ {data?.max_worker_threads ?? 512}</span>
          </div>
          <div className={styles.kpiSubtext}>
            %{Math.round(((data?.current_worker_threads_used ?? 0) / Math.max(data?.max_worker_threads ?? 512, 1)) * 100)} thread doluluğu
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span>En Büyük Havuz Payı</span>
            <Server size={16} />
          </div>
          <div className={styles.kpiValue} style={{ fontSize: '1.25rem' }}>
            {data?.top_client_groups?.[0]?.program_name ? (
              data.top_client_groups[0].program_name.split(' ')[0]
            ) : '—'}
          </div>
          <div className={styles.kpiSubtext}>
            {data?.top_client_groups?.[0] ? `${data.top_client_groups[0].total_connections} bağlantı (%${data.top_client_groups[0].pool_utilization_pct})` : '—'}
          </div>
        </div>
      </div>

      {/* Diagnostic Verdict */}
      {data?.diagnostic_verdict && (
        <div
          className={`${styles.verdictBox} ${
            (data.orphaned_sleeping_transactions_count ?? 0) > 0 ? styles.verdictCritical : styles.verdictWarning
          }`}
        >
          {(data.orphaned_sleeping_transactions_count ?? 0) > 0 ? (
            <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
          ) : (
            <Activity size={18} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
          )}
          <div className={styles.verdictText}>{data.diagnostic_verdict}</div>
        </div>
      )}

      {/* SECTION 1: Sleeping Zombie Transactions Table */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <Lock size={16} color="#ef4444" />
            Açık İşlemle Boşta Uyuyan Oturumlar (Orphaned / Zombie Transactions)
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '10px',
                background: (data?.orphaned_sleeping_transactions_count ?? 0) > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                color: (data?.orphaned_sleeping_transactions_count ?? 0) > 0 ? '#ef4444' : '#38bdf8',
                fontWeight: 700,
              }}
            >
              {data?.sleeping_transactions?.length ?? 0}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="SPID, uygulama veya SQL filtrele..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '4px 8px 4px 26px',
                  borderRadius: '4px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  color: '#f8fafc',
                  fontSize: '12px',
                  width: '200px',
                }}
              />
              <Search size={12} style={{ position: 'absolute', left: '8px', top: '8px', color: '#94a3b8' }} />
            </div>

            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value as any)}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                color: '#f8fafc',
                fontSize: '12px',
              }}
            >
              <option value="ALL">Tüm Seviyeler</option>
              <option value="CRITICAL">Sadece Kritik</option>
              <option value="WARNING">Sadece Uyarı</option>
            </select>
          </div>
        </div>

        {filteredSleeping.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
            Açık işlemle uyuyan (zombie) hiçbir oturum bulunmamaktadır. Sistem kilit ve transaction sağlığı mükemmel durumdadır.
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>SPID</th>
                  <th>Uygulama / İstemci</th>
                  <th>Boşta Süre</th>
                  <th>Açık İşlem</th>
                  <th>İzolasyon</th>
                  <th>Log Alanı</th>
                  <th>Bloklananlar</th>
                  <th>Son Yürütülen SQL</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filteredSleeping.map((st) => (
                  <tr key={st.session_id}>
                    <td>
                      <span style={{ fontWeight: 700, color: '#38bdf8' }}>#{st.session_id}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{st.program_name || 'Bilinmeyen Uygulama'}</div>
                      <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>
                        {st.login_name} @ {st.host_name || st.client_ip || 'Local'}
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: 600,
                          color: st.idle_duration_sec > 300 ? '#ef4444' : '#f59e0b',
                        }}
                      >
                        {formatSeconds(st.idle_duration_sec)}
                      </span>
                    </td>
                    <td>
                      <StatusBadge
                        variant={st.open_tran_count > 1 ? 'danger' : 'warning'}
                        label={`${st.open_tran_count} Açık Tran`}
                      />
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{st.transaction_isolation_level}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem' }}>{st.log_bytes_used_mb} MB</span>
                    </td>
                    <td>
                      {st.blocked_sessions_count > 0 ? (
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: '#ef4444',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                          }}
                        >
                          {st.blocked_sessions_count} Oturum
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>0</span>
                      )}
                    </td>
                    <td style={{ maxWidth: '280px' }}>
                      <div
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          color: '#cbd5e1',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={st.last_sql_text || ''}
                      >
                        {st.last_sql_text || '—'}
                      </div>
                    </td>
                    <td>
                      <button
                        className={styles.actionBtn}
                        onClick={() => handleOpenKillModal(st.session_id)}
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.75rem',
                          background: 'rgba(239, 68, 68, 0.1)',
                          borderColor: 'rgba(239, 68, 68, 0.3)',
                          color: '#ef4444',
                        }}
                      >
                        İncele & Sonlandır
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 2: Client Connection Groups (Connection Pools) */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <Users size={16} color="#38bdf8" />
            İstemci Bağlantı Havuzu Dağılımı (Connection Pools Breakdown)
          </div>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Toplam {data?.top_client_groups?.length ?? 0} aktif istemci grubu
          </span>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Uygulama / Sürücü</th>
                <th>İstemci Host / IP</th>
                <th>Kullanıcı (Login)</th>
                <th>Aktif</th>
                <th>Uyuyan</th>
                <th>Toplam</th>
                <th>Havuz Payı</th>
              </tr>
            </thead>
            <tbody>
              {(data?.top_client_groups || []).map((grp, idx) => (
                <tr key={idx}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#f8fafc' }}>{grp.program_name}</div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.775rem', color: '#cbd5e1' }}>
                      {grp.host_name} ({grp.client_ip})
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.775rem', color: '#94a3b8' }}>{grp.login_name}</span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: '#22c55e' }}>{grp.active_connections}</span>
                  </td>
                  <td>
                    <span style={{ color: '#94a3b8' }}>{grp.sleeping_connections}</span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: '#f8fafc' }}>{grp.total_connections}</span>
                  </td>
                  <td>
                    <div className={styles.poolBarContainer}>
                      <div className={styles.poolBarTrack}>
                        <div
                          className={styles.poolBarFill}
                          style={{ width: `${Math.min(grp.pool_utilization_pct, 100)}%` }}
                        />
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', minWidth: '35px' }}>
                        %{grp.pool_utilization_pct}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Safe Kill & Investigation Modal */}
      {selectedSpid !== null && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedSpid(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h4>
                <Terminal size={18} color="#ef4444" />
                SPID #{selectedSpid} Güvenli İnceleme ve Sonlandırma Reçetesi
              </h4>
              <button className={styles.closeBtn} onClick={() => setSelectedSpid(null)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  fontSize: '0.8rem',
                  color: '#f87171',
                  lineHeight: '1.4',
                }}
              >
                <strong>DBA Güvenlik Politikası:</strong> Otomatik yıkıcı işlem yapılmaz. KILL komutu çalıştırıldığında bu oturumun tamamlanmamış açık transaction'ı otomatik olarak ROLLBACK edilecek ve tuttuğu tüm Exclusive kilitler serbest bırakılacaktır. Aşağıdaki betiği SSMS veya acil durum konsolunda gözden geçirerek çalıştırabilirsiniz.
              </div>

              {loadingKillScript ? (
                <LoadingSpinner message="Kilit ve sonlandırma reçetesi üretiliyor..." />
              ) : killScriptData ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>
                      Önerilen T-SQL Adımları:
                    </span>
                    <button
                      className={styles.actionBtn}
                      onClick={() => handleCopy(killScriptData.investigation_sql)}
                      style={{ padding: '3px 8px', fontSize: '0.75rem', color: copied ? '#22c55e' : '#38bdf8' }}
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? 'Kopyalandı!' : 'Betiği Kopyala'}
                    </button>
                  </div>

                  <div className={styles.codeArea}>
                    {killScriptData.investigation_sql}
                  </div>
                </div>
              ) : (
                <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>Betiğe ulaşılamadı.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
