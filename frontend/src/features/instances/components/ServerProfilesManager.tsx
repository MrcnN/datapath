import React, { useState, useEffect } from 'react';
import {
  Server,
  Plus,
  RefreshCw,
  CheckCircle2,
  Activity,
  Trash2,
  Cpu,
  Layers,
  Shield,
  Zap,
  Globe,
  Radio,
  XCircle,
} from 'lucide-react';
import {
  getServerProfiles,
  activateServer,
  addServerProfile,
  pingServerProfile,
  deleteServerProfile,
} from '../../../lib/api';
import type {
  ServerProfile,
  ServerProfileCreate,
  EnvironmentType,
  ServerPingResponse,
} from '../../../lib/types';
import styles from './ServerProfilesManager.module.css';

const envLabels: Record<EnvironmentType, { label: string; className: string }> = {
  PRODUCTION: { label: 'PROD', className: styles.envProd },
  READ_ONLY_REPLICA: { label: 'REPLICA', className: styles.envReplica },
  STAGING: { label: 'STAGE', className: styles.envStaging },
  DEVELOPMENT: { label: 'DEV', className: styles.envDev },
  DISASTER_RECOVERY: { label: 'DR', className: styles.envDR },
};

export default function ServerProfilesManager() {
  const [servers, setServers] = useState<ServerProfile[]>([]);
  const [activeServerId, setActiveServerId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [pingStates, setPingStates] = useState<Record<string, { loading: boolean; result?: ServerPingResponse }>>({});
  const [activatingId, setActivatingId] = useState<string | null>(null);

  // New Server Form State
  const [formData, setFormData] = useState<ServerProfileCreate>({
    name: '',
    host: '',
    port: 1433,
    default_database: 'master',
    username: '',
    password: '',
    use_windows_auth: false,
    environment: 'PRODUCTION',
    role: 'Sunucu',
    driver: 'ODBC Driver 17 for SQL Server',
    timeout: 15,
    description: '',
  });

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const res = await getServerProfiles();
      setServers(res.servers);
      setActiveServerId(res.active_server_id);
    } catch (err) {
      console.error('Failed to load server profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();

    // Listen to global server changes (e.g. from TopBar switcher)
    const handleGlobalChange = () => {
      loadProfiles();
    };
    window.addEventListener('datapath-server-changed', handleGlobalChange);
    return () => {
      window.removeEventListener('datapath-server-changed', handleGlobalChange);
    };
  }, []);

  const handleActivate = async (serverId: string) => {
    try {
      setActivatingId(serverId);
      await activateServer(serverId);
      setActiveServerId(serverId);
      setServers((prev) =>
        prev.map((s) => ({ ...s, is_active: s.id === serverId }))
      );
      // Notify other components globally
      window.dispatchEvent(new CustomEvent('datapath-server-changed', { detail: { serverId } }));
    } catch (err) {
      console.error('Failed to activate server:', err);
      alert('Sunucu aktif hale getirilemedi: ' + String(err));
    } finally {
      setActivatingId(null);
    }
  };

  const handlePing = async (serverId: string) => {
    try {
      setPingStates((prev) => ({
        ...prev,
        [serverId]: { loading: true },
      }));
      const res = await pingServerProfile(serverId);
      setPingStates((prev) => ({
        ...prev,
        [serverId]: { loading: false, result: res },
      }));
      // Update latency in local servers state
      setServers((prev) =>
        prev.map((s) => (s.id === serverId ? { ...s, latency_ms: res.is_online ? res.latency_ms : null, is_online: res.is_online } : s))
      );
    } catch (err) {
      setPingStates((prev) => ({
        ...prev,
        [serverId]: { loading: false },
      }));
      alert('Ping testi başarısız: ' + String(err));
    }
  };

  const handleDelete = async (serverId: string, serverName: string) => {
    if (!confirm(`'${serverName}' sunucu profilini silmek istediğinize emin misiniz?`)) {
      return;
    }
    try {
      await deleteServerProfile(serverId);
      await loadProfiles();
      window.dispatchEvent(new CustomEvent('datapath-server-changed'));
    } catch (err) {
      console.error('Failed to delete server:', err);
      alert('Sunucu silinemedi: ' + String(err));
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.host.trim()) {
      alert('Lütfen sunucu adı ve host alanlarını doldurun.');
      return;
    }

    try {
      await addServerProfile(formData);
      setShowAddForm(false);
      setFormData({
        name: '',
        host: '',
        port: 1433,
        default_database: 'master',
        username: '',
        password: '',
        use_windows_auth: false,
        environment: 'PRODUCTION',
        role: 'Sunucu',
        driver: 'ODBC Driver 17 for SQL Server',
        timeout: 15,
        description: '',
      });
      await loadProfiles();
      window.dispatchEvent(new CustomEvent('datapath-server-changed'));
    } catch (err) {
      console.error('Failed to add server profile:', err);
      alert('Sunucu profili eklenirken hata oluştu: ' + String(err));
    }
  };

  return (
    <div className={styles.container}>
      {/* Header Row */}
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <span className={styles.summaryBadge}>
            Kayıtlı Sunucular: <strong>{servers.length}</strong>
          </span>
          <span className={styles.summaryBadge}>
            Aktif Ortam:{' '}
            <strong>
              {servers.find((s) => s.id === activeServerId)?.environment ?? 'PRODUCTION'}
            </strong>
          </span>
        </div>

        <div className={styles.actionButtons}>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={loadProfiles}
            disabled={loading}
            title="Profilleri Yenile"
          >
            <RefreshCw size={13} className={loading ? styles.spinning : ''} />
            Yenile
          </button>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus size={14} />
            {showAddForm ? 'Formu Kapat' : 'Yeni Sunucu Ekle'}
          </button>
        </div>
      </div>

      {/* New Server Profile Form */}
      {showAddForm && (
        <form onSubmit={handleCreateSubmit} className={styles.createFormCard}>
          <div className={styles.formTitle}>
            <Server size={15} color="var(--accent)" />
            Yeni SQL Server Bağlantı Profili
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Sunucu Adı *</label>
              <input
                type="text"
                className={styles.input}
                placeholder="Sunucu Adı"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Ana Makine (Host / IP) *</label>
              <input
                type="text"
                className={styles.input}
                placeholder="Host veya IP adresi"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Port</label>
              <input
                type="number"
                className={styles.input}
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 1433 })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Veritabanı</label>
              <input
                type="text"
                className={styles.input}
                value={formData.default_database}
                onChange={(e) => setFormData({ ...formData, default_database: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Ortam</label>
              <select
                className={styles.select}
                value={formData.environment}
                onChange={(e) =>
                  setFormData({ ...formData, environment: e.target.value as EnvironmentType })
                }
              >
                <option value="PRODUCTION">PRODUCTION</option>
                <option value="READ_ONLY_REPLICA">READ_ONLY_REPLICA</option>
                <option value="STAGING">STAGING</option>
                <option value="DEVELOPMENT">DEVELOPMENT</option>
                <option value="DISASTER_RECOVERY">DISASTER_RECOVERY</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Sunucu Rolü</label>
              <input
                type="text"
                className={styles.input}
                placeholder="Sunucu Rolü"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Kullanıcı Adı</label>
              <input
                type="text"
                className={styles.input}
                placeholder="Kullanıcı Adı"
                disabled={formData.use_windows_auth}
                value={formData.username || ''}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Şifre</label>
              <input
                type="password"
                className={styles.input}
                placeholder="••••••••"
                disabled={formData.use_windows_auth}
                value={formData.password || ''}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <div className={styles.checkboxGroup}>
              <input
                type="checkbox"
                id="useWindowsAuth"
                checked={formData.use_windows_auth}
                onChange={(e) => setFormData({ ...formData, use_windows_auth: e.target.checked })}
              />
              <label htmlFor="useWindowsAuth">Windows Kimlik Doğrulaması (Trusted Connection)</label>
            </div>
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => setShowAddForm(false)}
            >
              Vazgeç
            </button>
            <button type="submit" className={styles.saveBtn}>
              Profili Kaydet
            </button>
          </div>
        </form>
      )}

      {/* Grid of Server Profile Cards */}
      <div className={styles.cardsGrid}>
        {servers.map((server) => {
          const isActive = server.id === activeServerId;
          const envInfo = envLabels[server.environment] || {
            label: server.environment,
            className: styles.envProd,
          };
          const pingState = pingStates[server.id];

          return (
            <div
              key={server.id}
              className={`${styles.serverCard} ${isActive ? styles.activeCard : ''}`}
            >
              {/* Card Header: Env & Active Badge */}
              <div className={styles.cardHeader}>
                <span className={`${styles.envPill} ${envInfo.className}`}>
                  {server.environment === 'PRODUCTION' && <Shield size={10} />}
                  {server.environment === 'READ_ONLY_REPLICA' && <Layers size={10} />}
                  {server.environment === 'DISASTER_RECOVERY' && <Zap size={10} />}
                  {envInfo.label}
                </span>

                {isActive ? (
                  <span className={styles.activeBadge}>
                    <CheckCircle2 size={11} />
                    Aktif Sunucu
                  </span>
                ) : (
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(server.id, server.name)}
                    title="Sunucu Profilini Sil"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              {/* Title & Host */}
              <div className={styles.cardTitle}>
                <Server size={15} color="var(--accent)" />
                <span>{server.name}</span>
              </div>

              <div className={styles.hostBox}>
                <Globe size={12} />
                <span>
                  {server.host}:{server.port} / {server.default_database}
                </span>
              </div>

              {server.role && <div className={styles.roleText}>{server.role}</div>}

              {/* Hardware Specs & Latency (only rendered if actually available) */}
              <div className={styles.specsRow}>
                {server.cpu_count ? (
                  <span className={styles.specBadge} title="CPU Çekirdek">
                    <Cpu size={10} style={{ display: 'inline', marginRight: 3 }} />
                    {server.cpu_count} vCPU
                  </span>
                ) : null}
                {server.total_memory_gb ? (
                  <span className={styles.specBadge} title="RAM">
                    {server.total_memory_gb} GB RAM
                  </span>
                ) : null}
                {server.latency_ms !== null && server.latency_ms !== undefined ? (
                  <span className={styles.specBadge} title="Ağ Gecikmesi">
                    <Radio size={10} style={{ display: 'inline', marginRight: 3 }} />
                    {server.latency_ms} ms
                  </span>
                ) : null}
              </div>

              {/* Ping Result if available */}
              {pingState?.result && (
                <div
                  className={styles.pingResult}
                  style={!pingState.result.is_online ? { color: 'var(--status-danger)', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' } : undefined}
                >
                  {pingState.result.is_online ? <Activity size={12} /> : <XCircle size={12} />}
                  <span>{pingState.result.message}</span>
                </div>
              )}

              {/* Footer Actions */}
              <div className={styles.cardFooter}>
                <div className={styles.footerLeft}>
                  <button
                    type="button"
                    className={styles.pingBtn}
                    onClick={() => handlePing(server.id)}
                    disabled={pingState?.loading}
                    title="TCP Bağlantı ve Gecikme Testi"
                  >
                    <Activity
                      size={12}
                      className={pingState?.loading ? styles.spinning : ''}
                    />
                    {pingState?.loading ? 'Ölçülüyor...' : 'Ping Testi'}
                  </button>
                </div>

                {!isActive && (
                  <button
                    type="button"
                    className={styles.activateBtn}
                    onClick={() => handleActivate(server.id)}
                    disabled={activatingId === server.id}
                  >
                    {activatingId === server.id ? 'Bağlanıyor...' : 'Bu Sunucuya Geç'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
