import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
  Search,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import styles from './CatalogPage.module.css';

interface ModuleItem {
  id: string;
  title: string;
  category: string;
  path: string;
  icon: LucideIcon;
  description: string;
  technicalSource: string;
  keywords: string[];
}

const MODULE_REGISTRY: ModuleItem[] = [
  // 1. Genel Bakış
  {
    id: 'dashboard',
    title: 'Gösterge Paneli',
    category: 'Genel Bakış',
    path: '/',
    icon: LayoutDashboard,
    description: 'Bütünleşik sağlık skoru (Health Score), aktif krizler, kaynak bekleme oranları ve anlık sistem metrikleri özeti.',
    technicalSource: 'dm_os_wait_stats, sysalerts, PLE',
    keywords: ['dashboard', 'sağlık', 'health', 'kpi', 'özet', 'skor', 'genel bakış'],
  },
  {
    id: 'instances',
    title: 'Canlı Oturumlar & Sunucular',
    category: 'Genel Bakış',
    path: '/instances',
    icon: Server,
    description: 'Canlı sp_whoisactive seviyesinde aktif sorgu oturumları, kök kilit bloklayıcıları ve çoklu sunucu ortam geçişi.',
    technicalSource: 'sys.dm_exec_requests, sys.dm_exec_sessions',
    keywords: ['sunucu', 'oturum', 'session', 'whoisactive', 'sp_whoisactive', 'bağlantı', 'instances'],
  },

  // 2. Sorgu & Performans
  {
    id: 'query-performance',
    title: 'Ağır Sorgular & Query Store',
    category: 'Sorgu & Performans',
    path: '/query-performance',
    icon: TrendingUp,
    description: 'En çok CPU, süre ve mantıksal I/O tüketen sorgular, yürütme planı gerilemeleri (regressions) ve anti-pattern radarı.',
    technicalSource: 'sys.query_store_runtime_stats, dm_exec_query_stats',
    keywords: ['sorgu', 'query', 'performans', 'query store', 'en maliyetli', 'gerileme', 'regression', 'cpu'],
  },
  {
    id: 'query-rewriter',
    title: 'Sorgu Düzeltici & İyileştirici',
    category: 'Sorgu & Performans',
    path: '/query-rewriter',
    icon: Wand2,
    description: 'SARGable olmayan anti-desenleri (YEAR, LEFT, COUNT(*), SELECT *, leading wildcard) tespit eder; Index Seek uyumlu optimize T-SQL diff üretir.',
    technicalSource: 'T-SQL AST & Regex Optimizasyon Motoru',
    keywords: ['sorgu iyileştirici', 'rewriter', 'sargable', 'anti-pattern', 'diff', 'seek', 'optimize', 'year', 'left'],
  },
  {
    id: 'execution-plan',
    title: 'Sorgu Yürütme Planı',
    category: 'Sorgu & Performans',
    path: '/execution-plan',
    icon: GitPullRequest,
    description: 'SSMS gerektirmeyen ShowPlanXML interaktif operatör ağacı; maliyet %, uyarı rozetleri, spill ve eksik indeks tespiti.',
    technicalSource: 'sys.dm_exec_query_plan, .sqlplan XML',
    keywords: ['yürütme planı', 'execution plan', 'sqlplan', 'showplan', 'operatör', 'maliyet', 'ağaç', 'spill'],
  },
  {
    id: 'waits',
    title: 'Bekleme İstatistikleri',
    category: 'Sorgu & Performans',
    path: '/waits',
    icon: Hourglass,
    description: 'SQL Server kaynak beklemeleri, kümülatif bekleme türleri ve CPU baskısını teşhis eden Signal Wait oranı göstergesi.',
    technicalSource: 'sys.dm_os_wait_stats, Signal vs Resource Wait',
    keywords: ['bekleme', 'wait stats', 'signal wait', 'cxpacket', 'pageiolatch', 'sos_scheduler_yield', 'darboğaz'],
  },

  // 3. İndeks & Bakım
  {
    id: 'indexes',
    title: 'İndeks Analizi',
    category: 'İndeks & Bakım',
    path: '/indexes',
    icon: Layers,
    description: 'SQL Server Query Optimizer eksik indeks önerileri, hiç okunmayan kullanılmayan indeksler, mükerrer indeksler ve parçalanma.',
    technicalSource: 'sys.dm_db_missing_index_details, index_usage_stats',
    keywords: ['indeks', 'index', 'eksik indeks', 'kullanılmayan', 'parçalanma', 'fragmentation', 'mükerrer', 'redundant'],
  },
  {
    id: 'hypothetical-indexes',
    title: 'Sanal İndeks Simülatörü',
    category: 'İndeks & Bakım',
    path: '/hypothetical-indexes',
    icon: FlaskConical,
    description: 'Diske tek bayt yazmadan WITH STATISTICS_ONLY = -1 mimarisiyle sanal indeks oluşturur ve sorgunun tahmini maliyet kazanımını simüle eder.',
    technicalSource: 'WITH STATISTICS_ONLY = -1, AUTOCREATE',
    keywords: ['what-if', 'hipotetik', 'sanal indeks', 'hypothetical', 'simülatör', 'zero-disk', 'maliyet', 'optimizer'],
  },
  {
    id: 'maintenance-planner',
    title: 'İndeks Bakım Planlayıcı',
    category: 'İndeks & Bakım',
    path: '/maintenance-planner',
    icon: Wrench,
    description: 'Sayfa sayısı ve parçalanma eşikli REORGANIZE/REBUILD ayrımı, istatistik tazeleme ve tek tıkla kopyalanabilir SQL Agent bakım işi üretimi.',
    technicalSource: 'sys.dm_db_index_physical_stats, ALTER INDEX',
    keywords: ['bakım', 'maintenance', 'defrag', 'rebuild', 'reorganize', 'istatistik', 'update statistics', 'agent job'],
  },

  // 4. Bellek & Depolama
  {
    id: 'tempdb',
    title: 'TempDB & RAM Durumu',
    category: 'Bellek & Depolama',
    path: '/tempdb',
    icon: Cpu,
    description: 'TempDB GAM/SGAM/PFS sayfa çekişmesi, oturum alan sızıntıları, Page Life Expectancy (PLE) ve Plan Cache Bloat analizi.',
    technicalSource: 'sys.dm_os_waiting_tasks, sys.dm_db_session_space_usage',
    keywords: ['tempdb', 'bellek', 'ram', 'ple', 'pagelatch', 'gam', 'sgam', 'pfs', 'plan cache', 'bloat', 'memory grants'],
  },
  {
    id: 'buffer-pool',
    title: 'Tablo RAM Dağılımı (Buffer Pool)',
    category: 'Bellek & Depolama',
    path: '/buffer-pool',
    icon: PieChart,
    description: 'Veritabanı bazında RAM nesne dağılımı, diske henüz yazılmamış kirli sayfalar (dirty pages) ve kontrollü CHECKPOINT yönergeleri.',
    technicalSource: 'sys.dm_os_buffer_descriptors, CHECKPOINT',
    keywords: ['buffer pool', 'tomografi', 'kirli sayfa', 'dirty pages', 'clean pages', 'checkpoint', 'ram nesne'],
  },
  {
    id: 'storage',
    title: 'Disk & Log Dosyaları (VLF)',
    category: 'Bellek & Depolama',
    path: '/storage',
    icon: HardDrive,
    description: 'MDF/LDF disk alanı, okuma/yazma disk gecikmeleri (stall ms), Virtual Log File (VLF) şişmesi ve açık kalan işlemler.',
    technicalSource: 'sys.dm_io_virtual_file_stats, DBCC LOGINFO',
    keywords: ['depolama', 'disk', 'storage', 'vlf', 'log', 'mdf', 'ldf', 'gecikme', 'stall', 'open transaction'],
  },

  // 5. Kilitlenme & Güvenilirlik
  {
    id: 'incidents',
    title: 'Kilitlenmeler & Deadlock',
    category: 'Kilitlenme & Güvenilirlik',
    path: '/incidents',
    icon: AlertTriangle,
    description: 'Canlı kilitlenmeler, interaktif SVG Deadlock döngü grafiği, SQL Server hata günlükleri ve kurumsal RCA Post-Mortem raporlayıcısı.',
    technicalSource: 'system_health XE, deadlock-list XML, RCA Generator',
    keywords: ['olay', 'kriz', 'incident', 'deadlock', 'kilitlenme', 'rca', 'post-mortem', 'hata günlüğü', 'errorlog'],
  },
  {
    id: 'extended-events',
    title: 'Genişletilmiş Olaylar (XE)',
    category: 'Kilitlenme & Güvenilirlik',
    path: '/extended-events',
    icon: Radio,
    description: 'SQL Server Extended Events oturum yönetimi, ring_buffer ve event_file hedef ayrıştırıcısı ile derin kernel düzeyinde izleme.',
    technicalSource: 'sys.dm_xe_sessions, sys.dm_xe_session_targets',
    keywords: ['extended events', 'xe', 'olaylar', 'ring buffer', 'event file', 'izleme', 'profiler'],
  },
  {
    id: 'backups',
    title: 'Yedekleme & Disk Sağlığı',
    category: 'Kilitlenme & Güvenilirlik',
    path: '/backups',
    icon: Database,
    description: 'Son Full/Diff/Log yedekleme geçmişi, RPO veri kaybı riski, DBCC CHECKDB tarihleri ve msdb.dbo.suspect_pages bozuk sayfa radarı.',
    technicalSource: 'msdb.dbo.backupset, suspect_pages, DBCC CHECKDB',
    keywords: ['yedek', 'backup', 'rpo', 'checkdb', 'suspect pages', 'bozuk sayfa', 'kurtarma', 'page restore'],
  },
  {
    id: 'high-availability',
    title: 'AlwaysOn & Replikalar',
    category: 'Kilitlenme & Güvenilirlik',
    path: '/high-availability',
    icon: Activity,
    description: 'AlwaysOn Availability Groups replika durumları, senkronizasyon gecikmesi (log send/redo queue) ve failover hazırlık izleyicisi.',
    technicalSource: 'sys.dm_hadr_database_replica_states',
    keywords: ['alwayson', 'ha', 'availability group', 'replika', 'replica', 'senkron', 'failover', 'yüksek erişilebilirlik'],
  },

  // 6. Güvenlik & Yönetim
  {
    id: 'best-practices',
    title: 'Sistem Uygunluk Karnesi',
    category: 'Güvenlik & Yönetim',
    path: '/best-practices',
    icon: ShieldCheck,
    description: 'MAXDOP, Cost Threshold, TempDB dosya sayısı, DAC, Auto-Close, Ad-Hoc ve Backup Checksum dahil 16 kural ve ağırlıklı karne puanı.',
    technicalSource: 'sys.configurations, sys.databases, sp_configure',
    keywords: ['best practice', 'hazırlık', 'karne', 'benchmark', 'maxdop', 'dac', 'auto close', 'denetim', 'kurallar'],
  },
  {
    id: 'permissions',
    title: 'Kullanıcılar & Yetkiler',
    category: 'Güvenlik & Yönetim',
    path: '/permissions',
    icon: Shield,
    description: 'Sunucu oturumları (logins), sysadmin rol üyeleri, yetim kullanıcılar (orphaned users) ve veri tabanı rol izin matrisi.',
    technicalSource: 'sys.server_principals, sp_change_users_login',
    keywords: ['izin', 'güvenlik', 'permissions', 'login', 'sysadmin', 'yetim kullanıcı', 'orphan', 'yetki'],
  },
  {
    id: 'agent-jobs',
    title: 'SQL Agent & Sistem Alarmları',
    category: 'Güvenlik & Yönetim',
    path: '/agent-jobs',
    icon: CalendarClock,
    description: 'Zamanlanmış işler, başarısız adımlar, sysalerts (Severity 17-25, Error 823-825) kör nokta radarı, Database Mail ve Slack/Teams webhook.',
    technicalSource: 'msdb.dbo.sysjobs, sysalerts, sysmail_mailitems',
    keywords: ['sql agent', 'agent jobs', 'sysalerts', 'alarmlar', 'database mail', 'webhook', 'slack', 'teams'],
  },
  {
    id: 'schema-diff',
    title: 'Şema Karşılaştırma',
    category: 'Güvenlik & Yönetim',
    path: '/schema-diff',
    icon: GitCompare,
    description: 'İki veritabanı arasındaki tablo, kolon, veri tipi ve indeks farklılıklarını karşılaştırır; güvenli DDL senkronizasyon betiği üretir.',
    technicalSource: 'INFORMATION_SCHEMA, sys.columns, sys.indexes',
    keywords: ['şema', 'schema diff', 'karşılaştırma', 'fark', 'ddl', 'migration', 'senkronizasyon'],
  },
  {
    id: 'toolkit',
    title: 'T-SQL Betik Kütüphanesi',
    category: 'Güvenlik & Yönetim',
    path: '/toolkit',
    icon: Terminal,
    description: 'Kategorize edilmiş, kopyalanabilir, güvenli (review-only) acil durum müdahale ve performans teşhis T-SQL betik kütüphanesi.',
    technicalSource: 'Kurumsal DBA T-SQL Teşhis Kütüphanesi',
    keywords: ['toolkit', 'araç seti', 't-sql', 'script', 'betik', 'kod', 'kütüphane', 'reçete'],
  },
];

const CATEGORIES = [
  'Tümü',
  'Genel Bakış',
  'Sorgu & Performans',
  'İndeks & Bakım',
  'Bellek & Depolama',
  'Kilitlenme & Güvenilirlik',
  'Güvenlik & Yönetim',
];

export default function CatalogPage() {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Tümü');

  const filteredModules = useMemo(() => {
    return MODULE_REGISTRY.filter((mod) => {
      const matchesCategory =
        selectedCategory === 'Tümü' || mod.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!searchTerm.trim()) return true;

      const q = searchTerm.toLowerCase();
      const matchTitle = mod.title.toLowerCase().includes(q);
      const matchDesc = mod.description.toLowerCase().includes(q);
      const matchSource = mod.technicalSource.toLowerCase().includes(q);
      const matchKeywords = mod.keywords.some((k) => k.toLowerCase().includes(q));

      return matchTitle || matchDesc || matchSource || matchKeywords;
    });
  }, [searchTerm, selectedCategory]);

  return (
    <div className={styles.container}>
      <PageHeader
        title="Tüm Özellikler Kataloğu"
        subtitle="Datapath platformundaki tüm teşhis, optimizasyon, indeks, bellek ve kriz müdahale yeteneklerinin haritası."
      />

      {/* Search and Category Filter Bar */}
      <div className={styles.searchBarWrapper}>
        <div className={styles.searchInputBox}>
          <Search size={16} color="var(--accent-blue, #60a5fa)" />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Özellik, metrik veya araç ara (örn: 'sargable', 'sanal indeks', 'deadlock', 'rca', 'vlf', 'buffer pool', 'checkpoint', 'maxdop')..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Temizle
            </button>
          )}
        </div>

        <div className={styles.categoryFilterRow}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`${styles.filterChip} ${
                selectedCategory === cat ? styles.filterChipActive : ''
              }`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Modules */}
      <div className={styles.grid}>
        {filteredModules.map((mod) => {
          const Icon = mod.icon;
          return (
            <div key={mod.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardTitleArea}>
                  <div className={styles.iconBox}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <h3 className={styles.cardTitle}>{mod.title}</h3>
                    <span className={styles.categorySub}>{mod.category}</span>
                  </div>
                </div>
              </div>

              <p className={styles.cardDescription}>{mod.description}</p>

              <div className={styles.sourceTag} title={`DMV / Altyapı: ${mod.technicalSource}`}>
                ⚙️ {mod.technicalSource}
              </div>

              <div className={styles.cardFooter}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Rota: <code>{mod.path}</code>
                </span>
                <Link to={mod.path} className={styles.navigateBtn}>
                  Aç <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
