import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
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
  type LucideIcon,
} from 'lucide-react';
import styles from './GlobalCommandPalette.module.css';

export interface CommandItem {
  id: string;
  path: string;
  label: string;
  category: string;
  description: string;
  icon: LucideIcon;
  keywords: string[];
}

export const ALL_COMMAND_ITEMS: CommandItem[] = [
  // 1. Genel Bakış
  {
    id: 'dashboard',
    path: '/',
    label: 'Gösterge Paneli',
    category: 'Genel Bakış',
    description: 'Genel sağlık skoru, kriz durumu ve sistem kaynaklarının anlık birleşik özeti.',
    icon: LayoutDashboard,
    keywords: ['dashboard', 'panel', 'sağlık', 'health', 'özet', 'cpu', 'ram', 'kpi'],
  },
  {
    id: 'instances',
    path: '/instances',
    label: 'Canlı Oturumlar & Sunucular',
    category: 'Genel Bakış',
    description: 'sp_whoisactive seviyesinde çalışan sorgular, kök kilit bloklayıcıları ve çoklu sunucu profilleri.',
    icon: Server,
    keywords: ['oturum', 'session', 'spid', 'sp_whoisactive', 'sunucu', 'instance', 'profil', 'bağlantı'],
  },

  // 2. Sorgu & Performans
  {
    id: 'query-performance',
    path: '/query-performance',
    label: 'Ağır Sorgular & Query Store',
    category: 'Sorgu & Performans',
    description: 'En çok CPU, süre ve mantıksal I/O tüketen ağır sorgular ve plan gerilemeleri.',
    icon: TrendingUp,
    keywords: ['ağır sorgu', 'query store', 'expensive', 'yavaş', 'cpu', 'reads', 'gerileme', 'regression'],
  },
  {
    id: 'cardinality-drift',
    path: '/cardinality-drift',
    label: 'Kardinalite & Parameter Sniffing',
    category: 'Sorgu & Performans Zekâsı',
    description: 'Estimated vs Actual satır sayısı sapmaları (10x-500.000x), şişkin bellek ve sniffing analizi.',
    icon: GitCompare,
    keywords: ['kardinalite', 'cardinality', 'drift', 'sniffing', 'parameter', 'tahmin', 'actual', 'estimated', 'recompile'],
  },
  {
    id: 'query-rewriter',
    path: '/query-rewriter',
    label: 'Sorgu Düzeltici & İyileştirici',
    category: 'Sorgu & Performans',
    description: 'SARGable olmayan sorguları (YEAR, LEFT, COUNT, SELECT *) optimize edilmiş T-SQL koduna dönüştürür.',
    icon: Wand2,
    keywords: ['rewriter', 'iyileştirici', 'sargable', 'optimizasyon', 't-sql', 'anti-pattern', 'seek'],
  },
  {
    id: 'execution-plan',
    path: '/execution-plan',
    label: 'Sorgu Yürütme Planı (.sqlplan)',
    category: 'Sorgu & Performans',
    description: 'SSMS gerektirmeden .sqlplan / XML sorgu planlarını operatör ağacı olarak gösterir.',
    icon: GitPullRequest,
    keywords: ['plan', 'sqlplan', 'xml', 'execution plan', 'maliyet', 'cost', 'operatör', 'scan', 'seek'],
  },
  {
    id: 'waits',
    path: '/waits',
    label: 'Bekleme İstatistikleri',
    category: 'Sorgu & Performans',
    description: 'SQL Server\'ı yavaşlatan bekleme türlerini ve CPU kuyruk baskısını (Signal Wait) analiz eder.',
    icon: Hourglass,
    keywords: ['wait', 'bekleme', 'cxpacket', 'pageiolatch', 'lck', 'signal wait', 'kuyruk'],
  },

  // 3. İndeks & Bakım
  {
    id: 'indexes',
    path: '/indexes',
    label: 'İndeks Analizi',
    category: 'İndeks & Bakım',
    description: 'Eksik, kullanılmayan, mükerrer ve parçalanmış indeksleri detaylıca listeler.',
    icon: Layers,
    keywords: ['indeks', 'index', 'eksik', 'missing', 'unused', 'mükerrer', 'duplicate', 'fragmentation'],
  },
  {
    id: 'statistics',
    path: '/statistics',
    label: 'İstatistik Sağlığı & Bayatlık',
    category: 'İndeks & Bakım',
    description: 'Sorgu planı kardinalite tahminini bozan bayatlamış istatistikler ve otomatik güncelleme reçeteleri.',
    icon: BarChart3,
    keywords: ['istatistik', 'statistics', 'bayat', 'stale', 'sp_updatestats', 'kardinalite', 'modificaton_counter'],
  },
  {
    id: 'hypothetical-indexes',
    path: '/hypothetical-indexes',
    label: 'Sanal İndeks Simülatörü',
    category: 'İndeks & Bakım',
    description: 'Diske yazmadan (WITH STATISTICS_ONLY = -1) sanal indeks test eder ve maliyet kazanımını ölçer.',
    icon: FlaskConical,
    keywords: ['sanal indeks', 'hypothetical', 'what-if', 'simülatör', 'with statistics_only', 'maliyet testi'],
  },
  {
    id: 'maintenance-planner',
    path: '/maintenance-planner',
    label: 'İndeks Bakım Planlayıcı',
    category: 'İndeks & Bakım',
    description: 'Parçalanma oranına göre REORGANIZE/REBUILD operasyonlarını belirler ve hazır Agent Job üretir.',
    icon: Wrench,
    keywords: ['bakım', 'maintenance', 'reorganize', 'rebuild', 'job', 'parçalanma', 'fragmentation'],
  },

  // 4. Bellek & Depolama Analitiği
  {
    id: 'capacity-runway',
    path: '/capacity-runway',
    label: 'Kapasite & Runway Tahminleme',
    category: 'Bellek & Depolama Analitiği',
    description: 'Lineer regresyon ile disk dolum takvimi, tükenme gün sayısı (Runway Days) ve proaktif pre-sizing.',
    icon: HardDrive,
    keywords: ['kapasite', 'runway', 'disk', 'tükenme', 'forecasting', 'regresyon', 'büyüme', 'growth', 'pre-sizing'],
  },
  {
    id: 'tempdb',
    path: '/tempdb',
    label: 'TempDB & RAM Durumu',
    category: 'Bellek & Depolama',
    description: 'TempDB sayfa çekişmesi (GAM/SGAM/PFS), PLE, bellek dağılımı ve Plan Cache şişmesi analizi.',
    icon: Cpu,
    keywords: ['tempdb', 'ram', 'memory', 'ple', 'gam', 'sgam', 'pfs', 'page life expectancy', 'hafıza'],
  },
  {
    id: 'buffer-pool',
    path: '/buffer-pool',
    label: 'Tablo RAM Dağılımı (Buffer Pool)',
    category: 'Bellek & Depolama',
    description: 'Veritabanı bazında RAM\'de tutulan tablolar, kirli sayfalar (dirty pages) ve Checkpoint durumu.',
    icon: PieChart,
    keywords: ['buffer pool', 'tablo ram', 'dirty pages', 'checkpoint', 'hafıza dağılımı'],
  },
  {
    id: 'storage',
    path: '/storage',
    label: 'Disk & Log Dosyaları (VLF)',
    category: 'Bellek & Depolama',
    description: 'MDF/LDF disk alanı, okuma/yazma disk gecikmeleri (stall ms) ve Virtual Log File (VLF) şişmesi.',
    icon: HardDrive,
    keywords: ['disk', 'storage', 'vlf', 'log', 'mdf', 'ldf', 'stall', 'gecikme', 'alan'],
  },

  // 5. Kilitlenme & Güvenilirlik
  {
    id: 'incidents',
    path: '/incidents',
    label: 'Kilitlenmeler & Deadlock',
    category: 'Kilitlenme & Güvenilirlik',
    description: 'Canlı kilitlenme olayları, interaktif SVG Deadlock grafiği ve Olay Kök Neden (RCA) raporlayıcısı.',
    icon: AlertTriangle,
    keywords: ['kilit', 'deadlock', 'blocking', 'lock', 'olay', 'rca', 'spid', 'kill', 'zincir'],
  },
  {
    id: 'extended-events',
    path: '/extended-events',
    label: 'Genişletilmiş Olaylar (XE)',
    category: 'Kilitlenme & Güvenilirlik',
    description: 'SQL Server Extended Events oturum yönetimi ve ring_buffer / event_file hedef izleyicisi.',
    icon: Radio,
    keywords: ['extended events', 'xe', 'ring buffer', 'event file', 'canlı izleme', 'telemetri'],
  },
  {
    id: 'backups',
    path: '/backups',
    label: 'Yedekleme & Disk Sağlığı',
    category: 'Kilitlenme & Güvenilirlik',
    description: 'Full/Diff/Log yedekleme zinciri, RPO/RTO hedefleri, msdb geçmişi ve disk I/O sağlık denetimi.',
    icon: Database,
    keywords: ['yedek', 'backup', 'restore', 'rpo', 'rto', 'diff', 'log backup', 'kurtarma'],
  },
  {
    id: 'high-availability',
    path: '/high-availability',
    label: 'AlwaysOn & Replikalar',
    category: 'Kilitlenme & Güvenilirlik',
    description: 'AlwaysOn Availability Groups replika senkronizasyon durumu, gecikme (redo/log queue) analizi.',
    icon: Activity,
    keywords: ['alwayson', 'ha', 'ag', 'availability group', 'replica', 'failover', 'senkronizasyon'],
  },

  // 6. Güvenlik, Yönetim & Betikler
  {
    id: 'rbac',
    path: '/rbac',
    label: 'RBAC & Güvenlik Yetki Matrisi',
    category: 'Güvenlik, Yönetim & Betikler',
    description: 'Viewer (Salt Okunur), Operator ve Senior DBA rolleri için fonksiyonel yetki matrisi ve rol seçici.',
    icon: ShieldCheck,
    keywords: ['rbac', 'rol', 'yetki', 'role', 'viewer', 'operator', 'senior dba', 'güvenlik', 'izin'],
  },
  {
    id: 'best-practices',
    path: '/best-practices',
    label: 'Sistem Uygunluk Karnesi',
    category: 'Güvenlik & Yönetim',
    description: 'Microsoft & CIS kurallarına göre SQL Server yapılandırma ve güvenlik uyumluluk skoru.',
    icon: ShieldCheck,
    keywords: ['best practices', 'uygunluk', 'güvenlik', 'cis', 'skor', 'audit', 'denetim'],
  },
  {
    id: 'permissions',
    path: '/permissions',
    label: 'Kullanıcılar & Yetkiler',
    category: 'Güvenlik & Yönetim',
    description: 'sysadmin yetkileri, SQL / Windows oturumları, veritabanı kullanıcıları ve riskli rol eşleşmeleri.',
    icon: Shield,
    keywords: ['yetki', 'permission', 'kullanıcı', 'login', 'sysadmin', 'rol', 'güvenlik'],
  },
  {
    id: 'agent-jobs',
    path: '/agent-jobs',
    label: 'SQL Agent & Sistem Alarmları',
    category: 'Güvenlik & Yönetim',
    description: 'Zamanlanmış işler, başarısız adımlar (failed jobs), Database Mail durumu ve webhook bildirimleri.',
    icon: CalendarClock,
    keywords: ['agent', 'job', 'iş', 'alarm', 'mail', 'bildirim', 'webhook', 'başarısız'],
  },
  {
    id: 'schema-diff',
    path: '/schema-diff',
    label: 'Şema Karşılaştırma',
    category: 'Güvenlik & Yönetim',
    description: 'İki veritabanı arasındaki tablo, kolon, veri tipi ve indeks farklılıklarını karşılaştırır.',
    icon: GitCompare,
    keywords: ['şema', 'schema diff', 'karşılaştır', 'tablo', 'kolon', 'ddl', 'fark'],
  },
  {
    id: 'toolkit',
    path: '/toolkit',
    label: 'T-SQL Betik Kütüphanesi',
    category: 'Güvenlik & Yönetim',
    description: 'Kritik teşhis ve müdahale için önceden hazırlanmış onaylı DBA T-SQL sorgu şablonları.',
    icon: Terminal,
    keywords: ['toolkit', 'betik', 'script', 't-sql', 'kütüphane', 'şablon', 'reçete'],
  },
];

interface GlobalCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalCommandPalette({ isOpen, onClose }: GlobalCommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input on open, clear state
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // High performance filter with keyword matching
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_COMMAND_ITEMS;

    return ALL_COMMAND_ITEMS.filter((item) => {
      if (item.label.toLowerCase().includes(q)) return true;
      if (item.category.toLowerCase().includes(q)) return true;
      if (item.description.toLowerCase().includes(q)) return true;
      return item.keywords.some((k) => k.toLowerCase().includes(q));
    });
  }, [query]);

  // Ensure selected index stays within bounds
  useEffect(() => {
    setSelectedIndex((prev) => {
      if (filteredItems.length === 0) return 0;
      return Math.min(prev, filteredItems.length - 1);
    });
  }, [filteredItems.length]);

  // Scroll active item into view smoothly
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Navigation handler
  const handleSelect = useCallback(
    (item: CommandItem) => {
      navigate(item.path);
      onClose();
    },
    [navigate, onClose]
  );

  // Accessible keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredItems.length ? (prev + 1) % filteredItems.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredItems.length ? (prev - 1 + filteredItems.length) % filteredItems.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleSelect(filteredItems[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, handleSelect, onClose]);

  if (!isOpen) return null;

  const activeItem = filteredItems[selectedIndex];
  const activeDescendantId = activeItem ? `command-item-${activeItem.id}` : undefined;

  return (
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Evrensel Arama ve Komut Paleti"
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Search Input Bar (WCAG Combobox Pattern) */}
        <div className={styles.searchHeader}>
          <Search size={16} className={styles.searchIcon} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-controls="command-palette-results"
            aria-activedescendant={activeDescendantId}
            aria-label="Sayfa veya araç ara"
            className={styles.input}
            placeholder="Sayfa, metrik veya T-SQL aracı ara (örn: deadlock, cpu, tempdb, index)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className={styles.escBadge} aria-label="Kapatmak için Escape tuşu">ESC</span>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          id="command-palette-results"
          role="listbox"
          aria-label="Eşleşen Komutlar"
          className={styles.resultsList}
        >
          {filteredItems.length === 0 ? (
            <div className={styles.emptyState}>
              <span>"{query}" araması ile eşleşen sayfa veya araç bulunamadı.</span>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  id={`command-item-${item.id}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className={styles.itemLeft}>
                    <div className={styles.itemIconBox}>
                      <Icon size={15} aria-hidden="true" />
                    </div>
                    <div className={styles.itemContent}>
                      <span className={styles.itemLabel}>{item.label}</span>
                      <span className={styles.itemDesc}>{item.description}</span>
                    </div>
                  </div>

                  <div className={styles.itemRight}>
                    <span className={styles.itemCategoryPill}>{item.category}</span>
                    {isSelected && <span className={styles.enterHint} aria-hidden="true">Git ↵</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info bar */}
        <div className={styles.footer} aria-hidden="true">
          <div className={styles.footerHints}>
            <span className={styles.keyHint}>
              <span className={styles.kbd}>↑</span>
              <span className={styles.kbd}>↓</span> Gezin
            </span>
            <span className={styles.keyHint}>
              <span className={styles.kbd}>↵</span> Seç
            </span>
            <span className={styles.keyHint}>
              <span className={styles.kbd}>ESC</span> Kapat
            </span>
          </div>
          <span>{filteredItems.length} araç listelendi</span>
        </div>
      </div>
    </div>
  );
}
