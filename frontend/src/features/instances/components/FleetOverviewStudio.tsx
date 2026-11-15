import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Activity,
  ShieldCheck,
  AlertTriangle,
  HardDrive,
  Cpu,
  RefreshCw,
  Search,
  CheckCircle2,
  Database,
  ArrowRight,
  ShieldAlert,
  Network,
  Radio,
} from 'lucide-react';
import styles from './FleetOverviewStudio.module.css';
import { getFleetOverview, activateServer } from '../../../lib/api';
import type {
  FleetOverviewResponse,
  FleetServerItem,
  EnvironmentType,
} from '../../../lib/types';

interface FleetOverviewStudioProps {
  onInspectServer?: (serverId: string) => void;
}

export default function FleetOverviewStudio({ onInspectServer }: FleetOverviewStudioProps) {
  const [fleetData, setFleetData] = useState<FleetOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEnv, setSelectedEnv] = useState<string>('ALL');
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getFleetOverview();
      setFleetData(data);
    } catch (err) {
      console.error('Failed to load fleet overview', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleActivate = async (serverId: string, serverName: string) => {
    setSwitchingId(serverId);
    try {
      await activateServer(serverId);
      setNotification(`Aktif sunucu başarıyla '${serverName}' olarak değiştirildi.`);
      setTimeout(() => setNotification(null), 4000);
      await loadData();
    } catch (err) {
      console.error('Failed to switch active server', err);
    } finally {
      setSwitchingId(null);
    }
  };

  const servers = fleetData?.servers || [];
  const summary = fleetData?.summary;

  // Filter servers
  const filteredServers = servers.filter((srv) => {
    const matchesSearch =
      srv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      srv.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
      srv.role.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesEnv =
      selectedEnv === 'ALL' || srv.environment === selectedEnv;

    return matchesSearch && matchesEnv;
  });

  return (
    <div className={styles.container}>
      {/* Header Row */}
      <div className={styles.headerRow}>
        <div className={styles.titleArea}>
          <h3>
            <Network size={18} /> Çoklu Sunucu Filo Panosu (Estate Overview)
          </h3>
          <p>
            Tüm SQL Server instance ve replikalarının canlı sağlık skoru, kaynak doygunluğu ve kriz durumu kıyaslaması.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.actionBtn}
            onClick={loadData}
            disabled={isLoading}
            title="Filo telemetrisini yenile"
          >
            <RefreshCw size={14} className={isLoading ? styles.spinning : ''} />
            {isLoading ? 'Yenileniyor...' : 'Filoyu Yenile'}
          </button>
        </div>
      </div>

      {/* Notification Toast if any */}
      {notification && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            padding: '0.65rem 1rem',
            borderRadius: '6px',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{notification}</span>
        </div>
      )}

      {/* Summary KPI Grid */}
      <div className={styles.summaryGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <Server size={13} /> İzlenen Instance Sayısı
          </div>
          <div className={styles.kpiValue}>
            {summary?.total_instances ?? 0}
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 400 }}>
              ({summary?.healthy_count ?? 0} stabil, {summary?.warning_count ?? 0} uyarı)
            </span>
          </div>
          <div className={styles.kpiSub}>Üretim, Replikalar ve Test Kümeleri</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <ShieldCheck size={13} color="#34d399" /> Filo Ortalama Sağlık Skoru
          </div>
          <div
            className={styles.kpiValue}
            style={{
              color:
                (summary?.average_health_score ?? 100) >= 85
                  ? '#34d399'
                  : (summary?.average_health_score ?? 100) >= 65
                  ? '#fbbf24'
                  : '#f87171',
            }}
          >
            {summary?.average_health_score?.toFixed(1) ?? '100'}
            <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 400 }}>
              / 100
            </span>
          </div>
          <div className={styles.kpiSub}>Tüm kümenin ağırlıklı sağlık endeksi</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <Cpu size={13} /> Ortalama CPU &amp; Bağlantı Yükü
          </div>
          <div className={styles.kpiValue}>
            %{summary?.average_cpu_pct?.toFixed(1) ?? '0'}
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 400 }}>
              ({summary?.total_active_connections ?? 0} oturum)
            </span>
          </div>
          <div className={styles.kpiSub}>Filo geneli işlemci tüketimi</div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>
            <AlertTriangle
              size={13}
              color={summary?.total_blocking_count ? '#ef4444' : '#10b981'}
            />
            Engellemeler &amp; Kritik Alarmlar
          </div>
          <div
            className={styles.kpiValue}
            style={{
              color:
                (summary?.total_blocking_count ?? 0) > 0 ||
                (summary?.total_critical_alerts ?? 0) > 0
                  ? '#f87171'
                  : '#34d399',
            }}
          >
            {summary?.total_blocking_count ?? 0}
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 400 }}>
              kilit, {summary?.total_critical_alerts ?? 0} kriz alarmı
            </span>
          </div>
          <div className={styles.kpiSub}>Derhal müdahale bekleyen durumlar</div>
        </div>
      </div>

      {/* Top Risks Banner */}
      {fleetData?.top_risks && fleetData.top_risks.length > 0 && (
        <div className={styles.risksBanner}>
          <div className={styles.riskContent}>
            <div className={styles.riskTitle}>
              <ShieldAlert size={16} /> Öne Çıkan Filo Tehditleri &amp; Risk Bildirimleri
            </div>
            <ul className={styles.riskList}>
              {fleetData.top_risks.map((risk, idx) => (
                <li key={idx}>{risk}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Fleet Comparison Table */}
      <div className={styles.tableContainer}>
        <div className={styles.tableToolbar}>
          <div className={styles.filterTabs}>
            <button
              className={`${styles.filterBtn} ${selectedEnv === 'ALL' ? styles.filterBtnActive : ''}`}
              onClick={() => setSelectedEnv('ALL')}
            >
              Tüm Ortamlar ({servers.length})
            </button>
            <button
              className={`${styles.filterBtn} ${selectedEnv === 'PRODUCTION' ? styles.filterBtnActive : ''}`}
              onClick={() => setSelectedEnv('PRODUCTION')}
            >
              Production
            </button>
            <button
              className={`${styles.filterBtn} ${selectedEnv === 'READ_ONLY_REPLICA' ? styles.filterBtnActive : ''}`}
              onClick={() => setSelectedEnv('READ_ONLY_REPLICA')}
            >
              Replikalar
            </button>
            <button
              className={`${styles.filterBtn} ${selectedEnv === 'STAGING' ? styles.filterBtnActive : ''}`}
              onClick={() => setSelectedEnv('STAGING')}
            >
              Staging
            </button>
            <button
              className={`${styles.filterBtn} ${selectedEnv === 'DEVELOPMENT' ? styles.filterBtnActive : ''}`}
              onClick={() => setSelectedEnv('DEVELOPMENT')}
            >
              Dev / Test
            </button>
            <button
              className={`${styles.filterBtn} ${selectedEnv === 'DISASTER_RECOVERY' ? styles.filterBtnActive : ''}`}
              onClick={() => setSelectedEnv('DISASTER_RECOVERY')}
            >
              DR Standby
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Search size={14} color="#64748b" />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Sunucu adı, host veya rol ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <table className={styles.fleetTable}>
          <thead>
            <tr>
              <th>Sunucu / Düğüm</th>
              <th>Ortam &amp; Rol</th>
              <th>Sağlık Skoru</th>
              <th>Durum</th>
              <th>CPU &amp; Bellek</th>
              <th>Boş Disk (%)</th>
              <th>Oturum / Kilit</th>
              <th>Yedekleme</th>
              <th style={{ textAlign: 'right' }}>Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            {filteredServers.length > 0 ? (
              filteredServers.map((srv: FleetServerItem) => {
                const isCurrentActive = srv.is_active;
                return (
                  <tr
                    key={srv.id}
                    className={isCurrentActive ? styles.activeServerRow : ''}
                  >
                    <td>
                      <div className={styles.serverCell}>
                        <div className={styles.serverHead}>
                          <span className={styles.serverName}>
                            <Server size={14} color={isCurrentActive ? '#3b82f6' : '#94a3b8'} />
                            {srv.name}
                          </span>
                          {isCurrentActive && (
                            <span className={styles.activeBadge}>AKTİF</span>
                          )}
                        </div>
                        <div className={styles.serverMeta}>
                          <span>{srv.host}:{srv.port}</span>
                          <span>•</span>
                          <span>{srv.sql_version.split(' ')[2] || '2022'}</span>
                          <span>•</span>
                          <span>{srv.latency_ms.toFixed(1)} ms</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span className={`${styles.badge} ${styles.badgeEnv}`}>
                          {srv.environment}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                          {srv.role}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div
                        className={`${styles.scoreCircle} ${
                          srv.health_score >= 85
                            ? styles.scoreHigh
                            : srv.health_score >= 65
                            ? styles.scoreMed
                            : styles.scoreLow
                        }`}
                      >
                        {srv.health_score}
                      </div>
                    </td>

                    <td>
                      <span
                        className={`${styles.badge} ${
                          srv.status === 'HEALTHY'
                            ? styles.badgeHealthy
                            : srv.status === 'WARNING'
                            ? styles.badgeWarning
                            : styles.badgeCritical
                        }`}
                      >
                        {srv.status === 'HEALTHY'
                          ? 'STABİL'
                          : srv.status === 'WARNING'
                          ? 'UYARI'
                          : 'KRİTİK'}
                      </span>
                    </td>

                    <td>
                      <div className={styles.metricDual}>
                        <div className={styles.metricBarRow}>
                          <span>CPU</span>
                          <span style={{ fontWeight: 600, color: srv.cpu_pct > 80 ? '#f87171' : '#cbd5e1' }}>
                            %{srv.cpu_pct.toFixed(1)}
                          </span>
                        </div>
                        <div className={styles.metricBarTrack}>
                          <div
                            className={styles.metricBarFill}
                            style={{
                              width: `${Math.min(srv.cpu_pct, 100)}%`,
                              background: srv.cpu_pct > 80 ? '#ef4444' : '#3b82f6',
                            }}
                          />
                        </div>

                        <div className={styles.metricBarRow} style={{ marginTop: 2 }}>
                          <span>RAM</span>
                          <span>%{srv.memory_pct.toFixed(0)}</span>
                        </div>
                        <div className={styles.metricBarTrack}>
                          <div
                            className={styles.metricBarFill}
                            style={{
                              width: `${Math.min(srv.memory_pct, 100)}%`,
                              background: srv.memory_pct > 85 ? '#f59e0b' : '#10b981',
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        style={{
                          fontWeight: 600,
                          color: srv.disk_free_min_pct < 20 ? '#f87171' : '#34d399',
                        }}
                      >
                        %{srv.disk_free_min_pct.toFixed(1)}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ color: '#f1f5f9' }}>{srv.active_connections} oturum</span>
                        {srv.blocking_sessions_count > 0 ? (
                          <span style={{ color: '#f87171', fontSize: '0.72rem', fontWeight: 600 }}>
                            {srv.blocking_sessions_count} bloklandı!
                          </span>
                        ) : (
                          <span style={{ color: '#64748b', fontSize: '0.72rem' }}>0 kilit</span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span
                        className={`${styles.badge} ${
                          srv.backup_health === 'OPTIMAL'
                            ? styles.badgeHealthy
                            : styles.badgeWarning
                        }`}
                      >
                        {srv.backup_health === 'OPTIMAL' ? 'GÜNCEL' : 'RİSKLİ'}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div className={styles.rowActions} style={{ justifyContent: 'flex-end' }}>
                        {isCurrentActive ? (
                          <button
                            className={`${styles.switchBtn} ${styles.switchBtnActive}`}
                            disabled
                          >
                            <CheckCircle2 size={12} /> Aktif
                          </button>
                        ) : (
                          <button
                            className={styles.switchBtn}
                            onClick={() => handleActivate(srv.id, srv.name)}
                            disabled={switchingId === srv.id}
                            title="Platformun odak instance'ını bu sunucuya geçir"
                          >
                            <Radio size={12} />
                            {switchingId === srv.id ? 'Geçiliyor...' : 'Aktif Yap'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  Arama kriterlerine uygun sunucu bulunamadı.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
