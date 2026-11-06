import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  TrendingUp,
  Layers,
  HardDrive,
  AlertTriangle,
  ShieldCheck,
  Terminal,
  Shield,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import { brand } from '../../config/brand';
import styles from './Sidebar.module.css';

export interface HubItem {
  id: string;
  path: string;
  label: string;
  icon: LucideIcon;
  description: string;
  exact?: boolean;
  matchPrefixes: string[];
}

export const primaryHubs: HubItem[] = [
  {
    id: 'dashboard',
    path: '/',
    label: 'Gösterge Paneli',
    icon: LayoutDashboard,
    exact: true,
    description: 'Sistem sağlık skoru, kriz durumu, Z-Score anomali radarı ve birleşik sistem telemetrisi.',
    matchPrefixes: ['/'],
  },
  {
    id: 'instances',
    path: '/instances',
    label: 'Canlı Kokpit & Süreçler',
    icon: Activity,
    description: 'Canlı sp_WhoIsActive oturumları, kök kilit bloklayıcılar, sunucu profilleri ve yapılandırma.',
    matchPrefixes: ['/instances'],
  },
  {
    id: 'queries',
    path: '/query-performance',
    label: 'Sorgu Zekâsı & Planlar',
    icon: TrendingUp,
    description: 'Query Store ağır sorgular, kardinalite sapması, sorgu düzeltici, .sqlplan ve bekleme istatistikleri.',
    matchPrefixes: ['/query-performance', '/cardinality-drift', '/query-rewriter', '/execution-plan', '/waits'],
  },
  {
    id: 'indexes',
    path: '/indexes',
    label: 'İndeks & Bakım Merkezi',
    icon: Layers,
    description: 'Eksik, kullanılmayan, parçalanmış indeksler, sanal indeks simülatörü ve akıllı bakım planlayıcı.',
    matchPrefixes: ['/indexes', '/hypothetical-indexes', '/maintenance-planner', '/statistics'],
  },
  {
    id: 'storage',
    path: '/storage',
    label: 'Depolama & Bellek',
    icon: HardDrive,
    description: 'MDF/LDF disk alanı, capacity runway disk dolum tahminleme, VLF, TempDB ve Buffer Pool.',
    matchPrefixes: ['/storage', '/capacity-runway', '/tempdb', '/buffer-pool'],
  },
  {
    id: 'incidents',
    path: '/incidents',
    label: 'Kriz & Güvenilirlik',
    icon: AlertTriangle,
    description: 'Canlı kilitlenmeler, Deadlock grafiği, AlwaysOn replikaları, yedekleme geçmişi ve Extended Events.',
    matchPrefixes: ['/incidents', '/extended-events', '/backups', '/high-availability'],
  },
  {
    id: 'best-practices',
    path: '/best-practices',
    label: 'Uygunluk & Güvenlik',
    icon: ShieldCheck,
    description: '16 kural mimari uygunluk karnesi, kullanıcı yetkileri, SQL Agent alarmları ve şema karşılaştırma.',
    matchPrefixes: ['/best-practices', '/permissions', '/agent-jobs', '/schema-diff'],
  },
];

export const footerHubs: HubItem[] = [
  {
    id: 'toolkit',
    path: '/toolkit',
    label: 'T-SQL Betikleri & Araçlar',
    icon: Terminal,
    description: 'Kategorize edilmiş, salt-okunur acil durum ve performans teşhis T-SQL betikleri.',
    matchPrefixes: ['/toolkit'],
  },
  {
    id: 'roles',
    path: '/role-management',
    label: 'Yetki & İzin Yönetimi',
    icon: Shield,
    description: 'Kıdemli DBA kontrol konsolu, rol izin matrisi ve yetki delegasyonu.',
    matchPrefixes: ['/role-management'],
  },
  {
    id: 'profile',
    path: '/profile',
    label: 'Profil & Ayarlar',
    icon: User,
    description: 'DBA operasyonel rolü, hesap ayarları ve parola güvenliği.',
    matchPrefixes: ['/profile'],
  },
];

// Backward-compatibility export
export interface NavSection {
  title: string;
  items: Array<{
    path: string;
    label: string;
    icon: LucideIcon;
    description: string;
    exact?: boolean;
  }>;
}

export const navSections: NavSection[] = [
  {
    title: 'Ana Modüller',
    items: primaryHubs.map((h) => ({
      path: h.path,
      label: h.label,
      icon: h.icon,
      description: h.description,
      exact: h.exact,
    })),
  },
  {
    title: 'Sistem & Araçlar',
    items: footerHubs.map((h) => ({
      path: h.path,
      label: h.label,
      icon: h.icon,
      description: h.description,
    })),
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { pathname } = useLocation();
  const [hoveredItem, setHoveredItem] = useState<{
    label: string;
    description: string;
    top: number;
    left: number;
  } | null>(null);

  const handleMouseEnter = (
    e: React.MouseEvent<HTMLAnchorElement>,
    label: string,
    description: string
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredItem({
      label,
      description,
      top: rect.top + rect.height / 2,
      left: rect.right + 10,
    });
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
  };

  const isHubActive = (hub: HubItem): boolean => {
    if (hub.exact) {
      return pathname === hub.path;
    }
    return hub.matchPrefixes.some((prefix) => {
      if (prefix === '/') return pathname === '/';
      return pathname === prefix || pathname.startsWith(prefix + '/');
    });
  };

  return (
    <>
      <aside
        className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}
        aria-label="Ana Gezinti Çubuğu"
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
            </div>
          )}
        </div>

        {/* Primary Hubs Navigation */}
        <nav className={styles.nav} aria-label="Merkezi Modüller">
          {!collapsed && <div className={styles.navSectionLabel}>YÖNETİM & TEŞHİS</div>}
          <div className={styles.hubList}>
            {primaryHubs.map((hub) => {
              const Icon = hub.icon;
              const active = isHubActive(hub);
              return (
                <NavLink
                  key={hub.id}
                  to={hub.path}
                  end={hub.exact}
                  className={`${styles.navItem} ${active ? styles.active : ''}`}
                  onMouseEnter={(e) => handleMouseEnter(e, hub.label, hub.description)}
                  onMouseLeave={handleMouseLeave}
                  title={collapsed ? `${hub.label} — ${hub.description}` : undefined}
                >
                  <div className={styles.navIconBox}>
                    <Icon size={16} className={styles.navIcon} />
                  </div>
                  {!collapsed && <span className={styles.navLabel}>{hub.label}</span>}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* Footer Utility Hubs */}
        <div className={styles.footerNav} aria-label="Sistem ve Ayarlar">
          {!collapsed && <div className={styles.navSectionLabel}>SİSTEM & ARAÇLAR</div>}
          <div className={styles.hubList}>
            {footerHubs.map((hub) => {
              const Icon = hub.icon;
              const active = isHubActive(hub);
              return (
                <NavLink
                  key={hub.id}
                  to={hub.path}
                  className={`${styles.navItem} ${active ? styles.active : ''}`}
                  onMouseEnter={(e) => handleMouseEnter(e, hub.label, hub.description)}
                  onMouseLeave={handleMouseLeave}
                  title={collapsed ? `${hub.label} — ${hub.description}` : undefined}
                >
                  <div className={styles.navIconBox}>
                    <Icon size={16} className={styles.navIcon} />
                  </div>
                  {!collapsed && <span className={styles.navLabel}>{hub.label}</span>}
                </NavLink>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Floating Hover Tooltip */}
      {hoveredItem && (
        <div
          className={styles.floatingTooltip}
          style={{
            position: 'fixed',
            top: hoveredItem.top,
            left: hoveredItem.left,
            transform: 'translateY(-50%)',
            zIndex: 99999,
            pointerEvents: 'none',
          }}
        >
          <div className={styles.tooltipTitle}>{hoveredItem.label}</div>
          <div className={styles.tooltipDesc}>{hoveredItem.description}</div>
        </div>
      )}
    </>
  );
}
