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
      { path: '/query-performance', label: 'Sorgu Performansı', icon: TrendingUp },
      { path: '/backups', label: 'Yedekleme & Kurtarma', icon: Database },
      { path: '/high-availability', label: 'Yüksek Erişilebilirlik', icon: Activity },
    ],
  },
  {
    title: 'Yönetim & Araçlar',
    items: [
      { path: '/toolkit', label: 'DBA Araç Seti', icon: Wrench },
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
      {/* Top Header: Collapse Toggle button in place of logo */}
      <div className={styles.logoHeader}>
        <button
          type="button"
          className={styles.collapseToggleBtn}
          onClick={onToggle}
          title={collapsed ? 'Menüyü Genişlet' : 'Menüyü Daralt'}
          aria-label={collapsed ? 'Menüyü Genişlet' : 'Menüyü Daralt'}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} className={styles.toggleIcon} />
          ) : (
            <PanelLeftClose size={18} className={styles.toggleIcon} />
          )}
        </button>

        {!collapsed && (
          <div className={styles.logoText}>
            <span className={styles.logoName}>{brand.name}</span>
            <span className={styles.versionBadge}>v{brand.version}</span>
          </div>
        )}
      </div>

      {/* Categorized Navigation */}
      <nav className={styles.nav}>
        {navSections.map((section, idx) => (
          <div key={section.title} className={styles.sectionGroup}>
            {!collapsed ? (
              <div className={styles.navSectionLabel}>{section.title}</div>
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
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer info (Simple, static) */}
      <div className={styles.footer}>
        <div className={styles.engineBadge}>
          <div className={styles.engineStatusDot} />
          {!collapsed && (
            <div className={styles.engineInfo}>
              <span className={styles.engineTitle}>SQL Server İzleme</span>
              <span className={styles.engineSub}>{brand.tagline}</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
