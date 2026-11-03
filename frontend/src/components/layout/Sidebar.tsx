import React, { useState } from 'react';
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
  description: string;
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
      {
        path: '/',
        label: 'Gösterge Paneli',
        icon: LayoutDashboard,
        description: 'Genel sağlık skoru, kriz durumu ve sistem kaynaklarının anlık birleşik özeti.',
        exact: true,
      },
      {
        path: '/instances',
        label: 'Canlı Oturumlar & Sunucular',
        icon: Server,
        description: 'Canlı sp_whoisactive seviyesinde çalışan sorgular, kök kilit bloklayıcıları ve çoklu sunucu profilleri.',
      },
    ],
  },
  {
    title: 'Sorgu & Performans',
    items: [
      {
        path: '/query-performance',
        label: 'Ağır Sorgular & Query Store',
        icon: TrendingUp,
        description: 'En çok CPU, süre ve mantıksal I/O tüketen ağır sorgular ve plan gerilemeleri.',
      },
      {
        path: '/query-rewriter',
        label: 'Sorgu Düzeltici & İyileştirici',
        icon: Wand2,
        description: 'SARGable olmayan sorguları (YEAR, LEFT, COUNT, SELECT *) optimize edilmiş T-SQL koduna dönüştürür.',
      },
      {
        path: '/execution-plan',
        label: 'Sorgu Yürütme Planı',
        icon: GitPullRequest,
        description: 'SSMS gerektirmeden .sqlplan / XML sorgu planlarını operatör ağacı olarak gösterir.',
      },
      {
        path: '/waits',
        label: 'Bekleme İstatistikleri',
        icon: Hourglass,
        description: 'SQL Server\'ı yavaşlatan bekleme türlerini ve CPU kuyruk baskısını (Signal Wait) analiz eder.',
      },
    ],
  },
  {
    title: 'İndeks & Bakım',
    items: [
      {
        path: '/indexes',
        label: 'İndeks Analizi',
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
    ],
  },
  {
    title: 'Bellek & Depolama',
    items: [
      {
        path: '/tempdb',
        label: 'TempDB & RAM Durumu',
        icon: Cpu,
        description: 'TempDB sayfa çekişmesi (GAM/SGAM/PFS), PLE, bellek dağılımı ve Plan Cache şişmesi analizi.',
      },
      {
        path: '/buffer-pool',
        label: 'Tablo RAM Dağılımı (Buffer Pool)',
        icon: PieChart,
        description: 'Veritabanı bazında RAM\'de tutulan tablolar, kirli sayfalar (dirty pages) ve Checkpoint durumu.',
      },
      {
        path: '/storage',
        label: 'Disk & Log Dosyaları (VLF)',
        icon: HardDrive,
        description: 'MDF/LDF disk alanı, okuma/yazma disk gecikmeleri (stall ms) ve Virtual Log File (VLF) şişmesi.',
      },
    ],
  },
  {
    title: 'Kilitlenme & Güvenilirlik',
    items: [
      {
        path: '/incidents',
        label: 'Kilitlenmeler & Deadlock',
        icon: AlertTriangle,
        description: 'Canlı kilitlenme olayları, interaktif SVG Deadlock grafiği ve Olay Kök Neden (RCA) raporlayıcısı.',
      },
      {
        path: '/extended-events',
        label: 'Genişletilmiş Olaylar (XE)',
        icon: Radio,
        description: 'SQL Server Extended Events oturum yönetimi ve ring_buffer / event_file hedef izleyicisi.',
      },
      {
        path: '/backups',
        label: 'Yedekleme & Disk Sağlığı',
        icon: Database,
        description: 'Son yedekleme geçmişi, RPO veri kaybı riski ve suspect_pages bozuk disk sayfası radarı.',
      },
      {
        path: '/high-availability',
        label: 'AlwaysOn & Replikalar',
        icon: Activity,
        description: 'AlwaysOn Availability Groups replika durumları, senkronizasyon kuyruğu ve gecikme analizi.',
      },
    ],
  },
  {
    title: 'Güvenlik & Yönetim',
    items: [
      {
        path: '/best-practices',
        label: 'Sistem Uygunluk Karnesi',
        icon: ShieldCheck,
        description: 'MAXDOP, Cost Threshold ve TempDB dahil 16 kritik mimari kurala göre sunucuyu puanlar.',
      },
      {
        path: '/permissions',
        label: 'Kullanıcılar & Yetkiler',
        icon: Shield,
        description: 'Sunucu loginleri, sysadmin rol üyeleri, yetim kullanıcılar ve veritabanı rol izinleri denetimi.',
      },
      {
        path: '/agent-jobs',
        label: 'SQL Agent & Sistem Alarmları',
        icon: CalendarClock,
        description: 'Zamanlanmış işler, başarısız adımlar, sysalerts kritik sistem alarmları ve Database Mail durumu.',
      },
      {
        path: '/schema-diff',
        label: 'Şema Karşılaştırma',
        icon: GitCompare,
        description: 'İki veritabanı arasındaki tablo, kolon ve indeks farklarını karşılaştırır; güvenli DDL üretir.',
      },
      {
        path: '/toolkit',
        label: 'T-SQL Betik Kütüphanesi',
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
