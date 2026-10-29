# Datapath — Proje Görev Takibi (TODO)

## Devam Edenler (In Progress)
- [ ] Dağıtım ve Üretim Hazırlığı
  - [ ] Canlı SQL Server ortamı bağlantı doğrulaması (Opsiyonel / İsteğe bağlı yerel test)
  - [ ] Portföy sunumu için ekran görüntüleri ve GIF demolarının eklenmesi

## Sıradaki Görevler (To Do)
- [ ] Gelişmiş T-SQL script şablonlarının genişletilmesi
- [ ] Transaction log kesilme bloklayıcıları (log_reuse_wait_desc) ve açık işlem (DBCC OPENTRAN) zekası
- [ ] Database Mail kuyruk izleme ve SQL Server kritik alarm (Severity 17-25) denetimi
- [ ] Bellek katmanları (sys.dm_os_memory_clerks) ve Ad-hoc Plan Cache Bloat tespiti

## Tamamlananlar (Done)
- [x] **Sürüm 5: Kurumsal SQL Server Zekası & Çoklu Ortam**
  - [x] Çoklu sunucu (multi-server profile registry) ortam geçişi ve global üst bar seçicisi
  - [x] Extended Events (XE) oturum yaşam döngüsü yönetimi, system_health ring buffer tanılaması ve DBA şablonları
  - [x] Virtual Log File (VLF) mimarisi denetimi ve T-SQL küçültme/büyütme öneri motoru
  - [x] Canlı işlem gezgini, kök bloklayıcı tanılaması ve sp_whoisactive analitiği
  - [x] İndeks zekası: Tekrarlayan ve önek çakışmalı (redundant) indeks tespiti
  - [x] Güvenlik zafiyet denetimi: Yetim kullanıcılar (orphaned users) ve ayrıcalık yükseltme kontrolleri
  - [x] Veritabanı büyüme trendleri ve disk kapasite tükenme tahmini (capacity runway forecasting)
  - [x] sp_configure sunucu yapılandırması ve DBA en iyi uygulama uyumluluk puanı (compliance scoring)
  - [x] Yürütme planı anti-desenleri, TempDB spill ve CONVERT_IMPLICIT örtük dönüşüm tanılaması
  - [x] SQL Server Agent iş zekası, adım adım yürütme geçmişi ve hata triyajı
- [x] **Sürüm 0: İşlevsel MVP**
  - [x] Uygulama düzeni ve gezinme (`Sidebar`, `TopBar`, `PageHeader`)
  - [x] Gösterge Paneli (`DashboardPage`) açıkça etiketlenmiş demo verileriyle
  - [x] SQL Server bağlantı formu ve test uç noktası (`POST /api/connections/test`)
  - [x] Sunucu meta verileri ve veritabanı genel bakışı (`GET /api/instance/metadata`, `GET /api/instance/databases`)
  - [x] Aktif oturumlar ve engelleme zincirleri (`GET /api/sessions`, `GET /api/blocking`)
  - [x] DBA Araç Seti aranabilir, kategorize ve panoya kopyalanabilir betik kütüphanesi (`ToolkitPage`)
  - [x] Yükleniyor, boş, hata ve demo veri durumları (`LoadingSpinner`, `ErrorState`, `EmptyState`, `DemoDataBanner`)
  - [x] Merkezi marka kimliği (`src/config/brand.ts`)
  - [x] Backend sağlık kontrolü (`GET /api/health`)
  - [x] `README.md`, `.env.example` ve otomatik testler
- [x] **Sürüm 1: Olay Merkezi (Incident Center)**
  - [x] Deadlock XML yükleme, yapıştırma ve ayrıştırma motoru (`DeadlockViewer`)
  - [x] SQL Server Agent başarısız iş geçmişi (`AgentJobsTable`)
  - [x] SQL Server hata günlüğü görüntüleyici (`ErrorLogViewer`)
  - [x] Birleşik olay zaman çizelgesi (`IncidentTimeline`)
- [x] **Sürüm 2: Sorgu Performansı (Query Store)**
  - [x] Query Store durum ve depolama metrikleri (`QueryStoreOverview`)
  - [x] CPU, süre, mantıksal okuma ve çalışma sayısına göre en maliyetli sorgular (`ExpensiveQueriesTable`)
  - [x] Performans gerileme analizi ve göstergeleri
- [x] **Sürüm 3: Yedekleme ve Şema Araçları**
  - [x] Yedekleme geçmişi (Full, Diff, Log) boyut ve sıkıştırma oranları
  - [x] RPO kurtarma hazırlığı ve risk kontrol listesi (`RecoveryReadiness`)
  - [x] İki veritabanı arasında şema karşılaştırması (`SchemaDiffPage`)
  - [x] Yalnızca inceleme amaçlı, asla otomatik çalıştırılmayan SQL betik üretimi
- [x] **Sürüm 4: Gelişmiş Operasyonlar**
  - [x] Sunucu loginleri, veritabanı kullanıcıları, roller ve sysadmin denetimi (`PermissionsPage`)
  - [x] Always On Availability Groups, replika sağlık durumları ve senkronizasyon (`HAPage`)
  - [x] Platform ayarları ve ODBC/tema yapılandırması (`SettingsPage`)
- [x] **Kalite ve Derleme**
  - [x] TypeScript derleme ve tür kontrolü (`npm run build` hatasız tamamlandı)
  - [x] Tamamı Türkçe yerelleştirilmiş, tutarlı ve profesyonel koyu tema arayüzü
