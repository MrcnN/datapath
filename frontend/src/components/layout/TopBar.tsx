import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
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
  Sun,
  Moon,
  type LucideIcon,
} from 'lucide-react';
import { getInstanceMetadata } from '../../lib/api';
import type { InstanceMetadata } from '../../lib/types';
import styles from './TopBar.module.css';

interface RouteInfo {
  label: string;
  category: string;
  icon: LucideIcon;
}

const routeMap: Record<string, RouteInfo> = {
  '/': { label: 'Gösterge Paneli', category: 'Genel Bakış', icon: LayoutDashboard },
  '/instances': { label: 'Sunucular & Bağlantı', category: 'Genel Bakış', icon: Server },
  '/incidents': { label: 'Olay Merkezi', category: 'Tanı & İzleme', icon: AlertTriangle },
  '/query-performance': { label: 'Sorgu Performansı', category: 'Tanı & İzleme', icon: TrendingUp },
  '/indexes': { label: 'İndeks Zekası', category: 'Tanı & İzleme', icon: Layers },
  '/waits': { label: 'Bekleme İstatistikleri', category: 'Tanı & İzleme', icon: Hourglass },
  '/storage': { label: 'Depolama & Dosyalar', category: 'Tanı & İzleme', icon: HardDrive },
  '/tempdb': { label: 'TempDB & Bellek', category: 'Tanı & İzleme', icon: Cpu },
  '/backups': { label: 'Yedekleme & Kurtarma', category: 'Tanı & İzleme', icon: Database },
  '/high-availability': { label: 'Yüksek Erişilebilirlik', category: 'Tanı & İzleme', icon: Activity },
  '/toolkit': { label: 'DBA Araç Seti', category: 'Yönetim & Araçlar', icon: Wrench },
  '/schema-diff': { label: 'Şema Karşılaştırması', category: 'Yönetim & Araçlar', icon: GitCompare },
  '/permissions': { label: 'İzinler & Güvenlik', category: 'Yönetim & Araçlar', icon: Shield },
};

interface TopBarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function TopBar({ collapsed, onToggle }: TopBarProps) {
  const { pathname } = useLocation();
  const currentRoute = routeMap[pathname] || {
    label: 'Sayfa',
    category: 'Traceforge',
    icon: Sparkles,
  };
  const [metadata, setMetadata] = useState<InstanceMetadata | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('datapath-theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('datapath-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

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
  }, [pathname]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

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

      {/* Right: Theme Toggle, Clock & Connection Status Badge */}
      <div className={styles.rightSection}>
        <button
          type="button"
          className={styles.themeToggleBtn}
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Aydınlık Temaya Geç' : 'Karanlık Temaya Geç'}
          aria-label={theme === 'dark' ? 'Aydınlık Temaya Geç' : 'Karanlık Temaya Geç'}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <div className={styles.clockPill} title="İstemci Saati">
          <Clock size={12} className={styles.clockIcon} />
          <span>{currentTime}</span>
        </div>

        <div
          className={`${styles.connectionBadge} ${
            isConnected ? styles.connected : styles.demoMode
          }`}
          title={
            metadata?.server_name
              ? `Sunucu: ${metadata.server_name} | Sürüm: ${metadata.product_version ?? 'SQL Server'}`
              : 'SQL Server Durumu'
          }
        >
          <span className={styles.statusDot} />
          <span className={styles.statusLabel}>
            {isConnected && metadata?.server_name
              ? `Canlı: ${metadata.server_name}`
              : 'Demo Modu'}
          </span>
          {isConnected && metadata?.edition && (
            <span className={styles.editionTag}>
              {metadata.edition.replace(' Edition', '').replace('SQL Server ', '')}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
