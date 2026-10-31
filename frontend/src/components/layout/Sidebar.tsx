import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  AlertTriangle,
  Radio,
  TrendingUp,
  Layers,
  Hourglass,
  HardDrive,
  Cpu,
  Database,
  Activity,
  Wrench,
  CalendarClock,
  GitCompare,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  FileText,
  Sun,
  Moon,
  type LucideIcon,
} from 'lucide-react';
import DossierReportModal from '../report/DossierReportModal';
import styles from './Sidebar.module.css';

export type PillarId = 'overview' | 'diagnostics' | 'infrastructure' | 'governance';

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  exact?: boolean;
}

interface PillarConfig {
  id: PillarId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  description: string;
  items: NavItem[];
}

const PILLARS: PillarConfig[] = [
  {
    id: 'overview',
    label: 'Genel Bakış',
    shortLabel: 'Genel',
    icon: LayoutDashboard,
    description: 'Sistem sağlığı ve sunucu bağlantıları',
    items: [
      { path: '/', label: 'Gösterge Paneli', icon: LayoutDashboard, exact: true },
      { path: '/instances', label: 'Sunucular & Bağlantı', icon: Server },
    ],
  },
  {
    id: 'diagnostics',
    label: 'Tanı & İzleme',
    shortLabel: 'Tanı',
    icon: Activity,
    description: 'Canlı telemetri, kilitler ve sorgu analizi',
    items: [
      { path: '/incidents', label: 'Olay Merkezi & Kilitler', icon: AlertTriangle },
      { path: '/extended-events', label: 'Genişletilmiş Olaylar (XE)', icon: Radio },
      { path: '/query-performance', label: 'Sorgu Performansı', icon: TrendingUp },
      { path: '/indexes', label: 'İndeks Zekası', icon: Layers },
      { path: '/waits', label: 'Bekleme İstatistikleri', icon: Hourglass },
    ],
  },
  {
    id: 'infrastructure',
    label: 'Depolama & Altyapı',
    shortLabel: 'Altyapı',
    icon: HardDrive,
    description: 'Disk alanları, bellek, yedek ve Always On',
    items: [
      { path: '/storage', label: 'Depolama & Dosyalar', icon: HardDrive },
      { path: '/tempdb', label: 'TempDB & Bellek', icon: Cpu },
      { path: '/backups', label: 'Yedekleme & Kurtarma', icon: Database },
      { path: '/high-availability', label: 'Yüksek Erişilebilirlik', icon: Activity },
    ],
  },
  {
    id: 'governance',
    label: 'Yönetim & Güvenlik',
    shortLabel: 'Yönetim',
    icon: Shield,
    description: 'İzinler, SQL Agent işleri ve araç seti',
    items: [
      { path: '/toolkit', label: 'DBA Araç Seti', icon: Wrench },
      { path: '/agent-jobs', label: 'SQL Agent İşleri', icon: CalendarClock },
      { path: '/schema-diff', label: 'Şema Karşılaştırması', icon: GitCompare },
      { path: '/permissions', label: 'İzinler & Güvenlik', icon: Shield },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Determine active pillar based on route
  const currentPillarId = useMemo<PillarId>(() => {
    for (const pillar of PILLARS) {
      if (pillar.items.some((item) => (item.exact ? pathname === item.path : pathname.startsWith(item.path)))) {
        return pillar.id;
      }
    }
    return 'overview';
  }, [pathname]);

  const [activePillar, setActivePillar] = useState<PillarId>(currentPillarId);
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('datapath-theme') as 'dark' | 'light') || 'dark';
  });

  // Keep active pillar synchronized with route changes
  useEffect(() => {
    setActivePillar(currentPillarId);
  }, [currentPillarId]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('datapath-theme', next);
  };

  const currentPillarConfig = PILLARS.find((p) => p.id === activePillar) || PILLARS[0];

  const filteredItems = useMemo(() => {
    if (!filterQuery.trim()) return currentPillarConfig.items;
    const q = filterQuery.toLowerCase();
    return currentPillarConfig.items.filter((item) => item.label.toLowerCase().includes(q));
  }, [currentPillarConfig, filterQuery]);

  const handlePillarClick = (pillarId: PillarId) => {
    if (collapsed) {
      // If collapsed, clicking rail icon opens drawer
      onToggle();
    }
    setActivePillar(pillarId);
  };

  return (
    <>
      <div className={styles.twoTierSidebar}>
        {/* ========================================================= */}
        {/* TIER 1: Slim Primary Rail (58px)                          */}
        {/* ========================================================= */}
        <aside className={styles.primaryRail} aria-label="Ana Fonksiyonel Gezinti">
          {/* Brand Monogram */}
          <div className={styles.railBrand} onClick={() => navigate('/')} title="Datapath Database Intelligence">
            <div className={styles.brandEmblem}>
              <Database size={20} className={styles.brandIcon} />
            </div>
          </div>

          {/* Core Functional Pillars */}
          <nav className={styles.railNav}>
            {PILLARS.map((p) => {
              const Icon = p.icon;
              const isSelected = activePillar === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePillarClick(p.id)}
                  className={`${styles.railBtn} ${isSelected ? styles.railBtnActive : ''}`}
                  title={`${p.label} — ${p.description}`}
                  aria-label={p.label}
                >
                  <Icon size={20} className={styles.railIcon} />
                  <span className={styles.railShortLabel}>{p.shortLabel}</span>
                  {isSelected && <span className={styles.railActiveIndicator} />}
                </button>
              );
            })}
          </nav>

          {/* Rail Footer: Quick Actions & Status */}
          <div className={styles.railFooter}>
            <button
              type="button"
              className={styles.railActionBtn}
              onClick={() => setShowReportModal(true)}
              title="Genel Sistem Özeti ve Raporu"
              aria-label="Genel Sistem Özeti"
            >
              <FileText size={17} />
            </button>

            <button
              type="button"
              className={styles.railActionBtn}
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Aydınlık Tema' : 'Karanlık Tema'}
              aria-label="Tema Değiştir"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <div className={styles.railStatusDotBox} title="SQL Server: Canlı Bağlantı Aktif (mrcnn)">
              <span className={styles.railStatusDot} />
            </div>
          </div>
        </aside>

        {/* ========================================================= */}
        {/* TIER 2: Context Module Drawer (216px)                     */}
        {/* ========================================================= */}
        <aside
          className={`${styles.contextDrawer} ${collapsed ? styles.contextDrawerCollapsed : ''}`}
          aria-label="Modül Gezgini"
        >
          {/* Drawer Header */}
          <div className={styles.drawerHeader}>
            <div className={styles.drawerTitleRow}>
              <div className={styles.drawerPillarInfo}>
                <span className={styles.drawerCategoryLabel}>MODÜL</span>
                <h2 className={styles.drawerPillarTitle}>{currentPillarConfig.label}</h2>
              </div>
              <button
                type="button"
                className={styles.drawerCollapseBtn}
                onClick={onToggle}
                title={collapsed ? 'Modül Menüsünü Aç' : 'Modül Menüsünü Kapat'}
                aria-label="Gezgini Daralt/Genişlet"
              >
                {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
              </button>
            </div>

            {/* Quick Module Filter */}
            <div className={styles.drawerSearchBox}>
              <Search size={13} className={styles.drawerSearchIcon} />
              <input
                type="text"
                placeholder="Modüllerde filtrele..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className={styles.drawerSearchInput}
              />
            </div>
          </div>

          {/* Drawer Navigation Items */}
          <nav className={styles.drawerNav}>
            {filteredItems.length === 0 ? (
              <div className={styles.drawerEmptyNotice}>Eşleşen menü bulunamadı.</div>
            ) : (
              filteredItems.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.exact}
                    className={({ isActive }) =>
                      `${styles.drawerNavItem} ${isActive ? styles.drawerNavItemActive : ''}`
                    }
                  >
                    <ItemIcon size={16} className={styles.drawerNavIcon} />
                    <span className={styles.drawerNavLabel}>{item.label}</span>
                    {item.badge && <span className={styles.drawerNavBadge}>{item.badge}</span>}
                  </NavLink>
                );
              })
            )}
          </nav>

          {/* Drawer Footer: Engine & Instance Tag */}
          <div className={styles.drawerFooter}>
            <div className={styles.instanceCard}>
              <div className={styles.instanceTitleRow}>
                <span className={styles.instanceTag}>SQL SERVER</span>
                <span className={styles.instanceStatusTag}>Canlı</span>
              </div>
              <div className={styles.instanceHost}>localhost / mrcnn</div>
            </div>
          </div>
        </aside>
      </div>

      {showReportModal && <DossierReportModal onClose={() => setShowReportModal(false)} />}
    </>
  );
}
