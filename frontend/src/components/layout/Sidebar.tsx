import React from 'react';
import { NavLink } from 'react-router-dom';
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
  Layers,
  Hourglass,
  HardDrive,
  Cpu,
  CalendarClock,
  Radio,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import { brand } from '../../config/brand';
import styles from './Sidebar.module.css';

interface NavSection {
  title: string;
  items: {
    path: string;
    label: string;
    icon: LucideIcon;
    exact?: boolean;
  }[];
}

const navSections: NavSection[] = [
  {
    title: 'Genel Bakış',
    items: [
      { path: '/', label: 'Gösterge Paneli', icon: LayoutDashboard, exact: true },
      { path: '/instances', label: 'Sunucular & Bağlantı', icon: Server },
    ],
  },
  {
    title: 'Tanı & İzleme',
    items: [
      { path: '/incidents', label: 'Olay Merkezi', icon: AlertTriangle },
      { path: '/extended-events', label: 'Genişletilmiş Olaylar (XE)', icon: Radio },
      { path: '/query-performance', label: 'Sorgu Performansı', icon: TrendingUp },
      { path: '/indexes', label: 'İndeks Zekası', icon: Layers },
      { path: '/waits', label: 'Bekleme İstatistikleri', icon: Hourglass },
      { path: '/storage', label: 'Depolama & Dosyalar', icon: HardDrive },
      { path: '/tempdb', label: 'TempDB & Bellek', icon: Cpu },
      { path: '/backups', label: 'Yedekleme & Kurtarma', icon: Database },
      { path: '/high-availability', label: 'Yüksek Erişilebilirlik', icon: Activity },
    ],
  },
  {
    title: 'Yönetim & Araçlar',
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
  return (
    <aside
      className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}
    >
      {/* Top Header: Brand Emblem + Title + Collapse Toggle */}
      <div className={styles.logoHeader}>
        <div className={styles.brandBox}>
          <div className={styles.logoEmblem} title="Datapath Database Intelligence">
            <Activity size={17} className={styles.logoEmblemIcon} />
          </div>
          {!collapsed && (
            <div className={styles.logoInfo}>
              <div className={styles.brandTitleRow}>
                <span className={styles.logoName}>{brand.name}</span>
                <span className={styles.brandTag}>DBA</span>
              </div>
              <span className={styles.logoSubtitle}>Zeka Platformu</span>
            </div>
          )}
        </div>

        <button
          type="button"
          className={styles.collapseToggleBtn}
          onClick={onToggle}
          title={collapsed ? 'Menüyü Genişlet' : 'Menüyü Daralt'}
          aria-label={collapsed ? 'Menüyü Genişlet' : 'Menüyü Daralt'}
        >
          {collapsed ? (
            <PanelLeftOpen size={16} className={styles.toggleIcon} />
          ) : (
            <PanelLeftClose size={16} className={styles.toggleIcon} />
          )}
        </button>
      </div>

      {/* Categorized Navigation */}
      <nav className={styles.nav}>
        {navSections.map((section, idx) => (
          <div key={section.title} className={styles.sectionGroup}>
            {!collapsed ? (
              <div className={styles.navSectionLabel}>
                <span>{section.title}</span>
              </div>
            ) : (
              idx > 0 && <div className={styles.collapsedDivider} />
            )}

            <div className={styles.sectionItems}>
              {section.items.map(({ path, label, icon: Icon, exact }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={exact}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    `${styles.navItem}${isActive ? ` ${styles.active}` : ''}`
                  }
                >
                  <div className={styles.navIconBox}>
                    <Icon size={16} className={styles.navIcon} />
                  </div>
                  {!collapsed && <span className={styles.navLabel}>{label}</span>}
                  {!collapsed && <span className={styles.activePill} />}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer: SQL Engine Status */}
      <div className={styles.footer}>
        <div className={styles.engineCard} title="Microsoft SQL Server Engine Bağlantısı Aktif">
          <div className={styles.enginePulse}>
            <span className={styles.engineDot} />
            <span className={styles.engineDotRing} />
          </div>
          {!collapsed && (
            <div className={styles.engineInfo}>
              <span className={styles.engineTitle}>SQL Server Engine</span>
              <span className={styles.engineSub}>Bağlantı & İzleme Aktif</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
