import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  TrendingUp,
  GitCompare,
  Wand2,
  GitPullRequest,
  Hourglass,
  Layers,
  FlaskConical,
  Wrench,
  BarChart3,
  HardDrive,
  Cpu,
  PieChart,
  AlertTriangle,
  Radio,
  Database,
  Activity,
  ShieldCheck,
  Shield,
  ShieldAlert,
  CalendarClock,
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
  description: string;
  exact?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: 'Gözlem & Canlı Kokpit',
    items: [
      {
        path: '/',
        label: 'Gösterge Paneli',
        icon: LayoutDashboard,
        description: 'Sistem sağlık skoru, kriz durumu, Z-Score anomali radarı ve birleşik sistem telemetrisi.',
        exact: true,
      },
      {
        path: '/instances',
        label: 'Canlı Oturumlar & Sunucular',
        icon: Server,
        description: 'Canlı sp_whoisactive seviyesinde çalışan oturumlar, kök kilit bloklayıcıları ve çoklu sunucular.',
      },
    ],
  },
  {
    title: 'Sorgu & Performans Zekâsı',
    items: [
      {
        path: '/query-performance',
        label: 'Ağır Sorgular & Query Store',
        icon: TrendingUp,
        description: 'En çok CPU, süre ve mantıksal I/O tüketen ağır sorgular ve plan gerilemeleri (regressions).',
      },
      {
        path: '/cardinality-drift',
        label: 'Kardinalite & Parameter Sniffing',
        icon: GitCompare,
        description: 'Estimated vs Actual satır sayısı sapmaları (10x-500.000x), şişkin bellek ve sniffing analizi.',
      },
      {
        path: '/query-rewriter',
        label: 'Sorgu Düzeltici & İyileştirici',
        icon: Wand2,
        description: 'SARGable olmayan sorguları (YEAR, LEFT, COUNT, SELECT *) optimize edilmiş T-SQL koduna dönüştürür.',
      },
      {
        path: '/execution-plan',
        label: 'Sorgu Yürütme Planı (.sqlplan)',
        icon: GitPullRequest,
        description: 'SSMS gerektirmeden .sqlplan / XML sorgu planlarını operatör ağacı olarak interaktif gösterir.',
      },
      {
        path: '/waits',
        label: 'Bekleme İstatistikleri (Waits)',
        icon: Hourglass,
        description: 'SQL Server darboğazlarını, kaynak beklemelerini ve CPU kuyruk baskısını (Signal Wait) analiz eder.',
      },
    ],
  },
  {
    title: 'İndeks & Kardinalite Bakımı',
    items: [
      {
        path: '/indexes',
        label: 'İndeks Analizi & Parçalanma',
        icon: Layers,
        description: 'Eksik, kullanılmayan, mükerrer ve parçalanmış indeksleri detaylıca listeler.',
      },
      {
        path: '/hypothetical-indexes',
        label: 'Sanal İndeks Simülatörü',
        icon: FlaskConical,
        description: 'Diske yazmadan (WITH STATISTICS_ONLY = -1) sanal indeks test eder ve maliyet kazanımını ölçer.',
      },
      {
        path: '/maintenance-planner',
        label: 'İndeks Bakım Planlayıcı',
        icon: Wrench,
        description: 'Parçalanma oranına göre REORGANIZE/REBUILD operasyonlarını belirler ve hazır Agent Job üretir.',
      },
      {
        path: '/statistics',
        label: 'İstatistik Sağlığı & Bayatlık',
        icon: BarChart3,
        description: 'Kardinalite tahminini bozan bayatlamış istatistikler ve otomatik güncelleme reçeteleri.',
      },
    ],
  },
  {
    title: 'Bellek & Depolama Analitiği',
    items: [
      {
        path: '/capacity-runway',
        label: 'Kapasite & Runway Tahminleme',
        icon: HardDrive,
        description: 'Lineer regresyon ile disk dolum takvimi, tükenme gün sayısı (Runway Days) ve proaktif pre-sizing.',
      },
      {
        path: '/storage',
        label: 'Disk Dosyaları & VLF Mimarisi',
        icon: Database,
        description: 'MDF/LDF disk alanı, okuma/yazma gecikmeleri (stall ms) ve Virtual Log File (VLF) şişmesi.',
      },
      {
        path: '/tempdb',
        label: 'TempDB & Çekişme Analizi',
        icon: Cpu,
        description: 'TempDB sayfa çekişmesi (GAM/SGAM/PFS), PLE, bellek dağılımı ve Plan Cache şişmesi analizi.',
      },
      {
        path: '/buffer-pool',
        label: 'Tablo RAM Dağılımı (Buffer Pool)',
        icon: PieChart,
        description: "Veritabanı bazında RAM'de tutulan tablolar, kirli sayfalar (dirty pages) ve Checkpoint durumu.",
      },
    ],
  },
  {
    title: 'Kilitlenme & Güvenilirlik',
    items: [
      {
        path: '/incidents',
        label: 'Kilitlenmeler & Deadlock Radarı',
        icon: AlertTriangle,
        description: 'Canlı kilitlenme olayları, interaktif SVG Deadlock grafiği ve Olay Kök Neden (RCA) raporlayıcısı.',
      },
      {
        path: '/extended-events',
        label: 'Genişletilmiş Olaylar (XE)',
        icon: Radio,
        description: 'SQL Server Extended Events oturum yönetimi ve system_health ring_buffer olay izleyicisi.',
      },
      {
        path: '/backups',
        label: 'Yedekleme & Disk Sağlığı',
        icon: Database,
        description: 'Yedekleme geçmişi, RPO riski, son temiz CHECKDB tarihi ve suspect_pages bozuk sayfa radarı.',
      },
      {
        path: '/high-availability',
        label: 'AlwaysOn & Replikalar',
        icon: Activity,
        description: 'AlwaysOn AG replika sağlık durumları, senkronizasyon gecikmesi ve yük devretme hazırlığı.',
      },
    ],
  },
  {
    title: 'Güvenlik, Yönetim & Betikler',
    items: [
      {
        path: '/permissions',
        label: 'Kullanıcılar & Yetkiler',
        icon: Shield,
        description: 'Sunucu loginleri, sysadmin rol üyeleri, yetim kullanıcılar ve veritabanı rol izinleri denetimi.',
      },
      {
        path: '/best-practices',
        label: 'Sistem Uygunluk Karnesi',
        icon: ShieldAlert,
        description: 'MAXDOP, Cost Threshold ve TempDB dahil 16 kritik mimari kurala göre sunucuyu puanlar.',
      },
      {
        path: '/agent-jobs',
        label: 'SQL Agent & Sistem Alarmları',
        icon: CalendarClock,
        description: 'Zamanlanmış işler, başarısız adımlar, sysalerts kritik sistem alarmları ve Database Mail durumu.',
      },
      {
        path: '/schema-diff',
        label: 'Şema Karşılaştırma (Diff)',
        icon: GitCompare,
        description: 'İki veritabanı arasındaki tablo, kolon ve indeks farklarını karşılaştırır; güvenli DDL üretir.',
      },
      {
        path: '/toolkit',
        label: 'DBA T-SQL Betik Kütüphanesi',
        icon: Terminal,
        description: 'Kategorize edilmiş, salt-okunur güvenli acil durum müdahale ve performans teşhis T-SQL betikleri.',
      },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
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

  return (
    <>
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
                {section.items.map(({ path, label, icon: Icon, description, exact }) => (
                  <NavLink
                    key={path}
                    to={path}
                    end={exact}
                    title={`${label} — ${description}`}
                    onMouseEnter={(e) => handleMouseEnter(e, label, description)}
                    onMouseLeave={handleMouseLeave}
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
