# Datapath Platform — Geliştirme Defteri ve İlerleme Raporu (TODOlist)

> **Bu dosya bir iş listesidir ve aynı zamanda projenin canlı ilerleme raporudur.**  
> Tamamlanan her modül ve sayfa bu dosyada güncellenir. Projede ne kadar işin bittiği ve sırada nelerin olduğu her zaman buradan izlenir.

---

## Amaç ve Kapsam

Datapath; SQL Server veritabanlarındaki operasyonel darboğazları, performans krizlerini, kilitlenmeleri, bellek ve depolama anomalilerini nokta atışı kök nedenleriyle ortaya çıkaran ve güvenli T-SQL reçeteleri sunan bir Veritabanı Zekası Platformudur.

Bu defter; projenin mimari temellerinden (Tier 0) en derin kurumsal teşhis motorlarına (Tier 5) kadar tüm bileşenlerin adım adım durumunu, sayfa envanterini ve kalite standartlarını belgeler.

### Değişmeyecek Altın Kurallar
1. **Çalışan MVP Önceliği:** Bitmemiş onlarca özellik yerine her zaman eksiksiz çalışan bir mimariye öncelik verilir.
2. **Review-Only Güvenlik Politikası:** Platform otonom yıkıcı işlem (`KILL`, `REBUILD`, `FAILOVER`, `RESTORE`) yapmaz; daima incelenebilir açıklamalı T-SQL üretir.
3. **Gerçek DMV Verisi:** Sahte veya uydurma metrikler kullanılmaz; canlı bağlantı yoksa durum her zaman "Demo Verisi" olarak açıkça etiketlenir.
4. **Çift Yönlü Kalite Kapısı:** Kod teslim edilmeden önce backend'de `pytest` testleri geçmeli, frontend'de `tsc && vite build` sıfır hatayla derlenmelidir.
5. **Karanlık Tema Önceliği:** Arayüz kurumsal DBA standartlarına uygun olarak karanlık tema öncelikli (dark-first) geliştirilir.

---

## Bölüm 0 — Mimari ve Tasarım Kararları

### A. Modüler Monolit Mimari
- Frontend (React 18 + TypeScript + Vite) doğrudan FastAPI backend REST API ile konuşur.
- Karmaşık mikroservis veya mesaj kuyruğu bağımlılıkları eklenmez; tüm DMV sorguları ve iş mantığı backend servislerinde toplanır.

### B. Tasarım Sistemi ve Stil Yönetimi
- **CSS Modules:** Sayfa ve bileşen bazlı izole stillendirme (`*.module.css`).
- **Semantik Renk Token'ları:** `--bg-surface`, `--text-primary`, `--accent-blue`, `--status-danger`, `--status-warning`, `--status-success`.
- **Veri Odaklı Tablolar:** Sayfalama, sıralama ve kolon filtreleme yetenekli `DataTable` bileşeni.

### C. Çoklu Sunucu Ortam Geçişi (Server Registry)
- `localStorage` yerine backend oturumuyla senkronize çalışan sunucu profilleri (`/api/servers`).
- Canlı gecikme süresi (`latency_ms`) ve erişilebilirlik pingleme desteği.

---

## Bölüm 1 — Aşama Aşama Geliştirme Tier'ları

### Tier 0: Çatı, Düzen ve Temel Altyapı
- [x] **0.1** Profesyonel uygulama düzeni (`Sidebar`, `TopBar`, `PageHeader`)
- [x] **0.2** Koyu/Aydınlık tema anahtarlayıcısı (`themeToggleBtn`) ve yerel depolama entegrasyonu
- [x] **0.3** Merkezi marka kimliği yapılandırması (`src/config/brand.ts`)
- [x] **0.4** Durum bileşenleri (`LoadingSpinner`, `ErrorState`, `EmptyState`, `StatusBadge`, `DemoDataBanner`)
- [x] **0.5** FastAPI backend iskeleti, CORS yapılandırması ve `/api/health` uç noktası
- [x] **0.6** `pyodbc` veritabanı sürücüsü, bağlantı fabrikası ve context manager (`connection.py`)

### Tier 1: Olay Merkezi ve Canlı Kilitlenme Teşhisi
- [x] **1.1** Canlı oturumlar ve sorgular tablosu (`/api/sessions`)
- [x] **1.2** Kilitlenme zincirleri ve kök engelleyici (Root Blocker) tespiti (`/api/blocking`)
- [x] **1.3** Deadlock XML (`.xdl`) yükleme, yapıştırma ve görsel ayrıştırma motoru (`DeadlockViewer`)
- [x] **1.4** SQL Server hata günlüğü (Error Log) görüntüleyici (`ErrorLogViewer`)
- [x] **1.5** Birleşik olay zaman çizelgesi (`IncidentTimeline`)

### Tier 2: Sorgu Performansı ve İndeks Zekası
- [x] **2.1** Query Store genel bakış metrikleri ve depolama takibi
- [x] **2.2** En maliyetli sorgular tablosu (CPU, süre, mantıksal okuma ve çalışma sayısı)
- [x] **2.3** Yürütme planı anti-desenleri tespiti (`CONVERT_IMPLICIT`, TempDB Spill, Index Scan)
- [x] **2.4** Eksik indeks analizörü ve etki puanı (Impact Score) hesaplayıcı
- [x] **2.5** Kullanılmayan ve sisteme yalnızca I/O yükü getiren indekslerin tespiti
- [x] **2.6** Tekrarlayan ve önek çakışmalı (redundant) indeks tespit motoru
- [x] **2.7** İndeks parçalanma (Fragmentation) oranları ve bakım betiği üretimi

### Tier 3: Depolama, TempDB ve Bellek Zekası
- [x] **3.1** Veritabanı ve transaction log dosyaları doluluk oranları
- [x] **3.2** Otomatik dosya büyüme (Autogrowth) olayları kronolojisi
- [x] **3.3** Sanal Log Dosyası (VLF) mimarisi denetimi ve boyutlandırma motoru
- [x] **3.4** Disk büyüme trendi ve kapasite tükenme tahmini (Capacity Runway Forecasting)
- [x] **3.5** Disk dosya I/O gecikmesi ve darboğaz analizi (`sys.dm_io_virtual_file_stats`)
- [x] **3.6** TempDB PFS/GAM/SGAM sayfa tahsis çekişmesi ve alan dağılımı
- [x] **3.7** Page Life Expectancy (PLE) ve Memory Clerk bellek dağılımı
- [x] **3.8** Buffer Pool veritabanı ve tablo bazlı RAM tahsis dökümü
- [x] **3.9** Ad-hoc Plan Cache şişmesi (Plan Cache Bloat) ve bellek geri kazanımı

### Tier 4: Açık İşlemler, Veri Bütünlüğü ve Sistem Alarmları
- [x] **4.1** Açık kalan / askıdaki işlemler (Open Transactions) ve sahipsiz sleeping oturum tespiti
- [x] **4.2** Transaction log kesilmesini durduran engeller (`log_reuse_wait_desc`) kök neden motoru
- [x] **4.3** Fiziksel disk ve sayfa bozulması radarı (`msdb.dbo.suspect_pages`)
- [x] **4.4** Veritabanı son temiz `DBCC CHECKDB` tarihi ve RPO kurtarma hazırlığı analizi
- [x] **4.5** SQL Server Agent kritik alarmları (`sysalerts` - Sev 17-25, 823-825) denetimi
- [x] **4.6** Database Mail kuyruk durumu ve başarısız gönderim kök neden teşhisi (`sysmail_*`)
- [x] **4.7** Sorgu çalışma belleği hibeleri ve `RESOURCE_SEMAPHORE` bekleme analitiği
- [x] **4.8** Kapsamlı Mühendislik Teşhis Dosyası (DBA Dossier Export - Markdown, HTML/Print, JSON)

### Tier 5: Çoklu Ortam, Güvenlik ve Genişletilmiş Araçlar
- [x] **5.1** Çoklu sunucu profilleri (Multi-Server Registry) ve global üst bar seçicisi
- [x] **5.2** Extended Events (XE) oturum yönetimi ve `system_health` ring buffer tanılaması
- [x] **5.3** Sunucu loginleri, veritabanı kullanıcıları, roller ve sysadmin denetimi
- [x] **5.4** Yetim kullanıcılar (orphaned users) ve ayrıcalık yükseltme analizi
- [x] **5.5** AlwaysOn Availability Groups replika sağlık durumları ve senkronizasyon takibi
- [x] **5.6** İki veritabanı arası şema karşılaştırması (Schema Diff) ve review-only DDL üretimi
- [x] **5.7** DBA Teşhis Araç Seti aranabilir T-SQL betik kütüphanesi (`ToolkitPage`)
- [x] **5.8** Gelişmiş T-SQL script şablonlarının genişletilmesi (37 adet üretim hazır DBA acil durum ve teşhis betiği)
- [ ] **5.9** Webhook tabanlı canlı kriz uyarı fırlatıcı (Slack/Teams)

---

## Bölüm 2 — Sayfa ve Modül Envanteri

| Sayfa / Modül | Rota | Ana Görev ve Sağlanan Zeka | Durum |
| :--- | :--- | :--- | :---: |
| **Gösterge Paneli** | `/` | Birleşik sistem özeti, kriz KPI'ları, bekleme oranları | ✅ Tamamlandı |
| **Sunucular & Bağlantı** | `/instances` | Canlı oturumlar, `sp_whoisactive` düzeyinde analiz, kök bloklayıcılar | ✅ Tamamlandı |
| **Olay Merkezi** | `/incidents` | Deadlock XML ayrıştırma, hata günlükleri ve olay zaman çizgisi | ✅ Tamamlandı |
| **Sorgu Performansı** | `/query-performance` | Query Store en maliyetli sorgular, gerilemeler ve anti-desenler | ✅ Tamamlandı |
| **İndeks Zekası** | `/indexes` | Eksik indeksler, mükerrer indeksler, parçalanma ve kullanım oranları | ✅ Tamamlandı |
| **Bekleme İstatistikleri** | `/waits` | Kaynak beklemeleri, CPU Signal Wait oranı göstergesi | ✅ Tamamlandı |
| **Depolama & Dosyalar** | `/storage` | Dosya boyutları, VLF mimarisi, açık işlemler, disk gecikmesi | ✅ Tamamlandı |
| **TempDB & Bellek** | `/tempdb` | TempDB çekişmesi, PLE, Buffer Pool dökümü, Plan Cache Bloat, Memory Grants | ✅ Tamamlandı |
| **Yedekleme & Kurtarma** | `/backups` | Yedekleme geçmişi, RPO riski, CHECKDB tarihleri ve suspect_pages radarı | ✅ Tamamlandı |
| **Yüksek Erişilebilirlik** | `/high-availability` | AlwaysOn AG topolojisi, replika durumları, senkronizasyon gecikmesi | ✅ Tamamlandı |
| **SQL Agent İşleri** | `/agent-jobs` | Zamanlanmış işler, adım hata detayları, kritik alarmlar ve Database Mail | ✅ Tamamlandı |
| **Şema Karşılaştırması** | `/schema-diff` | İki veritabanı arası nesne farklılıkları ve güvenli DDL üretimi | ✅ Tamamlandı |
| **İzinler & Güvenlik** | `/permissions` | Login denetimi, sysadmin hesapları, yetim kullanıcılar | ✅ Tamamlandı |
| **DBA Araç Seti** | `/toolkit` | Kategorize, aranabilir, kopyalanabilir T-SQL teşhis betikleri | ✅ Tamamlandı |
| **Teşhis Dosyası Modalı** | `TopBar` | Tek tıkla tüm sağlık ve olay verilerini derleyip dışa aktarma (Export) | ✅ Tamamlandı |

---

## Bölüm 3 — "Bitti" Tanımı (Definition of Done - DoD)

Bir özelliğin veya modülün tamamlandı sayılması için şu 5 şartın eksiksiz sağlanması zorunludur:
1. **Backend Doğrulaması:** Eklenen endpoint'ler ve servisler için `pytest` testleri yazılmış ve hatasız geçmiş olmalıdır.
2. **Frontend Derleme Doğrulaması:** `npm run build` komutu sıfır TypeScript ve derleme uyarısıyla tamamlanmalıdır.
3. **Demo Fallback Uyumluluğu:** Canlı SQL Server bağlantısı olmadığında arayüz çökmemeli, yüksek sadakatli demo modellerini etiketli olarak render etmelidir.
4. **Güvenlik Politikası Uyumu:** Hiçbir yıkıcı veya yazma işlemi otomatik çalıştırılmamalı; T-SQL kodları review-only olarak sunulmalıdır.
5. **Git ve Defter Güncellemesi:** `TODO.md` ve `TODOlist.md` güncellenmeli, iş mantıksal bir commit ile GitHub `main` dalına pushlanmalıdır.

---

## Bölüm 4 — Doğrulama ve Test Matrisi

- **Mevcut pytest Test Sayısı:** 49 Test (Tamamı Başarılı)
- **Frontend Derleme Durumu:** `tsc && vite build` (0 Hata)
- **Kapsanan Kritik Uç Noktalar:**
  - `GET /api/agent-jobs/alerts-and-mail` ✅
  - `GET /api/backups/integrity-summary` ✅
  - `GET /api/tempdb-memory/memory-grants` ✅
  - `GET /api/tempdb-memory/contention` ✅
  - `GET /api/query-store/regressions` ✅
  - `GET /api/storage/vlfs` ✅
  - `GET /api/storage/open-transactions` ✅
  - `GET /api/servers` & `POST /api/servers/:id/activate` ✅
