import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  Server,
  Database,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  HardDrive,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  Clock,
  Search,
  Layers,
  Zap,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import {
  getInstanceMetadata,
  getDatabases,
  getSessions,
  getBlocking,
  getRecoveryReadiness,
} from '../../lib/api';
import type {
  InstanceMetadata,
  Database as DbType,
  Session,
  BlockingResult,
  RecoveryReadiness,
} from '../../lib/types';
import styles from './DashboardPage.module.css';

type DbFilterType = 'all' | 'user' | 'system';

export default function DashboardPage() {
  const navigate = useNavigate();

  // Real data state
  const [metadata, setMetadata] = useState<InstanceMetadata | null>(null);
  const [databases, setDatabases] = useState<DbType[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [blocking, setBlocking] = useState<BlockingResult | null>(null);
  const [readiness, setReadiness] = useState<RecoveryReadiness[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Interactive table controls
  const [dbFilter, setDbFilter] = useState<DbFilterType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0);

  const loadAllData = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      const [metaRes, dbRes, sessRes, blockRes, readyRes] = await Promise.allSettled([
        getInstanceMetadata(),
        getDatabases(),
        getSessions({ active_only: false }),
        getBlocking(),
        getRecoveryReadiness(),
      ]);

      if (metaRes.status === 'fulfilled') setMetadata(metaRes.value);
      if (dbRes.status === 'fulfilled') setDatabases(dbRes.value || []);
      if (sessRes.status === 'fulfilled') setSessions(sessRes.value || []);
      if (blockRes.status === 'fulfilled') setBlocking(blockRes.value);
      if (readyRes.status === 'fulfilled') setReadiness(readyRes.value || []);

      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Auto-refresh timer
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const interval = setInterval(() => {
      loadAllData(true);
    }, autoRefreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshInterval]);

  // Compute metrics from REAL data
  const isDemo = metadata?.server_name?.includes('(Demo)') ?? false;
  const activeSessionsCount = sessions.filter((s) => s.status === 'running').length;
  const totalSessionsCount = sessions.length;
  const blockedCount = blocking?.chains
    ? blocking.chains.reduce((acc, c) => acc + (c.blocked_sessions?.length || 0), 0)
    : (blocking?.has_blocking ? 1 : 0);
  const totalDatabasesCount = databases.length;
  const totalSizeMb = databases.reduce((sum, d) => sum + (d.size_mb || 0), 0);
  const totalLogSizeMb = databases.reduce((sum, d) => sum + (d.log_size_mb || 0), 0);
  const maxDbSize = Math.max(...databases.map((d) => d.size_mb || 0), 1);

  const systemDbNames = ['master', 'model', 'msdb', 'tempdb'];

  const userDatabases = useMemo(
    () => databases.filter((d) => !systemDbNames.includes(d.name.toLowerCase())),
    [databases]
  );
  const systemDatabases = useMemo(
    () => databases.filter((d) => systemDbNames.includes(d.name.toLowerCase())),
    [databases]
  );

  // Filtered & searched databases
  const filteredDatabases = useMemo(() => {
    let list = databases;
    if (dbFilter === 'user') list = userDatabases;
    else if (dbFilter === 'system') list = systemDatabases;

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.recovery_model && d.recovery_model.toLowerCase().includes(q))
    );
  }, [databases, userDatabases, systemDatabases, dbFilter, searchQuery]);

  // Critical backup risks
  const criticalBackups = readiness.filter(
    (r) => r.recovery_point_objective_risk === 'critical' || r.recovery_point_objective_risk === 'high'
  );

  // Chart data: Database Sizes
  const dbSizeChartData = useMemo(() => {
    return databases.map((d) => ({
      name: d.name,
      veriMb: Math.round(d.size_mb || 0),
      logMb: Math.round(d.log_size_mb || 0),
    }));
  }, [databases]);

  // Chart data: Session status breakdown
  const sessionStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    sessions.forEach((s) => {
      const st = s.status || 'unknown';
      counts[st] = (counts[st] || 0) + 1;
    });

    const colors: Record<string, string> = {
      running: '#10b981',
      sleeping: '#38bdf8',
      suspended: '#f59e0b',
      rollback: '#f43f5e',
      unknown: '#64748b',
    };

    const labels: Record<string, string> = {
      running: 'Çalışıyor (Running)',
      sleeping: 'Uyku (Sleeping)',
      suspended: 'Askıda (Suspended)',
      rollback: 'Geri Alma',
      unknown: 'Bilinmeyen',
    };

    return Object.entries(counts).map(([k, v]) => ({
      name: labels[k] || k,
      value: v,
      color: colors[k] || '#64748b',
    }));
  }, [sessions]);

  if (loading && !metadata) {
    return (
      <div className={styles.loadingContainer}>
        <span className={styles.loadingText}>SQL Server DMV verileri sorgulanıyor...</span>
      </div>
    );
  }

  return (
    <div className={styles.dashboardContainer}>
      {/* 1. Clean Top Status Strip */}
      <div className={styles.topBarStrip}>
        <div className={styles.serverInfoGroup}>
          <div className={styles.serverIconBox}>
            <Server size={16} />
          </div>

          <div className={styles.serverMetaRow}>
            <span className={styles.serverName}>{metadata?.server_name ?? 'SQL Server'}</span>
            <span
              className={`${styles.statusBadge} ${
                isDemo ? styles.statusBadgeDemo : styles.statusBadgeLive
              }`}
            >
              <span className={styles.statusDot} />
              {isDemo ? 'Demo Modu' : 'Canlı'}
            </span>
            <span className={styles.editionText}>
              {metadata?.edition?.replace(' Edition', '') || 'SQL Server'}
            </span>
            <span className={styles.sep}>|</span>
            <span className={styles.hardwareText}>
              <Cpu size={12} className={styles.miniIcon} />
              {metadata?.cpu_count ?? 0} CPU
            </span>
            <span className={styles.hardwareText}>
              <HardDrive size={12} className={styles.miniIcon} />
              {metadata?.memory_gb ? `${metadata.memory_gb.toFixed(1)} GB RAM` : 'N/A'}
            </span>
            <span className={styles.hardwareText}>
              <Clock size={12} className={styles.miniIcon} />
              Agent:{' '}
              <strong
                className={
                  metadata?.sql_agent_running ? styles.agentGreen : styles.agentRed
                }
              >
                {metadata?.sql_agent_running === true
                  ? 'Çalışıyor'
                  : metadata?.sql_agent_running === false
                  ? 'Durduruldu'
                  : 'Bilinmiyor'}
              </strong>
            </span>
          </div>
        </div>

        {/* Right: Refresh Controls */}
        <div className={styles.refreshControlGroup}>
          <span className={styles.refreshLabel}>Oto Yenile:</span>
          <select
            className={styles.refreshSelect}
            value={autoRefreshInterval}
            onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
          >
            <option value={0}>Kapalı</option>
            <option value={15}>15 sn</option>
            <option value={30}>30 sn</option>
            <option value={60}>60 sn</option>
          </select>

          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => loadAllData(true)}
            disabled={refreshing}
            title="DMV verilerini güncelle"
          >
            <RefreshCw size={12} />
            <span>{refreshing ? 'Güncelleniyor...' : 'Yenile'}</span>
          </button>

          <span className={styles.lastSyncText}>
            {lastRefreshed.toLocaleTimeString('tr-TR')}
          </span>
        </div>
      </div>

      {/* 2. Alert Banners (Data-Driven) */}
      {criticalBackups.length > 0 && (
        <div className={styles.alertBanner}>
          <div className={styles.alertLeft}>
            <ShieldAlert size={15} className={styles.alertIconCritical} />
            <span>
              <strong>Yedekleme Uyarısı:</strong> {criticalBackups.length} veritabanında RPO riski veya eksik tam yedek mevcut ({criticalBackups.map((c) => c.database_name).join(', ')}).
            </span>
          </div>
          <button
            type="button"
            className={styles.alertBtn}
            onClick={() => navigate('/backups')}
          >
            <span>Yedekleme Durumu</span>
            <ArrowRight size={12} />
          </button>
        </div>
      )}

      {blockedCount > 0 && (
        <div className={`${styles.alertBanner} ${styles.alertBannerWarning}`}>
          <div className={styles.alertLeft}>
            <AlertTriangle size={15} className={styles.alertIconWarning} />
            <span>
              <strong>Engelleme (Blocking) Uyarısı:</strong> Sunucuda şu an {blockedCount} oturum bir kilit kaynağı bekliyor.
            </span>
          </div>
          <button
            type="button"
            className={styles.alertBtn}
            onClick={() => navigate('/incidents')}
          >
            <span>Olay Merkezi</span>
            <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* 3. Executive KPI Cards Grid */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Aktif Oturumlar</span>
            <Activity size={15} className={styles.kpiIconAccent} />
          </div>
          <div className={styles.kpiValue}>{activeSessionsCount}</div>
          <div className={styles.kpiSub}>
            Toplam <strong>{totalSessionsCount}</strong> oturum içinden
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Engellenen Oturumlar</span>
            {blockedCount > 0 ? (
              <AlertTriangle size={15} className={styles.kpiIconCritical} />
            ) : (
              <CheckCircle2 size={15} className={styles.kpiIconSuccess} />
            )}
          </div>
          <div
            className={`${styles.kpiValue} ${
              blockedCount > 0 ? styles.kpiValCritical : styles.kpiValSuccess
            }`}
          >
            {blockedCount}
          </div>
          <div className={styles.kpiSub}>
            {blockedCount === 0 ? 'Kilitlenme yok, serbest akış' : 'Bekleyen işlem var'}
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Veritabanları</span>
            <Database size={15} className={styles.kpiIconAccent} />
          </div>
          <div className={styles.kpiValue}>{totalDatabasesCount}</div>
          <div className={styles.kpiSub}>
            Toplam <strong>{(totalSizeMb / 1024).toFixed(2)} GB</strong> Veri,{' '}
            <strong>{(totalLogSizeMb / 1024).toFixed(2)} GB</strong> Log
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Yedekleme Sağlığı</span>
            {criticalBackups.length > 0 ? (
              <ShieldAlert size={15} className={styles.kpiIconWarning} />
            ) : (
              <CheckCircle2 size={15} className={styles.kpiIconSuccess} />
            )}
          </div>
          <div
            className={`${styles.kpiValue} ${
              criticalBackups.length === 0 ? styles.kpiValSuccess : styles.kpiValWarning
            }`}
          >
            {criticalBackups.length === 0 ? 'Sağlıklı' : `${criticalBackups.length} Riskli`}
          </div>
          <div className={styles.kpiSub}>
            <strong>{readiness.length}</strong> veritabanı denetlendi
          </div>
        </div>
      </div>

      {/* 4. Visual Charts Grid (Equal 2 Columns) */}
      <div className={styles.chartsRow}>
        {/* Chart 1: Database Sizes */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleRow}>
              <Layers size={14} className={styles.sectionIcon} />
              <span className={styles.sectionTitle}>Veritabanı Dosya Boyutları</span>
            </div>
            <span className={styles.sectionBadge}>MDF & LDF</span>
          </div>

          <div className={styles.chartWrapper}>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart
                data={dbSizeChartData}
                margin={{ top: 10, right: 10, left: -15, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickFormatter={(val) => `${val}M`}
                />
                <Tooltip
                  contentStyle={{
                    background: '#161b22',
                    border: '1px solid #30363d',
                    borderRadius: '4px',
                    color: '#f1f5f9',
                    fontSize: '12px',
                  }}
                  formatter={(val: number) => [`${val.toLocaleString()} MB`]}
                />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8', paddingTop: '6px' }} />
                <Bar dataKey="veriMb" name="Veri Dosyası (MDF)" fill="#38bdf8" />
                <Bar dataKey="logMb" name="Log Dosyası (LDF)" fill="#0d9488" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Session Distribution + Quick Actions */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleRow}>
              <Activity size={14} className={styles.sectionIcon} />
              <span className={styles.sectionTitle}>Oturum Durum Dağılımı</span>
            </div>
            <span className={styles.sectionBadge}>{sessions.length} Oturum</span>
          </div>

          <div className={styles.chartWrapper}>
            {sessionStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={sessionStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={68}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {sessionStatusData.map((entry, index) => (
                      <Cell key={`status-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#161b22',
                      border: '1px solid #30363d',
                      borderRadius: '4px',
                      color: '#f1f5f9',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className={styles.noData}>Bağlı oturum bulunamadı.</div>
            )}
          </div>

          {/* Quick Action Navigation Bar */}
          <div className={styles.quickActionsStrip}>
            <button
              type="button"
              className={styles.quickBtn}
              onClick={() => navigate('/incidents')}
            >
              <AlertTriangle size={13} />
              <span>Olay Merkezi</span>
            </button>
            <button
              type="button"
              className={styles.quickBtn}
              onClick={() => navigate('/query-performance')}
            >
              <TrendingUp size={13} />
              <span>Sorgu Analizi</span>
            </button>
            <button
              type="button"
              className={styles.quickBtn}
              onClick={() => navigate('/backups')}
            >
              <Database size={13} />
              <span>Yedekleme</span>
            </button>
            <button
              type="button"
              className={styles.quickBtn}
              onClick={() => navigate('/toolkit')}
            >
              <Wrench size={13} />
              <span>DBA Araç Seti</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5. Full-Width Database Registry Table */}
      <div className={styles.sectionCard}>
        <div className={styles.tableControlsRow}>
          <div className={styles.filterTabs}>
            <button
              type="button"
              className={`${styles.tabBtn} ${dbFilter === 'all' ? styles.tabBtnActive : ''}`}
              onClick={() => setDbFilter('all')}
            >
              Tümü ({databases.length})
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${dbFilter === 'user' ? styles.tabBtnActive : ''}`}
              onClick={() => setDbFilter('user')}
            >
              Kullanıcı ({userDatabases.length})
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${dbFilter === 'system' ? styles.tabBtnActive : ''}`}
              onClick={() => setDbFilter('system')}
            >
              Sistem ({systemDatabases.length})
            </button>
          </div>

          <div className={styles.searchBox}>
            <Search size={13} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Veritabanı ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>VERİTABANI ADI</th>
                <th>DURUM</th>
                <th>KURTARMA MODELİ</th>
                <th>UYUMLULUK</th>
                <th>VERİ BOYUTU (MDF)</th>
                <th>LOG BOYUTU (LDF)</th>
                <th>ERİŞİM</th>
                <th style={{ textAlign: 'right' }}>İŞLEM</th>
              </tr>
            </thead>
            <tbody>
              {filteredDatabases.length > 0 ? (
                filteredDatabases.map((db) => {
                  const sizePct = Math.min(
                    100,
                    Math.round(((db.size_mb || 0) / maxDbSize) * 100)
                  );
                  const isSystem = systemDbNames.includes(db.name.toLowerCase());

                  return (
                    <tr key={db.name} className={styles.tableRow}>
                      <td className={styles.dbNameCol}>
                        <Database size={13} className={styles.dbIcon} />
                        <span className={styles.dbNameText}>{db.name}</span>
                        {isSystem && <span className={styles.systemPill}>Sistem</span>}
                      </td>
                      <td>
                        <span
                          className={`${styles.statusPill} ${
                            db.state === 'ONLINE' ? styles.pillOnline : styles.pillOther
                          }`}
                        >
                          <span className={styles.solidDot} />
                          {db.state || 'ONLINE'}
                        </span>
                      </td>
                      <td>
                        <span className={styles.recoveryTag}>
                          {db.recovery_model || 'FULL'}
                        </span>
                      </td>
                      <td className={styles.monoCell}>{db.compatibility_level ?? 160}</td>
                      <td className={styles.monoCell}>
                        <div className={styles.sizeCell}>
                          <span>
                            {db.size_mb
                              ? db.size_mb > 1024
                                ? `${(db.size_mb / 1024).toFixed(2)} GB`
                                : `${db.size_mb.toFixed(1)} MB`
                              : '—'}
                          </span>
                          <div className={styles.sizeBar}>
                            <div
                              className={styles.sizeBarFill}
                              style={{ width: `${Math.max(4, sizePct)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className={styles.monoCell}>
                        {db.log_size_mb
                          ? db.log_size_mb > 1024
                            ? `${(db.log_size_mb / 1024).toFixed(2)} GB`
                            : `${db.log_size_mb.toFixed(1)} MB`
                          : '—'}
                      </td>
                      <td>
                        {db.is_read_only ? (
                          <span className={styles.tagReadOnly}>Salt Okunur</span>
                        ) : (
                          <span className={styles.tagReadWrite}>Yazılabilir</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className={styles.actionBtns}>
                          <button
                            type="button"
                            className={styles.rowActionBtn}
                            onClick={() => navigate('/query-performance')}
                            title="Sorguları İncele"
                          >
                            Sorgular →
                          </button>
                          <button
                            type="button"
                            className={styles.rowActionBtn}
                            onClick={() => navigate('/backups')}
                            title="Yedek Geçmişi"
                          >
                            Yedekler →
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className={styles.emptyCell}>
                    "{searchQuery}" aramasıyla eşleşen veritabanı bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
