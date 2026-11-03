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
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Genel Bakış',
    items: [
      { path: '/', label: 'Gösterge Paneli', icon: LayoutDashboard, exact: true },
      { path: '/instances', label: 'Canlı Oturumlar & Sunucular', icon: Server },
    ],
  },
  {
    title: 'Sorgu & Performans',
    items: [
      { path: '/query-performance', label: 'Ağır Sorgular & Query Store', icon: TrendingUp },
      { path: '/query-rewriter', label: 'Sorgu Düzeltici & İyileştirici', icon: Wand2 },
      { path: '/execution-plan', label: 'Sorgu Yürütme Planı', icon: GitPullRequest },
      { path: '/waits', label: 'Bekleme İstatistikleri', icon: Hourglass },
    ],
  },
  {
    title: 'İndeks & Bakım',
    items: [
      { path: '/indexes', label: 'İndeks Analizi', icon: Layers },
      { path: '/hypothetical-indexes', label: 'Sanal İndeks Simülatörü', icon: FlaskConical },
      { path: '/maintenance-planner', label: 'İndeks Bakım Planlayıcı', icon: Wrench },
    ],
  },
  {
    title: 'Bellek & Depolama',
    items: [
      { path: '/tempdb', label: 'TempDB & RAM Durumu', icon: Cpu },
      { path: '/buffer-pool', label: 'Tablo RAM Dağılımı (Buffer Pool)', icon: PieChart },
      { path: '/storage', label: 'Disk & Log Dosyaları (VLF)', icon: HardDrive },
    ],
  },
  {
    title: 'Kilitlenme & Güvenilirlik',
    items: [
      { path: '/incidents', label: 'Kilitlenmeler & Deadlock', icon: AlertTriangle },
      { path: '/extended-events', label: 'Genişletilmiş Olaylar (XE)', icon: Radio },
      { path: '/backups', label: 'Yedekleme & Disk Sağlığı', icon: Database },
      { path: '/high-availability', label: 'AlwaysOn & Replikalar', icon: Activity },
    ],
  },
  {
    title: 'Güvenlik & Yönetim',
    items: [
      { path: '/best-practices', label: 'Sistem Uygunluk Karnesi', icon: ShieldCheck },
      { path: '/permissions', label: 'Kullanıcılar & Yetkiler', icon: Shield },
      { path: '/agent-jobs', label: 'SQL Agent & Sistem Alarmları', icon: CalendarClock },
      { path: '/schema-diff', label: 'Şema Karşılaştırma', icon: GitCompare },
      { path: '/toolkit', label: 'T-SQL Betik Kütüphanesi', icon: Terminal },
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
                    <Icon size={15} className={styles.navIcon} />
                  </div>
                  {!collapsed && <span className={styles.navLabel}>{label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
