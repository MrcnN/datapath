import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  AlertTriangle,
  TrendingUp,
  Database,
  GitCompare,
  Wrench,
  Shield,
  Activity,
  Clock,
  Sparkles,
  Layers,
  Hourglass,
  HardDrive,
  Cpu,
  CalendarClock,
  Sun,
  Moon,
  ChevronDown,
  Check,
  Search,
  ExternalLink,
  FileText,
  Zap,
  Compass,
  Wand2,
  GitPullRequest,
  FlaskConical,
  PieChart,
  ShieldCheck,
  Terminal,
  Radio,
  type LucideIcon,
} from 'lucide-react';
import DossierReportModal from '../report/DossierReportModal';
import EmergencyTriageModal from '../triage/EmergencyTriageModal';
import { getInstanceMetadata, getServerProfiles, activateServer } from '../../lib/api';
import type { InstanceMetadata, ServerProfile, EnvironmentType } from '../../lib/types';
import styles from './TopBar.module.css';

interface RouteInfo {
  label: string;
  category: string;
  icon: LucideIcon;
}

const routeMap: Record<string, RouteInfo> = {
  // 1. Genel Bakış & Filo
  '/': { label: 'Gösterge Paneli', category: 'Genel Bakış & Filo', icon: LayoutDashboard },
  '/instances': { label: 'Sunucular & Bağlantı', category: 'Genel Bakış & Filo', icon: Server },
  '/catalog': { label: 'Modül Kataloğu', category: 'Genel Bakış & Filo', icon: Compass },

  // 2. Sorgu & Performans Zekası
  '/query-performance': { label: 'Sorgu Performansı', category: 'Sorgu & Performans Zekası', icon: TrendingUp },
  '/query-rewriter': { label: 'Akıllı Sorgu İyileştirici', category: 'Sorgu & Performans Zekası', icon: Wand2 },
  '/execution-plan': { label: 'Grafiksel Yürütme Planı', category: 'Sorgu & Performans Zekası', icon: GitPullRequest },
  '/waits': { label: 'Bekleme İstatistikleri', category: 'Sorgu & Performans Zekası', icon: Hourglass },

  // 3. İndeksler & Akıllı Bakım
  '/indexes': { label: 'İndeks Zekası', category: 'İndeksler & Akıllı Bakım', icon: Layers },
  '/hypothetical-indexes': { label: 'Hipotetik Simülatör (What-If)', category: 'İndeksler & Akıllı Bakım', icon: FlaskConical },
  '/maintenance-planner': { label: 'Akıllı Bakım Planlayıcısı', category: 'İndeksler & Akıllı Bakım', icon: Wrench },

  // 4. Bellek, TempDB & Depolama
  '/tempdb': { label: 'TempDB & Bellek', category: 'Bellek, TempDB & Depolama', icon: Cpu },
  '/buffer-pool': { label: 'Buffer Pool Tomografisi', category: 'Bellek, TempDB & Depolama', icon: PieChart },
  '/storage': { label: 'Depolama & Log Dosyaları', category: 'Bellek, TempDB & Depolama', icon: HardDrive },

  // 5. Kriz, Güvenilirlik & Yedekleme
  '/incidents': { label: 'Olay Merkezi & Deadlock', category: 'Kriz, Güvenilirlik & Yedekleme', icon: AlertTriangle },
  '/extended-events': { label: 'Genişletilmiş Olaylar (XE)', category: 'Kriz, Güvenilirlik & Yedekleme', icon: Radio },
  '/backups': { label: 'Yedekleme & Kurtarma', category: 'Kriz, Güvenilirlik & Yedekleme', icon: Database },
  '/high-availability': { label: 'Yüksek Erişilebilirlik (HA)', category: 'Kriz, Güvenilirlik & Yedekleme', icon: Activity },

  // 6. Yönetim, Güvenlik & Denetim
  '/best-practices': { label: 'Best Practice Karnesi', category: 'Yönetim, Güvenlik & Denetim', icon: ShieldCheck },
  '/permissions': { label: 'İzinler & Güvenlik', category: 'Yönetim, Güvenlik & Denetim', icon: Shield },
  '/agent-jobs': { label: 'SQL Agent & Alarmlar', category: 'Yönetim, Güvenlik & Denetim', icon: CalendarClock },
  '/schema-diff': { label: 'Şema Karşılaştırması', category: 'Yönetim, Güvenlik & Denetim', icon: GitCompare },
  '/toolkit': { label: 'DBA Araç Seti (Scripts)', category: 'Yönetim, Güvenlik & Denetim', icon: Terminal },
};

const envBadgeClasses: Record<EnvironmentType, string> = {
  PRODUCTION: styles.envProd,
  READ_ONLY_REPLICA: styles.envReplica,
  STAGING: styles.envStaging,
  DEVELOPMENT: styles.envDev,
  DISASTER_RECOVERY: styles.envDR,
};

const envShortLabels: Record<EnvironmentType, string> = {
  PRODUCTION: 'PROD',
  READ_ONLY_REPLICA: 'REPLICA',
  STAGING: 'STAGE',
  DEVELOPMENT: 'DEV',
  DISASTER_RECOVERY: 'DR',
};

interface TopBarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function TopBar({ collapsed, onToggle }: TopBarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const currentRoute = routeMap[pathname] || {
    label: 'Sayfa',
    category: 'Genel',
    icon: Sparkles,
  };

  const [metadata, setMetadata] = useState<InstanceMetadata | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('datapath-theme') as 'dark' | 'light') || 'dark';
  });
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [showTriageModal, setShowTriageModal] = useState<boolean>(false);

  // Multi-Server Profile State
  const [servers, setServers] = useState<ServerProfile[]>([]);
  const [activeServerId, setActiveServerId] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [isSwitching, setIsSwitching] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('datapath-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const loadServerProfiles = () => {
    getServerProfiles()
      .then((data) => {
        if (data && data.servers) {
          setServers(data.servers);
          setActiveServerId(data.active_server_id);
        }
      })
      .catch((err) => {
        console.warn('Multi-server profiles fetch failed, using fallback:', err);
      });
  };

  useEffect(() => {
    loadServerProfiles();

    const handleServerChange = () => {
      loadServerProfiles();
    };
    window.addEventListener('datapath-server-changed', handleServerChange);
    return () => {
      window.removeEventListener('datapath-server-changed', handleServerChange);
    };
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  useEffect(() => {
    let mounted = true;
    getInstanceMetadata()
      .then((data) => {
        if (mounted && data) {
          setMetadata(data);
          const isDemo = data.server_name?.includes('(Demo)');
          setIsConnected(!isDemo);
        }
      })
      .catch(() => {
        if (mounted) setIsConnected(false);
      });

    return () => {
      mounted = false;
    };
  }, [pathname, activeServerId]);

  const handleSelectServer = async (server: ServerProfile) => {
    if (server.id === activeServerId) {
      setDropdownOpen(false);
      return;
    }
    try {
      setIsSwitching(true);
      await activateServer(server.id);
      setActiveServerId(server.id);
      setDropdownOpen(false);
      // Dispatch global event to reload all views
      window.dispatchEvent(
        new CustomEvent('datapath-server-changed', { detail: { serverId: server.id } })
      );
    } catch (err) {
      console.error('Failed to switch server:', err);
      alert('Sunucu değiştirilemedi: ' + String(err));
    } finally {
      setIsSwitching(false);
    }
  };

  const activeServer =
    servers.find((s) => s.id === activeServerId) ||
    servers[0] ||
    null;

  const filteredServers = servers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.host.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.environment.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const RouteIcon = currentRoute.icon;

  return (
    <header className={styles.topBar}>
      {/* Left: Breadcrumbs */}
      <div className={styles.leftSection}>
        <div className={styles.breadcrumbArea}>
          <span className={styles.categoryLabel}>{currentRoute.category}</span>
          <span className={styles.breadcrumbSep}>/</span>
          <div className={styles.pageTitleBox}>
            <RouteIcon size={14} className={styles.breadcrumbIcon} />
            <span className={styles.breadcrumbCurrent}>{currentRoute.label}</span>
          </div>
        </div>
      </div>

      {/* Right: Dossier Button, Theme Toggle & Global Server Switcher Dropdown */}
      <div className={styles.rightSection}>
        <button
          type="button"
          className={styles.triageBtn}
          onClick={() => setShowTriageModal(true)}
          title="Acil Durum Kriz Triyajı (1-Tıkla Teşhis)"
          aria-label="Acil Durum Kriz Triyajı"
        >
          <Zap size={14} className={styles.triageBtnIcon} />
          <span className={styles.triageBtnText}>Kriz Triyajı</span>
        </button>
        <button
          type="button"
          className={styles.dossierBtn}
          onClick={() => setShowReportModal(true)}
          title="Kapsamlı Genel Sistem Özeti İndir & Görüntüle"
          aria-label="Kapsamlı Genel Sistem Özeti"
        >
          <FileText size={14} className={styles.dossierBtnIcon} />
          <span className={styles.dossierBtnText}>Genel Sistem Özeti</span>
        </button>

        <button
          type="button"
          className={styles.themeToggleBtn}
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Aydınlık Temaya Geç' : 'Karanlık Temaya Geç'}
          aria-label={theme === 'dark' ? 'Aydınlık Temaya Geç' : 'Karanlık Temaya Geç'}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Global Multi-Server Switcher Dropdown */}
        {activeServer ? (
          <div className={styles.serverSwitcherWrapper} ref={dropdownRef}>
            <button
              type="button"
              className={`${styles.serverSwitchBtn} ${dropdownOpen ? styles.serverSwitchBtnOpen : ''}`}
              onClick={() => setDropdownOpen(!dropdownOpen)}
              title={`Aktif Sunucu: ${activeServer.name} (${activeServer.host}) — Tıklayarak Değiştirin`}
            >
              <span className={styles.pulsingDot} />
              <span
                className={`${styles.envPillSmall} ${
                  envBadgeClasses[activeServer.environment] || styles.envProd
                }`}
              >
                {envShortLabels[activeServer.environment] || activeServer.environment}
              </span>
              <span className={styles.serverNameLabel}>{activeServer.name}</span>
              {activeServer.latency_ms && (
                <span className={styles.latencyTag}>{activeServer.latency_ms}ms</span>
              )}
              <ChevronDown
                size={13}
                className={`${styles.chevronIcon} ${dropdownOpen ? styles.chevronOpen : ''}`}
              />
            </button>

            {dropdownOpen && (
              <div className={styles.dropdownPopover}>
                {/* Dropdown Header */}
                <div className={styles.dropdownHeader}>
                  <div className={styles.dropdownHeaderTop}>
                    <span className={styles.dropdownTitle}>SQL Server Ortamları</span>
                    <span className={styles.serverTotalCount}>{servers.length} Kayıtlı Sunucu</span>
                  </div>
                  <div className={styles.searchInputBox}>
                    <Search size={12} color="var(--text-muted)" />
                    <input
                      type="text"
                      className={styles.searchInput}
                      placeholder="Sunucu veya host ara..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>

                {/* Server List */}
                <div className={styles.serverList}>
                  {filteredServers.length === 0 ? (
                    <div style={{ padding: '12px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                      Eşleşen sunucu bulunamadı.
                    </div>
                  ) : (
                    filteredServers.map((s) => {
                      const isSelected = s.id === activeServerId;
                      return (
                        <div
                          key={s.id}
                          className={`${styles.serverItem} ${isSelected ? styles.activeServerItem : ''}`}
                          onClick={() => handleSelectServer(s)}
                        >
                          <div className={styles.serverItemMain}>
                            <div className={styles.serverItemHeader}>
                              <span
                                className={`${styles.envPillSmall} ${
                                  envBadgeClasses[s.environment] || styles.envProd
                                }`}
                              >
                                {envShortLabels[s.environment] || s.environment}
                              </span>
                              <span className={styles.serverItemName}>{s.name}</span>
                            </div>
                            <span className={styles.serverItemHost}>
                              {s.host}:{s.port}
                            </span>
                            {s.role ? <span className={styles.serverItemRole}>{s.role}</span> : null}
                          </div>

                          <div className={styles.serverItemRight}>
                            {isSelected ? (
                              <Check size={14} className={styles.activeCheckIcon} />
                            ) : null}
                            {s.latency_ms && (
                              <span className={styles.latencyTag}>{s.latency_ms}ms</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Dropdown Footer */}
                <div className={styles.dropdownFooter}>
                  <button
                    type="button"
                    className={styles.manageServersLink}
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate('/instances');
                    }}
                  >
                    <span>Tüm Profilleri Yönet</span>
                    <ExternalLink size={11} />
                  </button>
                  <span className={styles.serverTotalCount}>
                    {isSwitching ? 'Geçiş yapılıyor...' : '1-Tıkla Değiştir'}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Fallback static badge if no server profiles */
          <div
            className={`${styles.connectionBadge} ${
              isConnected ? styles.connected : styles.demoMode
            }`}
          >
            <span className={styles.statusDot} />
            <span className={styles.statusLabel}>
              {isConnected && metadata?.server_name
                ? `Canlı: ${metadata.server_name}`
                : 'Demo Modu'}
            </span>
          </div>
        )}
      </div>

      {showReportModal && <DossierReportModal onClose={() => setShowReportModal(false)} />}
      {showTriageModal && <EmergencyTriageModal onClose={() => setShowTriageModal(false)} />}
    </header>
  );
}
