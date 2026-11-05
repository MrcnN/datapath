import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  TrendingUp,
  Wand2,
  GitPullRequest,
  Hourglass,
  Layers,
  FlaskConical,
  Wrench,
  BarChart3,
  Cpu,
  PieChart,
  HardDrive,
  AlertTriangle,
  Radio,
  Database,
  Activity,
  ShieldCheck,
  Shield,
  CalendarClock,
  GitCompare,
  Terminal,
  Sun,
  Moon,
  ChevronDown,
  Check,
  Search,
  ExternalLink,
  FileText,
  Zap,
  Sparkles,
  User,
  LogOut,
  Settings,
  Crown,
  type LucideIcon,
} from 'lucide-react';
import DossierReportModal from '../report/DossierReportModal';
import EmergencyTriageModal from '../triage/EmergencyTriageModal';
import GlobalCommandPalette from './GlobalCommandPalette';
import { getInstanceMetadata, getServerProfiles, activateServer } from '../../lib/api';
import type { InstanceMetadata, ServerProfile, EnvironmentType } from '../../lib/types';
import { useAuth } from '../../features/auth/AuthContext';
import styles from './TopBar.module.css';

interface SubnavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

interface ModuleSection {
  id: string;
  title: string;
  icon: LucideIcon;
  items: SubnavItem[];
}

export const MODULE_SECTIONS: ModuleSection[] = [
  {
    id: 'genel-bakis',
    title: 'Gözlem & Canlı Kokpit',
    icon: LayoutDashboard,
    items: [
      { path: '/', label: 'Gösterge Paneli', icon: LayoutDashboard },
      { path: '/instances', label: 'Canlı Oturumlar & Sunucular', icon: Server },
    ],
  },
  {
    id: 'sorgu-performans',
    title: 'Sorgu & Performans Zekâsı',
    icon: TrendingUp,
    items: [
      { path: '/query-performance', label: 'Ağır Sorgular & Query Store', icon: TrendingUp },
      { path: '/cardinality-drift', label: 'Kardinalite & Parameter Sniffing', icon: GitCompare },
      { path: '/query-rewriter', label: 'Sorgu Düzeltici', icon: Wand2 },
      { path: '/execution-plan', label: 'Yürütme Planı (.sqlplan)', icon: GitPullRequest },
      { path: '/waits', label: 'Bekleme İstatistikleri', icon: Hourglass },
    ],
  },
  {
    id: 'indeks-bakim',
    title: 'İndeks & Kardinalite Bakımı',
    icon: Layers,
    items: [
      { path: '/indexes', label: 'İndeks Analizi & Parçalanma', icon: Layers },
      { path: '/hypothetical-indexes', label: 'Sanal İndeks Simülatörü', icon: FlaskConical },
      { path: '/maintenance-planner', label: 'Bakım Planlayıcı', icon: Wrench },
      { path: '/statistics', label: 'İstatistik Sağlığı & Bayatlık', icon: BarChart3 },
    ],
  },
  {
    id: 'bellek-depolama',
    title: 'Bellek & Depolama Analitiği',
    icon: Cpu,
    items: [
      { path: '/capacity-runway', label: 'Kapasite & Runway Tahminleme', icon: HardDrive },
      { path: '/storage', label: 'Disk & VLF Mimarisi', icon: Database },
      { path: '/tempdb', label: 'TempDB & Çekişme Analizi', icon: Cpu },
      { path: '/buffer-pool', label: 'Tablo RAM (Buffer Pool)', icon: PieChart },
    ],
  },
  {
    id: 'kilitlenme-guvenilirlik',
    title: 'Kilitlenme & Güvenilirlik',
    icon: AlertTriangle,
    items: [
      { path: '/incidents', label: 'Kilitlenmeler & Deadlock', icon: AlertTriangle },
      { path: '/extended-events', label: 'Genişletilmiş Olaylar (XE)', icon: Radio },
      { path: '/backups', label: 'Yedekleme & Disk Sağlığı', icon: Database },
      { path: '/high-availability', label: 'AlwaysOn & Replikalar', icon: Activity },
    ],
  },
  {
    id: 'guvenlik-yonetim',
    title: 'Güvenlik, Yönetim & Betikler',
    icon: ShieldCheck,
    items: [
      { path: '/role-management', label: 'Yetki & İzin Yönetimi', icon: Crown },
      { path: '/profile', label: 'Profilim & Yetkiler', icon: ShieldCheck },
      { path: '/permissions', label: 'Kullanıcılar & Yetkiler', icon: Shield },
      { path: '/best-practices', label: 'Sistem Uygunluk Karnesi', icon: ShieldCheck },
      { path: '/agent-jobs', label: 'SQL Agent & Alarmlar', icon: CalendarClock },
      { path: '/schema-diff', label: 'Şema Karşılaştırma', icon: GitCompare },
      { path: '/toolkit', label: 'T-SQL Betik Kütüphanesi', icon: Terminal },
    ],
  },
];

interface RouteInfo {
  label: string;
  category: string;
  icon: LucideIcon;
  section: ModuleSection;
}

const routeMap: Record<string, RouteInfo> = {};
MODULE_SECTIONS.forEach((sec) => {
  sec.items.forEach((item) => {
    routeMap[item.path] = {
      label: item.label,
      category: sec.title,
      icon: item.icon,
      section: sec,
    };
  });
});

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
  const { user, logout, elevateToAdmin } = useAuth();

  // Resolve active route and section memoized
  const currentRoute = useMemo(() => {
    return (
      routeMap[pathname] || {
        label: 'Sayfa',
        category: 'Genel Bakış',
        icon: Sparkles,
        section: MODULE_SECTIONS[0],
      }
    );
  }, [pathname]);

  const currentSection = currentRoute.section || MODULE_SECTIONS[0];

  const [metadata, setMetadata] = useState<InstanceMetadata | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return (localStorage.getItem('datapath-theme') as 'dark' | 'light') || 'dark';
    } catch {
      return 'dark';
    }
  });
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [showTriageModal, setShowTriageModal] = useState<boolean>(false);
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false);

  // Category Switcher Dropdown
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState<boolean>(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Multi-Server Profile State
  const [servers, setServers] = useState<ServerProfile[]>([]);
  const [activeServerId, setActiveServerId] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [isSwitching, setIsSwitching] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // User Profile Dropdown State
  const [userDropdownOpen, setUserDropdownOpen] = useState<boolean>(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Global Ctrl+K / Cmd+K shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Theme synchronization
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('datapath-theme', theme);
    } catch {
      // storage unavailable
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const loadServerProfiles = useCallback(() => {
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
  }, []);

  useEffect(() => {
    loadServerProfiles();

    const handleServerChange = () => {
      loadServerProfiles();
    };
    window.addEventListener('datapath-server-changed', handleServerChange);
    return () => {
      window.removeEventListener('datapath-server-changed', handleServerChange);
    };
  }, [loadServerProfiles]);

  // Click outside and Escape key to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setCategoryDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        setCategoryDropdownOpen(false);
        setUserDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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

  const handleSelectServer = useCallback(
    async (server: ServerProfile) => {
      if (server.id === activeServerId) {
        setDropdownOpen(false);
        return;
      }
      try {
        setIsSwitching(true);
        await activateServer(server.id);
        setActiveServerId(server.id);
        setDropdownOpen(false);
        window.dispatchEvent(
          new CustomEvent('datapath-server-changed', { detail: { serverId: server.id } })
        );
      } catch (err) {
        console.error('Failed to switch server:', err);
        alert('Sunucu değiştirilemedi: ' + String(err));
      } finally {
        setIsSwitching(false);
      }
    },
    [activeServerId]
  );

  const activeServer = useMemo(() => {
    return servers.find((s) => s.id === activeServerId) || servers[0] || null;
  }, [servers, activeServerId]);

  const filteredServers = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return servers;
    return servers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.host.toLowerCase().includes(q) ||
        s.environment.toLowerCase().includes(q)
    );
  }, [servers, searchFilter]);

  const RouteIcon = currentRoute.icon;
  const CategoryIcon = currentSection.icon;

  return (
    <header className={styles.topBarContainer} role="banner">
      {/* Tier 1: Primary Cockpit Bar */}
      <div className={styles.topBarMain}>
        {/* Left: Category Dropdown & Active Page Breadcrumb */}
        <div className={styles.leftSection}>
          <div className={styles.breadcrumbArea}>
            {/* Quick Category Selector */}
            <div className={styles.categoryDropdownWrapper} ref={categoryDropdownRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={categoryDropdownOpen}
                aria-label={`Modül Değiştir: ${currentSection.title}`}
                className={`${styles.categoryBtn} ${categoryDropdownOpen ? styles.categoryBtnActive : ''}`}
                onClick={() => setCategoryDropdownOpen((prev) => !prev)}
                title="Modül Değiştir"
              >
                <CategoryIcon size={13} className={styles.categoryIcon} aria-hidden="true" />
                <span>{currentSection.title}</span>
                <ChevronDown size={11} aria-hidden="true" />
              </button>

              {categoryDropdownOpen && (
                <div className={styles.categoryDropdownPopover} role="menu" aria-label="Modül Seçenekleri">
                  {MODULE_SECTIONS.map((sec) => {
                    const SecIcon = sec.icon;
                    const isSecActive = sec.id === currentSection.id;
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        role="menuitem"
                        className={`${styles.categoryDropdownItem} ${
                          isSecActive ? styles.categoryDropdownItemActive : ''
                        }`}
                        onClick={() => {
                          setCategoryDropdownOpen(false);
                          navigate(sec.items[0].path);
                        }}
                      >
                        <div className={styles.categoryDropdownItemLeft}>
                          <SecIcon size={14} className={styles.categoryDropdownIcon} aria-hidden="true" />
                          <span>{sec.title}</span>
                        </div>
                        {isSecActive && <Check size={13} color="var(--accent)" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <span className={styles.breadcrumbSep} aria-hidden="true">/</span>

            {/* Active View Label */}
            <div className={styles.activePageTitle}>
              <RouteIcon size={14} className={styles.pageIcon} aria-hidden="true" />
              <span>{currentRoute.label}</span>
            </div>
          </div>
        </div>

        {/* Center: Global Search Command Bar (Ctrl+K) */}
        <div className={styles.centerSection}>
          <button
            type="button"
            className={styles.searchBarTrigger}
            onClick={() => setShowCommandPalette(true)}
            aria-label="Tüm sayfa ve araçlarda ara (Kısayol: Ctrl+K)"
            aria-keyshortcuts="Control+K"
            title="Tüm sayfa, metrik ve araçlarda ara (Ctrl+K)"
          >
            <div className={styles.searchBarLeft}>
              <Search size={13} aria-hidden="true" />
              <span>Sayfa veya araç ara...</span>
            </div>
            <span className={styles.searchKbd} aria-hidden="true">Ctrl K</span>
          </button>
        </div>

        {/* Right: Actions, Server Switcher, Theme & User Profile */}
        <div className={styles.rightSection}>
          <button
            type="button"
            className={styles.triageBtn}
            onClick={() => setShowTriageModal(true)}
            title="Acil Durum Kriz Triyajı (1-Tıkla Teşhis)"
            aria-label="Acil Durum Kriz Triyajı"
          >
            <Zap size={13} className={styles.triageBtnIcon} aria-hidden="true" />
            <span>Kriz Triyajı</span>
          </button>

          <button
            type="button"
            className={styles.dossierBtn}
            onClick={() => setShowReportModal(true)}
            title="Kapsamlı Genel Sistem Özeti İndir & Görüntüle"
            aria-label="Kapsamlı Genel Sistem Özeti"
          >
            <FileText size={13} className={styles.dossierBtnIcon} aria-hidden="true" />
            <span>Sistem Özeti</span>
          </button>

          <button
            type="button"
            className={styles.themeToggleBtn}
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Aydınlık Temaya Geç' : 'Karanlık Temaya Geç'}
            aria-label={theme === 'dark' ? 'Aydınlık Temaya Geç' : 'Karanlık Temaya Geç'}
          >
            {theme === 'dark' ? <Sun size={13} aria-hidden="true" /> : <Moon size={13} aria-hidden="true" />}
          </button>

          {/* Global Multi-Server Switcher Dropdown */}
          {activeServer ? (
            <div className={styles.serverSwitcherWrapper} ref={dropdownRef}>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={dropdownOpen}
                aria-label={`Aktif Sunucu: ${activeServer.name} (${activeServer.host})`}
                className={`${styles.serverSwitchBtn} ${dropdownOpen ? styles.serverSwitchBtnOpen : ''}`}
                onClick={() => setDropdownOpen((prev) => !prev)}
                title={`Aktif Sunucu: ${activeServer.name} (${activeServer.host}) — Tıklayarak Değiştirin`}
              >
                <span className={styles.solidDot} aria-hidden="true" />
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
                  size={12}
                  className={`${styles.chevronIcon} ${dropdownOpen ? styles.chevronOpen : ''}`}
                  aria-hidden="true"
                />
              </button>

              {dropdownOpen && (
                <div className={styles.dropdownPopover} role="dialog" aria-label="SQL Server Ortamları Listesi">
                  {/* Dropdown Header */}
                  <div className={styles.dropdownHeader}>
                    <div className={styles.dropdownHeaderTop}>
                      <span className={styles.dropdownTitle}>SQL Server Ortamları</span>
                      <span className={styles.serverTotalCount}>{servers.length} Sunucu</span>
                    </div>
                    <div className={styles.searchInputBox}>
                      <Search size={12} color="var(--text-muted)" aria-hidden="true" />
                      <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="Sunucu ara..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        aria-label="Sunucu veya host ara"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Server List */}
                  <div className={styles.serverList} role="listbox" aria-label="Sunucular">
                    {filteredServers.length === 0 ? (
                      <div style={{ padding: '10px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                        Eşleşen sunucu bulunamadı.
                      </div>
                    ) : (
                      filteredServers.map((s) => {
                        const isSelected = s.id === activeServerId;
                        return (
                          <div
                            key={s.id}
                            role="option"
                            aria-selected={isSelected}
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
                                <Check size={13} className={styles.activeCheckIcon} aria-hidden="true" />
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
                      <span>Profilleri Yönet</span>
                      <ExternalLink size={10} aria-hidden="true" />
                    </button>
                    <span className={styles.serverTotalCount}>
                      {isSwitching ? 'Değiştiriliyor...' : '1-Tıkla Değiştir'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* User Profile & Auth Indicator */}
          {user ? (
            <div className={styles.userProfileWrapper} ref={userDropdownRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={userDropdownOpen}
                aria-label={`Kullanıcı Profili: ${user.full_name} (${user.role})`}
                className={`${styles.userProfileBtn} ${userDropdownOpen ? styles.userProfileBtnActive : ''}`}
                onClick={() => setUserDropdownOpen((prev) => !prev)}
                title={`Profil & Yetki Yönetimi: ${user.full_name}`}
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.full_name} className={styles.userAvatarImg} />
                ) : (
                  <div className={styles.userAvatarInitials}>
                    {user.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>
                )}
                <div className={styles.userMetaPreview}>
                  <span className={styles.userNameText}>{user.full_name}</span>
                  <span className={styles.userRoleTag}>
                    {user.role === 'SENIOR_DBA'
                      ? 'Yönetici'
                      : user.role === 'OPERATOR'
                      ? 'Operatör'
                      : 'Görüntüleyici'}
                  </span>
                </div>
                <ChevronDown
                  size={12}
                  className={`${styles.chevronIcon} ${userDropdownOpen ? styles.chevronOpen : ''}`}
                  aria-hidden="true"
                />
              </button>

              {userDropdownOpen && (
                <div className={styles.userMenuPopover} role="menu" aria-label="Kullanıcı Menüsü">
                  <div className={styles.userMenuHeader}>
                    <div className={styles.userMenuHeaderTop}>
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.full_name} className={styles.userAvatarLarge} />
                      ) : (
                        <div className={styles.userAvatarInitialsLarge}>
                          {user.full_name
                            .split(' ')
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </div>
                      )}
                      <div className={styles.userMenuIdentity}>
                        <div className={styles.userMenuFullName}>{user.full_name}</div>
                        <div className={styles.userMenuEmail}>{user.email}</div>
                        <div className={styles.userMenuBadgeRow}>
                          <span className={styles.userRoleBadgePill}>
                            {user.role === 'SENIOR_DBA'
                              ? 'Yönetici'
                              : user.role === 'OPERATOR'
                              ? 'Operatör'
                              : 'Görüntüleyici'}
                          </span>
                          {user.google_connected && (
                            <span className={styles.oauthMiniTag} title="Google Hesabı Bağlı">Google</span>
                          )}
                          {user.github_connected && (
                            <span className={styles.oauthMiniTag} title="GitHub Hesabı Bağlı">GitHub</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {user.title && <div className={styles.userMenuSubTitle}>{user.title} • {user.department}</div>}
                  </div>

                  <div className={styles.userMenuItems}>
                    {user.role !== 'SENIOR_DBA' && (user.id === 'usr_admin_01' || user.email?.includes('erdim')) && (
                      <button
                        type="button"
                        role="menuitem"
                        className={styles.userMenuItem}
                        style={{ color: '#38bdf8', fontWeight: 600, background: 'rgba(56, 189, 248, 0.1)' }}
                        onClick={async () => {
                          setUserDropdownOpen(false);
                          await elevateToAdmin();
                        }}
                      >
                        <ShieldCheck size={13} className={styles.userMenuIcon} aria-hidden="true" />
                        <span>Yönetici Yetkisini Geri Yükle</span>
                      </button>
                    )}

                    {(user.role === 'SENIOR_DBA' || user.id === 'usr_admin_01' || user.email?.includes('erdim')) && (
                      <button
                        type="button"
                        role="menuitem"
                        className={styles.userMenuItem}
                        style={{ color: 'var(--accent)', fontWeight: 600 }}
                        onClick={() => {
                          setUserDropdownOpen(false);
                          navigate('/role-management');
                        }}
                      >
                        <Crown size={13} className={styles.userMenuIcon} aria-hidden="true" />
                        <span>Tüm Rol & Yetkileri Yönet</span>
                      </button>
                    )}

                    <button
                      type="button"
                      role="menuitem"
                      className={styles.userMenuItem}
                      onClick={() => {
                        setUserDropdownOpen(false);
                        navigate('/profile');
                      }}
                    >
                      <User size={13} className={styles.userMenuIcon} aria-hidden="true" />
                      <span>Profil & Bilgileri Düzenle</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      className={styles.userMenuItem}
                      onClick={() => {
                        setUserDropdownOpen(false);
                        navigate('/profile');
                      }}
                    >
                      <ShieldCheck size={13} className={styles.userMenuIcon} aria-hidden="true" />
                      <span>Operasyonel Yetki Matrisi</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      className={styles.userMenuItem}
                      onClick={() => {
                        setUserDropdownOpen(false);
                        navigate('/profile');
                      }}
                    >
                      <Settings size={13} className={styles.userMenuIcon} aria-hidden="true" />
                      <span>Güvenlik & Parola Ayarları</span>
                    </button>
                  </div>

                  <div className={styles.userMenuFooter}>
                    <button
                      type="button"
                      className={styles.logoutBtn}
                      onClick={async () => {
                        setUserDropdownOpen(false);
                        await logout();
                        navigate('/');
                      }}
                    >
                      <LogOut size={12} aria-hidden="true" />
                      <span>Oturumu Kapat</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link to="/" className={styles.loginLinkBtn} title="Kullanıcı Girişi Yap">
              <User size={13} aria-hidden="true" />
              <span>Giriş Yap</span>
            </Link>
          )}
        </div>
      </div>

      {/* Tier 2: Contextual Module Sub-Navigation Bar (Sibling Pages in Active Module) */}
      <nav className={styles.subNavBar} aria-label="Modül Alt Menüsü">
        <div className={styles.subnavTabsList} role="tablist">
          {currentSection.items.map((subItem) => {
            const SubIcon = subItem.icon;
            const isTabActive = pathname === subItem.path;
            return (
              <Link
                key={subItem.path}
                to={subItem.path}
                role="tab"
                aria-selected={isTabActive}
                aria-current={isTabActive ? 'page' : undefined}
                className={`${styles.subnavTab} ${isTabActive ? styles.subnavTabActive : ''}`}
              >
                <SubIcon size={13} className={styles.subnavIcon} aria-hidden="true" />
                <span>{subItem.label}</span>
                {subItem.badge && <span className={styles.subnavBadge}>{subItem.badge}</span>}
              </Link>
            );
          })}
        </div>

        <div className={styles.subnavRightMeta} aria-hidden="true">
          <span>{currentSection.items.length} Araç</span>
        </div>
      </nav>

      {/* Modals */}
      {showReportModal && <DossierReportModal onClose={() => setShowReportModal(false)} />}
      {showTriageModal && <EmergencyTriageModal onClose={() => setShowTriageModal(false)} />}
      <GlobalCommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
      />
    </header>
  );
}
