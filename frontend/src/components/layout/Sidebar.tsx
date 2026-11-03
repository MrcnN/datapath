import React from 'react';
import { NavLink } from 'react-router-dom';
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
  Compass,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import { brand } from '../../config/brand';
import styles from './Sidebar.module.css';

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: string;
  badgeClass?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Genel Bakış & Filo',
    items: [
      { path: '/', label: 'Gösterge Paneli', icon: LayoutDashboard, exact: true },
      { path: '/instances', label: 'Sunucular & Bağlantı', icon: Server },
      {
        path: '/catalog',
        label: 'Modül Kataloğu',
        icon: Compass,
        badge: 'REHBER',
        badgeClass: styles.itemBadgeNew,
      },
    ],
  },
  {
    title: 'Sorgu & Performans Zekası',
    items: [
      { path: '/query-performance', label: 'Sorgu Performansı', icon: TrendingUp },
      {
        path: '/query-rewriter',
        label: 'Akıllı Sorgu İyileştirici',
        icon: Wand2,
        badge: 'YENİ',
        badgeClass: styles.itemBadgeSuccess,
      },
      {
        path: '/execution-plan',
        label: 'Grafiksel Yürütme Planı',
        icon: GitPullRequest,
      },
      { path: '/waits', label: 'Bekleme İstatistikleri', icon: Hourglass },
    ],
  },
  {
    title: 'İndeksler & Akıllı Bakım',
    items: [
      { path: '/indexes', label: 'İndeks Zekası', icon: Layers },
      {
        path: '/hypothetical-indexes',
        label: 'Hipotetik Simülatör',
        icon: FlaskConical,
        badge: 'WHAT-IF',
        badgeClass: styles.itemBadgeSuccess,
      },
      {
        path: '/maintenance-planner',
        label: 'Akıllı Bakım Planlayıcı',
        icon: Wrench,
        badge: 'JOB',
        badgeClass: styles.itemBadgeWarning,
      },
    ],
  },
  {
    title: 'Bellek, TempDB & Depolama',
    items: [
      { path: '/tempdb', label: 'TempDB & Bellek', icon: Cpu },
      {
        path: '/buffer-pool',
        label: 'Buffer Pool Tomografisi',
        icon: PieChart,
        badge: 'YENİ',
        badgeClass: styles.itemBadgeSuccess,
      },
      { path: '/storage', label: 'Depolama & Log Dosyaları', icon: HardDrive },
    ],
  },
  {
    title: 'Kriz, Güvenilirlik & Yedekleme',
    items: [
      {
        path: '/incidents',
        label: 'Olay Merkezi & Deadlock',
        icon: AlertTriangle,
        badge: 'RCA',
        badgeClass: styles.itemBadgeWarning,
      },
      { path: '/extended-events', label: 'Genişletilmiş Olaylar (XE)', icon: Radio },
      { path: '/backups', label: 'Yedekleme & Kurtarma', icon: Database },
      { path: '/high-availability', label: 'Yüksek Erişilebilirlik', icon: Activity },
    ],
  },
  {
    title: 'Yönetim, Güvenlik & Denetim',
    items: [
      {
        path: '/best-practices',
        label: 'Best Practice Karnesi',
        icon: ShieldCheck,
        badge: '16 KURAL',
        badgeClass: styles.itemBadgeSuccess,
      },
      { path: '/permissions', label: 'İzinler & Güvenlik', icon: Shield },
      { path: '/agent-jobs', label: 'SQL Agent & Alarmlar', icon: CalendarClock },
      { path: '/schema-diff', label: 'Şema Karşılaştırması', icon: GitCompare },
      { path: '/toolkit', label: 'DBA Araç Seti (Scripts)', icon: Terminal },
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
              {section.items.map(({ path, label, icon: Icon, exact, badge, badgeClass }) => (
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
                    <Icon size={15} className={styles.navIcon} />
                  </div>
                  {!collapsed && (
                    <>
                      <span className={styles.navLabel}>{label}</span>
                      {badge && (
                        <span className={`${styles.itemBadge} ${badgeClass || ''}`}>
                          {badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
