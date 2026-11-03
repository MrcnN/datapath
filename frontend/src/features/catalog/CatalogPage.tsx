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
  Sparkles,
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
  badge?: string;
  badgeType?: 'default' | 'warning' | 'success';
  description: string;
  technicalSource: string;
  keywords: string[];
}

const MODULE_REGISTRY: ModuleItem[] = [
  // 1. Genel Bakış & Filo
  {
    id: 'dashboard',
    title: 'Gösterge Paneli',
    category: 'Genel Bakış & Filo',
    path: '/',
    icon: LayoutDashboard,
    description: 'Bütünleşik sağlık skoru (Health Score), aktif krizler, kaynak bekleme oranları ve anlık sistem metrikleri özeti.',
    technicalSource: 'dm_os_wait_stats, sysalerts, PLE',
    keywords: ['dashboard', 'sağlık', 'health', 'kpi', 'özet', 'skor', 'genel bakış'],
  },
  {
    id: 'instances',
    title: 'Sunucular & Oturumlar',
    category: 'Genel Bakış & Filo',
    path: '/instances',
    icon: Server,
    description: 'Canlı sp_whoisactive seviyesinde aktif sorgu oturumları, kök kilit bloklayıcıları ve çoklu sunucu ortam geçişi.',
    technicalSource: 'sys.dm_exec_requests, sys.dm_exec_sessions',
    keywords: ['sunucu', 'oturum', 'session', 'whoisactive', 'sp_whoisactive', 'bağlantı', 'instances'],
  },

  // 2. Sorgu & Performans Zekası
  {
    id: 'query-performance',
    title: 'Sorgu Performansı (Query Store)',
    category: 'Sorgu & Performans Zekası',
    path: '/query-performance',
    icon: TrendingUp,
    badge: 'QUERY STORE',
    description: 'En çok CPU, süre ve mantıksal I/O tüketen sorgular, yürütme planı gerilemeleri (regressions) ve anti-pattern radarı.',
    technicalSource: 'sys.query_store_runtime_stats, dm_exec_query_stats',
    keywords: ['sorgu', 'query', 'performans', 'query store', 'en maliyetli', 'gerileme', 'regression', 'cpu'],
  },
  {
    id: 'query-rewriter',
    title: 'Akıllı Sorgu İyileştirici & Rewriter',
    category: 'Sorgu & Performans Zekası',
    path: '/query-rewriter',
    icon: Wand2,
    badge: 'YENİ / SARGABLE',
    badgeType: 'success',
    description: 'SARGable olmayan anti-desenleri (YEAR, LEFT, COUNT(*), SELECT *, leading wildcard) tespit eder; Index Seek uyumlu optimize T-SQL diff üretir.',
    technicalSource: 'T-SQL AST & Regex Optimizasyon Motoru',
    keywords: ['sorgu iyileştirici', 'rewriter', 'sargable', 'anti-pattern', 'diff', 'seek', 'optimize', 'year', 'left'],
  },
  {
    id: 'execution-plan',
    title: 'Grafiksel Yürütme Planı (.sqlplan)',
    category: 'Sorgu & Performans Zekası',
    path: '/execution-plan',
    icon: GitPullRequest,
    badge: 'XML SHOWPLAN',
    description: 'SSMS gerektirmeyen ShowPlanXML interaktif operatör ağacı; maliyet %, uyarı rozetleri, spill ve eksik indeks tespiti.',
    technicalSource: 'sys.dm_exec_query_plan, .sqlplan XML',
    keywords: ['yürütme planı', 'execution plan', 'sqlplan', 'showplan', 'operatör', 'maliyet', 'ağaç', 'spill'],
  },
  {
    id: 'waits',
    title: 'Bekleme İstatistikleri (Wait Stats)',
    category: 'Sorgu & Performans Zekası',
    path: '/waits',
    icon: Hourglass,
    description: 'SQL Server kaynak beklemeleri, kümülatif bekleme türleri ve CPU baskısını teşhis eden Signal Wait oranı göstergesi.',
    technicalSource: 'sys.dm_os_wait_stats, Signal vs Resource Wait',
    keywords: ['bekleme', 'wait stats', 'signal wait', 'cxpacket', 'pageiolatch', 'sos_scheduler_yield', 'darboğaz'],
  },

  // 3. İndeksler & Akıllı Bakım
  {
    id: 'indexes',
    title: 'İndeks Zekası',
    category: 'İndeksler & Akıllı Bakım',
    path: '/indexes',
    icon: Layers,
    description: 'SQL Server Query Optimizer eksik indeks önerileri, hiç okunmayan kullanılmayan indeksler, mükerrer indeksler ve parçalanma.',
    technicalSource: 'sys.dm_db_missing_index_details, index_usage_stats',
    keywords: ['indeks', 'index', 'eksik indeks', 'kullanılmayan', 'parçalanma', 'fragmentation', 'mükerrer', 'redundant'],
  },
  {
    id: 'hypothetical-indexes',
    title: '"What-If" Hipotetik İndeks Simülatörü',
    category: 'İndeksler & Akıllı Bakım',
    path: '/hypothetical-indexes',
    icon: FlaskConical,
    badge: 'ZERO-DISK',
    badgeType: 'success',
    description: 'Diske tek bayt yazmadan WITH STATISTICS_ONLY = -1 mimarisiyle sanal indeks oluşturur ve sorgunun tahmini maliyet kazanımını simüle eder.',
    technicalSource: 'WITH STATISTICS_ONLY = -1, AUTOCREATE',
    keywords: ['what-if', 'hipotetik', 'sanal indeks', 'hypothetical', 'simülatör', 'zero-disk', 'maliyet', 'optimizer'],
  },
  {
    id: 'maintenance-planner',
    title: 'Akıllı Bakım & İndeks Planlayıcısı',
    category: 'İndeksler & Akıllı Bakım',
    path: '/maintenance-planner',
    icon: Wrench,
    badge: 'OTONOM JOB',
    badgeType: 'warning',
    description: 'Sayfa sayısı ve parçalanma eşikli REORGANIZE/REBUILD ayrımı, istatistik tazeleme ve tek tıkla kopyalanabilir SQL Agent bakım işi üretimi.',
    technicalSource: 'sys.dm_db_index_physical_stats, ALTER INDEX',
    keywords: ['bakım', 'maintenance', 'defrag', 'rebuild', 'reorganize', 'istatistik', 'update statistics', 'agent job'],
  },

  // 4. Bellek, TempDB & Depolama
  {
    id: 'tempdb',
    title: 'TempDB & Bellek Yönetimi',
    category: 'Bellek, TempDB & Depolama',
    path: '/tempdb',
    icon: Cpu,
    description: 'TempDB GAM/SGAM/PFS sayfa çekişmesi, oturum alan sızıntıları, Page Life Expectancy (PLE) ve Plan Cache Bloat analizi.',
    technicalSource: 'sys.dm_os_waiting_tasks, sys.dm_db_session_space_usage',
    keywords: ['tempdb', 'bellek', 'ram', 'ple', 'pagelatch', 'gam', 'sgam', 'pfs', 'plan cache', 'bloat', 'memory grants'],
  },
  {
    id: 'buffer-pool',
    title: 'Buffer Pool Bellek Tomografisi',
    category: 'Bellek, TempDB & Depolama',
    path: '/buffer-pool',
    icon: PieChart,
    badge: 'YENİ / RÖNTGEN',
    badgeType: 'success',
    description: 'Veritabanı bazında RAM nesne dağılımı, diske henüz yazılmamış kirli sayfalar (dirty pages) ve kontrollü CHECKPOINT yönergeleri.',
    technicalSource: 'sys.dm_os_buffer_descriptors, CHECKPOINT',
    keywords: ['buffer pool', 'tomografi', 'kirli sayfa', 'dirty pages', 'clean pages', 'checkpoint', 'ram nesne'],
  },
  {
    id: 'storage',
    title: 'Depolama & Log Dosyaları (VLF)',
    category: 'Bellek, TempDB & Depolama',
    path: '/storage',
    icon: HardDrive,
    description: 'MDF/LDF disk alanı, okuma/yazma disk gecikmeleri (stall ms), Virtual Log File (VLF) şişmesi ve açık kalan işlemler.',
    technicalSource: 'sys.dm_io_virtual_file_stats, DBCC LOGINFO',
    keywords: ['depolama', 'disk', 'storage', 'vlf', 'log', 'mdf', 'ldf', 'gecikme', 'stall', 'open transaction'],
  },

  // 5. Kriz, Güvenilirlik & Yedekleme
  {
    id: 'incidents',
    title: 'Olay Merkezi & Deadlock Radarı',
    category: 'Kriz, Güvenilirlik & Yedekleme',
    path: '/incidents',
    icon: AlertTriangle,
    badge: 'RCA JENERATÖRÜ',
    badgeType: 'warning',
    description: 'Canlı kilitlenmeler, interaktif SVG Deadlock döngü grafiği, SQL Server hata günlükleri ve kurumsal RCA Post-Mortem raporlayıcısı.',
    technicalSource: 'system_health XE, deadlock-list XML, RCA Generator',
    keywords: ['olay', 'kriz', 'incident', 'deadlock', 'kilitlenme', 'rca', 'post-mortem', 'hata günlüğü', 'errorlog'],
  },
  {
    id: 'extended-events',
    title: 'Genişletilmiş Olaylar (XE)',
    category: 'Kriz, Güvenilirlik & Yedekleme',
    path: '/extended-events',
    icon: Radio,
    description: 'SQL Server Extended Events oturum yönetimi, ring_buffer ve event_file hedef ayrıştırıcısı ile derin kernel düzeyinde izleme.',
    technicalSource: 'sys.dm_xe_sessions, sys.dm_xe_session_targets',
    keywords: ['extended events', 'xe', 'olaylar', 'ring buffer', 'event file', 'izleme', 'profiler'],
  },
  {
    id: 'backups',
    title: 'Yedekleme & Kurtarma (Bütünlük)',
    category: 'Kriz, Güvenilirlik & Yedekleme',
    path: '/backups',
    icon: Database,
    description: 'Son Full/Diff/Log yedekleme geçmişi, RPO veri kaybı riski, DBCC CHECKDB tarihleri ve msdb.dbo.suspect_pages bozuk sayfa radarı.',
    technicalSource: 'msdb.dbo.backupset, suspect_pages, DBCC CHECKDB',
    keywords: ['yedek', 'backup', 'rpo', 'checkdb', 'suspect pages', 'bozuk sayfa', 'kurtarma', 'page restore'],
  },
  {
    id: 'high-availability',
    title: 'Yüksek Erişilebilirlik (AlwaysOn AG)',
    category: 'Kriz, Güvenilirlik & Yedekleme',
    path: '/high-availability',
    icon: Activity,
    description: 'AlwaysOn Availability Groups replika durumları, senkronizasyon gecikmesi (log send/redo queue) ve failover hazırlık izleyicisi.',
    technicalSource: 'sys.dm_hadr_database_replica_states',
    keywords: ['alwayson', 'ha', 'availability group', 'replika', 'replica', 'senkron', 'failover', 'yüksek erişilebilirlik'],
  },

  // 6. Yönetim, Güvenlik & Denetim
  {
    id: 'best-practices',
    title: 'Best Practice & Hazırlık Karnesi',
    category: 'Yönetim, Güvenlik & Denetim',
    path: '/best-practices',
    icon: ShieldCheck,
    badge: '16 MİMARİ KURAL',
    badgeType: 'success',
    description: 'MAXDOP, Cost Threshold, TempDB dosya sayısı, DAC, Auto-Close, Ad-Hoc ve Backup Checksum dahil 16 kural ve ağırlıklı karne puanı.',
    technicalSource: 'sys.configurations, sys.databases, sp_configure',
    keywords: ['best practice', 'hazırlık', 'karne', 'benchmark', 'maxdop', 'dac', 'auto close', 'denetim', 'kurallar'],
  },
  {
    id: 'permissions',
    title: 'İzinler, Roller & Güvenlik',
    category: 'Yönetim, Güvenlik & Denetim',
    path: '/permissions',
    icon: Shield,
    description: 'Sunucu oturumları (logins), sysadmin rol üyeleri, yetim kullanıcılar (orphaned users) ve veri tabanı rol izin matrisi.',
    technicalSource: 'sys.server_principals, sp_change_users_login',
    keywords: ['izin', 'güvenlik', 'permissions', 'login', 'sysadmin', 'yetim kullanıcı', 'orphan', 'yetki'],
  },
  {
    id: 'agent-jobs',
    title: 'SQL Agent İşleri, Alarmlar & Webhook',
    category: 'Yönetim, Güvenlik & Denetim',
    path: '/agent-jobs',
    icon: CalendarClock,
    badge: 'SİSTEM ALARMLARI',
    description: 'Zamanlanmış işler, başarısız adımlar, sysalerts (Severity 17-25, Error 823-825) kör nokta radarı, Database Mail ve Slack/Teams webhook.',
    technicalSource: 'msdb.dbo.sysjobs, sysalerts, sysmail_mailitems',
    keywords: ['sql agent', 'agent jobs', 'sysalerts', 'alarmlar', 'database mail', 'webhook', 'slack', 'teams'],
  },
  {
    id: 'schema-diff',
    title: 'Şema Karşılaştırması (Schema Diff)',
    category: 'Yönetim, Güvenlik & Denetim',
    path: '/schema-diff',
    icon: GitCompare,
    description: 'İki veritabanı arasındaki tablo, kolon, veri tipi ve indeks farklılıklarını karşılaştırır; güvenli DDL senkronizasyon betiği üretir.',
    technicalSource: 'INFORMATION_SCHEMA, sys.columns, sys.indexes',
    keywords: ['şema', 'schema diff', 'karşılaştırma', 'fark', 'ddl', 'migration', 'senkronizasyon'],
  },
  {
    id: 'toolkit',
    title: 'DBA T-SQL Teşhis Araç Seti',
    category: 'Yönetim, Güvenlik & Denetim',
    path: '/toolkit',
    icon: Terminal,
    description: 'Kategorize edilmiş, kopyalanabilir, güvenli (review-only) acil durum müdahale ve performans teşhis T-SQL betik kütüphanesi.',
    technicalSource: 'Kurumsal DBA T-SQL Teşhis Kütüphanesi',
    keywords: ['toolkit', 'araç seti', 't-sql', 'script', 'betik', 'kod', 'kütüphane', 'reçete'],
  },
];

const CATEGORIES = [
  'Tümü',
  'Genel Bakış & Filo',
  'Sorgu & Performans Zekası',
  'İndeksler & Akıllı Bakım',
  'Bellek, TempDB & Depolama',
  'Kriz, Güvenilirlik & Yedekleme',
  'Yönetim, Güvenlik & Denetim',
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
        title="Modül & Yetenek Kataloğu"
        subtitle="Datapath platformundaki tüm teşhis, optimizasyon, indeks, bellek ve kriz müdahale yeteneklerinin haritası."
      />

      {/* Search and Category Filter Bar */}
      <div className={styles.searchBarWrapper}>
        <div className={styles.searchInputBox}>
          <Search size={16} color="var(--accent-blue, #60a5fa)" />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Modül, metrik veya araç ara (örn: 'sargable', 'what-if', 'deadlock', 'rca', 'vlf', 'buffer pool', 'checkpoint', 'maxdop')..."
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
                {mod.badge && (
                  <span
                    className={`${styles.badgePill} ${
                      mod.badgeType === 'success'
                        ? styles.badgeSuccess
                        : mod.badgeType === 'warning'
                        ? styles.badgeWarning
                        : ''
                    }`}
                  >
                    {mod.badge}
                  </span>
                )}
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
                  Modüle Git <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
