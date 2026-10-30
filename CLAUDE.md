# Datapath — Claude Code Proje Kılavuzu (Project Guide)

## Genel Kurallar

- Tahmin etme; kararsız kaldığında doğrudan bana soru sor.

### Temel Prensipler

1. **Çalışan MVP Önceliğim:** Bitmemiş onlarca özellik yerine her zaman eksiksiz çalışan bir MVP'ye öncelik ver.
2. **Sade ve Modüler Mimari:** Mimariyi daima basit, modüler ve sürdürülebilir tut.
3. **Gerçek Veri ve Salt Okunurluk:** Mümkün olan her yerde gerçek SQL Server meta verilerini ve salt okunur (read-only) DMV sorgularını kullan.
4. **Profesyonel Arayüz:** Geliştirdiğin arayüzün tutarlı, modern, responsive ve kurumsal seviyede olmasını bekliyorum.
5. **Aşırı Mühendislikten Kaçınma:** Gereksiz üçüncü parti kütüphanelerden, karmaşık soyutlamalardan ve aşırı mühendislikten (overengineering) kesinlikle kaçın.
6. **Eksiksiz Doğrulama:** Bana bir işi "tamamlandı" olarak bildirmeden önce testleri çalıştır ve varsa derleme/çalışma zamanı hatalarını gider.

---

## 1. Proje Genel Bakışı (Project Overview)

**Datapath**, Microsoft SQL Server ortamları için geliştirilen, salt okunur (read-only) mimariye sahip, cerrahi kök neden tespiti (root-cause diagnosis) ve derin DBA içgörüsü sağlayan kurumsal bir **Veritabanı Zekası Platformudur (Database Intelligence Platform)**.

Platform iki ana katmandan oluşur:
- **Backend (API & Analitik Motoru):** Python 3.12+ ve FastAPI ile yazılmış, SQL Server Dinamik Yönetim Görünümlerini (DMV), Extended Events (XE) verilerini, katalog tablolarını ve Query Store metriklerini sorgulayan, hiçbir harici aracı (agent) SQL sunucusuna kurma zorunluluğu getirmeyen hafif API servisi.
- **Frontend (Kullanıcı Arayüzü):** React 18, TypeScript ve Vite ile geliştirilmiş; koyu tema öncelikli (dark-first), profesyonel, yüksek yoğunluklu veri tablolarına, etkileşimli kilit ağaçlarına ve panoya kopyalanabilir T-SQL iyileştirme reçetelerine sahip modern web arayüzü.

### Ürünümün Temel Felsefesi ve Farkı
Piyasadaki yüzeysel "Sağlık Monitörleri" (Health Check / Compliance checklist araçları) yalnızca dbachecks veya statik kurallar çalıştırıp "X veritabanı yavaş", "Y kuralı Fail oldu" gibi genel geçer puanlar üretir. 

Datapath ise **bir kıdemli veritabanı yöneticisinin (Senior/Principal DBA) kriz anındaki cerrahi teşhis refleksiyle** çalışır:
- *"X sorgusunda `CONVERT_IMPLICIT` örtük veri tipi dönüşümü var, bu yüzden indeks `Index Seek` yerine `Index Scan` yapıyor ve CPU'yu %94'e kilitliyor."*
- *"SPID 74 oturumu `Orders` tablosunda `BEGIN TRAN` açıp commit etmeden askıda kalmış (`sleeping`), Transaction Log dosyasının kesilmesini (`log_reuse_wait: ACTIVE_TRANSACTION`) engelliyor ve arkasındaki 18 oturumu kilitliyor."*
- *"msdb.dbo.suspect_pages tablosunda 824 hatasıyla işaretlenmiş bozuk 8KB sayfa var; tüm veritabanını kurtarmak yerine şu T-SQL ile tek bir Page Restore yapabilirsin."*

### Platformun Yanıtladığı Kritik DBA Soruları
Platformumun bir DBA olarak bana ve ekibime şu can alıcı soruların yanıtını saniyeler içinde vermesini hedefliyorum:
- Şu anda bu SQL Server örneğinde tam olarak neler oluyor?
- Hangi oturumlar (sessions) kilitlenmiş (blocked), onları kilitleyen kök bloklayıcı kim ve hangi sorguyu çalıştırıyor?
- Hangi sorgular en çok CPU, süre veya mantıksal okuma (logical read) tüketiyor?
- Sorgu performanslarında gerileme (plan regression) veya yürütme planı anti-deseni var mı?
- Veritabanı yedeklemelerim sağlıklı mı, kurtarma hazırlığım (RPO) ne durumda?
- Hangi SQL Server Agent işleri veya adımları başarısız oldu?
- İki veritabanı şeması arasında hangi nesneler farklılaştı?
- Yaşanan bir sorunu güvenle araştırıp çözmek için hangi T-SQL betiklerine ihtiyacım var?
- Açık kalan (uncommitted) sahipsiz işlemler log dosyamı şişiriyor mu, log kesilmesini engelleyen sebep (`log_reuse_wait`) nedir?
- TempDB üzerinde PFS/GAM/SGAM sayfa mandallanması (latch contention) veya oturum bazlı alan tüketim sızıntısı var mı?
- Sanal Log Dosyaları (VLF) aşırı parçalanmış mı, log büyümesi acil müdahale gerektiriyor mu?

---

## 2. Mimari ve Teknoloji Yığını (Architecture & Stack)

### İletişim Modeli
```
[React Frontend] (Port 5173 / Tarayıcı)
       │  REST API (JSON)
       ▼
[FastAPI Backend] (Port 8000 / Python 3.12+)
       │  pyodbc (ODBC Driver 17 for SQL Server) — Read-Only Direct TDS Queries
       ▼
[Microsoft SQL Server Hedefleri] (On-Prem, Azure SQL MI, AWS RDS SQL Server)
   ├── Dynamic Management Views (sys.dm_exec_*, sys.dm_os_*, sys.dm_db_*)
   ├── System Catalog & MSDB Tables (msdb.dbo.sysalerts, sysmail_*, suspect_pages)
   ├── Query Store Metrikleri (sys.query_store_*)
   └── Extended Events Ring Buffer (system_health xevents)
```

### Backend Yığını
- **Çalışma Zamanı & Dil:** Python 3.12+
- **Web Çerçevesi:** FastAPI (Asenkron & Yüksek Performanslı REST API)
- **Veritabanı Sürücüsü:** `pyodbc` (ODBC Driver 17 for SQL Server üzerinden doğrudan yerel TDS bağlantısı)
- **Doğrulama & Veri Modelleri:** Pydantic v2
- **Test Çerçevesi:** `pytest`, `pytest-asyncio`, FastAPI `TestClient`
- **Konfigürasyon:** `pydantic-settings` ve `.env` tabanlı ortam yönetimi

### Frontend Yığını
- **Kütüphane & Dil:** React 18 + TypeScript + Vite
- **Stil Yönetimi:** CSS Modules (Bileşen bazlı izole CSS) + CSS Değişkenleri (Semantik Tasarım Token'ları)
- **Grafik & Veri Görselleştirme:** Recharts (CPU/Bellek trendleri, Signal Wait gauge'ları, bellek segmentleri)
- **İkon Seti:** Lucide React (Tutarlı, minimalist SVG ikonlar)
- **Veri Tabloları:** `DataTable` (Çoklu kolon filtreleme, sıralama, sayfalama ve boş durum yönetimi)
- **Tema Motoru:** Koyu Tema Öncelikli (`dark` default, `light` destekli, `localStorage` kalıcı tema anahtarı)

---

## 3. Dizin Ağacı (Directory Structure)

```
datapath/
├── backend/
│   ├── app/
│   │   ├── api/                    # REST API Uç Nokta Yönlendiricileri
│   │   │   ├── agent_jobs.py       # SQL Agent işleri, adım geçmişi, kritik alarmlar & Database Mail
│   │   │   ├── backups.py          # Yedekleme geçmişi, RPO riski, DBCC CHECKDB & suspect_pages radarı
│   │   │   ├── connections.py      # SQL Server bağlantı testi ve sunucu doğrulama
│   │   │   ├── extended_events.py  # XE oturum yaşam döngüsü ve system_health ring buffer ayrıştırma
│   │   │   ├── health.py           # Backend sağlık ve sürüm uç noktası (/api/health)
│   │   │   ├── high_availability.py# Always On AG topolojisi, replika sağlık durumları
│   │   │   ├── incidents.py        # Olay merkezi, kilitlenme zaman çizelgesi & deadlock ayrıştırma
│   │   │   ├── indexes.py          # Eksik, kullanılmayan, tekrarlayan ve parçalanmış indeksler
│   │   │   ├── instances.py        # Canlı oturumlar, bloklayıcı zincirleri & sunucu meta verileri
│   │   │   ├── permissions.py      # Logins, database users, sysadmin denetimi & yetim kullanıcılar
│   │   │   ├── query_performance.py# Query Store en maliyetli sorgular, gerilemeler & anti-desenler
│   │   │   ├── schema_diff.py      # İki veritabanı arası şema karşılaştırması ve review-only DDL
│   │   │   ├── servers.py          # Çoklu sunucu profil kaydı (Server Registry) & geçiş API'si
│   │   │   ├── storage.py          # Disk doluluğu, autogrowth, VLF mimarisi & I/O dosya gecikmesi
│   │   │   ├── tempdb_memory.py    # TempDB alan çekişmesi, PLE, Buffer Pool & Memory Grants
│   │   │   └── toolkit.py          # Aranabilir ve kopyalanabilir DBA T-SQL teşhis betikleri
│   │   ├── core/
│   │   │   ├── config.py           # Ortam değişkenleri, ayarlar ve gizli anahtar yönetimi
│   │   │   └── exceptions.py       # Özel API hata sınıfları ve HTTP durum eşleyicileri
│   │   ├── db/
│   │   │   └── connection.py       # pyodbc bağlantı havuzu, context manager & satır sözlük dönüştürücü
│   │   ├── schemas/                # Pydantic v2 İstek/Yanıt Şemaları
│   │   │   ├── agent_jobs.py       # Jobs, step history, sysalerts ve sysmail modelleri
│   │   │   ├── backups.py          # Backups, RPO readiness, CHECKDB ve suspect_pages modelleri
│   │   │   ├── extended_events.py  # XESession, RingBufferEvent ve XETemplate modelleri
│   │   │   ├── indexes.py          # Missing, Unused, Redundant, Fragmented index modelleri
│   │   │   ├── instances.py        # Session, BlockingChain, ServerMetadata modelleri
│   │   │   ├── permissions.py      # Logins, Users, Roles, SecurityFinding modelleri
│   │   │   ├── query_performance.py# QueryStore, ExpensiveQuery, PlanWarning modelleri
│   │   │   ├── schema_diff.py      # SchemaDiffRequest, DiffResult modelleri
│   │   │   ├── servers.py          # ServerProfile, ServerProfileCreate modelleri
│   │   │   ├── storage.py          # DatabaseFile, Autogrowth, VLF, OpenTransaction, FileIOLatency
│   │   │   ├── tempdb_memory.py    # TempDB, BufferPool, PlanCacheBloat, QueryMemoryGrant
│   │   │   └── wait_stats.py       # WaitStatEntry, CategoryWaitSummary modelleri
│   │   ├── services/               # Saf İş Mantığı ve SQL Server DMV Sorguları
│   │   │   ├── agent_jobs_service.py
│   │   │   ├── backup_service.py
│   │   │   ├── connection_service.py
│   │   │   ├── demo_data.py        # Canlı bağlantı olmadığında devreye giren yüksek sadakatli demo veri
│   │   │   ├── extended_events_service.py
│   │   │   ├── ha_service.py
│   │   │   ├── incident_service.py
│   │   │   ├── index_service.py
│   │   │   ├── instance_service.py
│   │   │   ├── permissions_service.py
│   │   │   ├── query_performance_service.py
│   │   │   ├── schema_diff_service.py
│   │   │   ├── server_registry.py
│   │   │   ├── storage_service.py
│   │   │   ├── tempdb_memory_service.py
│   │   │   ├── toolkit_service.py
│   │   │   └── wait_stats_service.py
│   │   └── main.py                 # FastAPI Uygulama Giriş Noktası & CORS Yapılandırması
│   ├── tests/                      # pytest Birim ve Entegrasyon Testleri (46 test)
│   ├── requirements.txt            # Python Bağımlılıkları
│   └── pytest.ini                  # Test Yapılandırması
├── frontend/
│   ├── src/
│   │   ├── app/                    # React Router Rota Yapılandırması & App İskeleti
│   │   ├── components/             # Yeniden Kullanılabilir Ortak UI Bileşenleri
│   │   │   ├── layout/             # TopBar, Sidebar, PageHeader
│   │   │   ├── report/             # DossierReportModal (Kapsamlı Mühendislik Raporu)
│   │   │   └── ui/                 # DataTable, StatusBadge, LoadingSpinner, ErrorState, EmptyState
│   │   ├── config/                 # brand.ts (Merkezi Marka Tanımlayıcıları)
│   │   ├── features/               # Modüler Özellik Sayfaları ve Alt Bileşenler
│   │   │   ├── agent-jobs/         # SQL Agent işleri, alarmlar ve Database Mail izleme
│   │   │   ├── backups/            # Yedekleme geçmişi, RPO hazırlığı & suspect_pages radarı
│   │   │   ├── dashboard/          # Birleşik sistem gösterge paneli ve KPI'lar
│   │   │   ├── extended-events/    # XE oturumları ve system_health olayları
│   │   │   ├── high-availability/  # AlwaysOn Availability Groups durumu
│   │   │   ├── incidents/          # Kilitlenmeler, Deadlock XML ayrıştırma ve zaman çizelgesi
│   │   │   ├── indexes/            # Eksik, kullanılmayan, mükerrer ve parçalanmış indeksler
│   │   │   ├── instances/          # Sunucu bağlantıları, canlı oturumlar ve kök bloklayıcılar
│   │   │   ├── permissions/        # Güvenlik, roller, yetim kullanıcılar ve sysadmin denetimi
│   │   │   ├── query-performance/  # Query Store en pahalı sorgular ve plan anti-desenleri
│   │   │   ├── schema-diff/        # Veritabanı şema karşılaştırması ve review-only DDL
│   │   │   ├── settings/           # Genel ayarlar ve ortam tercihleri
│   │   │   ├── storage/            # Disk doluluğu, autogrowth, VLF ve açık işlemler
│   │   │   ├── tempdb/             # TempDB çekişmesi, PLE, Buffer Pool ve Memory Grants
│   │   │   ├── toolkit/            # Kategorize DBA T-SQL betik kütüphanesi
│   │   │   └── wait-stats/         # Bekleme istatistikleri ve Signal Wait oranı
│   │   ├── lib/                    # api.ts (REST İstemcisi), types.ts (TypeScript Türleri)
│   │   └── styles/                 # Global CSS değişkenleri, renk paletleri ve yardımcı stiller
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── TODO.md                         # Önceliklendirilmiş Güvenlik ve Geliştirme Yol Haritası
├── TODOlist.md                     # Adım Adım İlerleme ve Sayfa Bazlı İşlem Defteri
└── CLAUDE.md                       # Bu Kılavuz Belgesi
```

---

## 4. Veri Modelleri ve Şemalar (Schemas)

Tüm veri modelleri backend'de Pydantic v2 sınıfları olarak, frontend'de ise karşılık gelen TypeScript arayüzleri (`src/lib/types.ts`) olarak tanımlanmıştır:

| Şema / Model | Birincil Alanlar | Açıklama ve Kaynak |
| :--- | :--- | :--- |
| `ServerMetadata` | `server_name`, `version`, `edition`, `cpu_count`, `memory_gb`, `uptime` | Sunucu donanım ve işletim sistemi kimliği (`SERVERPROPERTY`, `sys.dm_os_sys_info`) |
| `SessionInfo` | `session_id`, `status`, `cpu_time`, `logical_reads`, `sql_text`, `blocking_session_id` | Canlı oturumlar ve sorgular (`sys.dm_exec_requests`, `sys.dm_exec_sessions`) |
| `BlockingChain` | `root_blocker_session_id`, `blocked_sessions_count`, `chain_depth`, `nodes[]` | Kilitlenme zincirindeki kök engelleyici oturum ve etkilenen alt kollar |
| `DeadlockResult` | `victim_session_id`, `deadlock_graph_xml`, `process_list[]`, `resource_list[]` | XDL/XML deadlock grafiği ayrıştırma motoru çıktısı |
| `ExpensiveQuery` | `query_id`, `avg_cpu_time_ms`, `avg_logical_reads`, `execution_count`, `query_sql_text` | Query Store bazlı en maliyetli sorgular (`sys.query_store_runtime_stats`) |
| `PlanWarningQuery` | `query_id`, `warning_type`, `table_name`, `spill_mb`, `plan_xml` | Yürütme planı anti-desenleri (`CONVERT_IMPLICIT`, TempDB Spill, Index Scan) |
| `MissingIndex` | `database_name`, `table_name`, `equality_columns`, `inequality_columns`, `impact_score` | DMV eksik indeks tespiti (`sys.dm_db_missing_index_details`) |
| `RedundantIndex` | `table_name`, `index_name`, `overlapping_index_name`, `redundancy_type`, `drop_sql` | Önek çakışmalı ve mükerrer indeksler (Gereksiz INSERT/UPDATE I/O yükü) |
| `WaitStatsSummary` | `top_waits[]`, `signal_wait_ratio_percent`, `cpu_pressure_detected`, `tuning_recs[]` | Sunucu kaynak bekleme analitiği (`sys.dm_os_wait_stats`) |
| `DatabaseVLFInfo` | `database_name`, `vlf_count`, `active_vlf_count`, `status`, `remediation_script` | Sanal Log Dosyası (VLF) şişmesi ve küçültme/büyütme reçeteleri |
| `OpenTransaction` | `transaction_id`, `session_id`, `host_name`, `login_name`, `elapsed_time_sec`, `is_sleeping` | Açık kalan uncommitted işlemler (`sys.dm_tran_active_transactions`) |
| `LogReuseWaitDetail`| `database_name`, `log_reuse_wait_desc`, `risk_level`, `remediation_sql` | Log kesilmesini durduran kök neden (`sys.databases.log_reuse_wait_desc`) |
| `BufferPoolDatabaseUsage` | `database_name`, `buffer_pool_mb`, `dirty_pages_mb`, `clean_pages_mb` | RAM'deki veri sayfalarının DB bazlı dağılımı (`sys.dm_os_buffer_descriptors`) |
| `PlanCacheBloatAnalysis` | `total_cached_plans_count`, `single_use_plans_count`, `wasted_adhoc_mb`, `status` | Tek seferlik ad-hoc sorgu planlarının bellek israfı analizi |
| `QueryMemoryGrantDetail` | `session_id`, `requested_memory_mb`, `granted_memory_mb`, `wait_time_ms`, `is_waiting` | Sorgu çalışma belleği ve `RESOURCE_SEMAPHORE` beklemesi (`sys.dm_exec_query_memory_grants`) |
| `SuspectPageRecord` | `database_name`, `file_id`, `page_id`, `event_type`, `error_count`, `page_restore_sql` | Fiziksel bozuk 8KB sayfalar ve sayfa kurtarma reçetesi (`msdb.dbo.suspect_pages`) |
| `DatabaseIntegrityCheck` | `database_name`, `last_clean_checkdb`, `days_since_checkdb`, `status`, `page_verify_option` | Son başarılı `DBCC CHECKDB` tarihi (`DATABASEPROPERTYEX`, DBINFO) |
| `SQLAlertDetail` | `name`, `message_id`, `severity`, `enabled`, `occurrence_count`, `has_notification` | SQL Server Agent kritik alarmları (`msdb.dbo.sysalerts` - Sev 17-25, 823-825) |
| `DatabaseMailStatus` | `mail_queue_status`, `total_failed_items`, `recent_failed_items[]`, `restart_queue_sql` | Database Mail servis kuyruğu ve iletim hata teşhisi (`msdb.dbo.sysmail_*`) |
| `ServerProfile` | `id`, `name`, `host`, `port`, `default_database`, `environment`, `is_active`, `latency_ms` | Çoklu sunucu ortam kaydı ve anlık erişilebilirlik durumu |

---

## 5. Veri Akışı ve Tanılama Hattı (Data Flow)

```
1. Kullanıcı Arayüzü Tetikleme
   → İlgili ekran açılır veya üst bardan sunucu profili seçilir (Örn: /tempdb veya /storage)
   → React bileşeni apiClient üzerinden ilgili FastAPI endpoint'ini çağırır.

2. Backend Bağlantı ve Çözümleme
   → FastAPI endpoint'i, ConnectionParams nesnesini oluşturur.
   → Ortamda geçerli bir SQL Server bağlantısı yoksa, yüksek sadakatli DEMO_* veri modelleri devreye girer (Demo Fallback).
   → Canlı bağlantı mevcutsa, pyodbc üzerinden güvenli ve salt okunur TDS bağlantısı kurulur.

3. DMV ve Metrik Sorgulama (Surgical SQL Engine)
   → Hedef SQL Server motorunda doğrudan optimize edilmiş DMV sorguları (WITH TABLERESULTS, CROSS APPLY) yürütülür.
   → Sonuçlar sözlük listelerine (`rows_to_dicts`) dönüştürülür.

4. Kök Neden Analitiği ve Güvenli Reçete Üretimi
   → Backend servisi veriyi işler (Örn: Log reuse wait analizi, suspect page türü, memory waste yüzdesi).
   → Her tespit edilen sorun için parametreli, incelenebilir (review-only) T-SQL düzeltme betiği üretilir.

5. JSON İletimi ve Kullanıcı Deneyimi
   → Veri, Pydantic şeması üzerinden doğrulanarak React istemcisine iletilir.
   → Frontend tabloları filtreler, uyarı rozetlerini renklendirir ve tek tıkla T-SQL kopyalama butonu sağlar.
```

---

## 6. Güvenlik ve Güvenli Varsayılanlar İlkesi (Review-Only Policy)

Datapath, güvenlik açısından **kesinlikle salt okunur (strictly read-only)** bir yaklaşım benimser:

1. **Otonom Eylem Yasağı:**
   Sistem hiçbir koşulda kullanıcı adına arka planda şu işlemleri **otonom veya otomatik olarak çalıştırmaz**:
   - Bir veritabanı oturumunu sonlandırmak (`KILL <spid>`)
   - İndeksleri yeniden oluşturmak (`ALTER INDEX ... REBUILD`)
   - Sunucu parametrelerini değiştirmek (`sp_configure ... RECONFIGURE`)
   - Availability Group yük devretmesi (Failover) tetiklemek
   - Veritabanı veya sayfa geri yükleme komutu (`RESTORE DATABASE`) çalıştırmak
   - Üretilen şema eşitleme DDL betiklerini hedef veritabanında yürütmek

2. **İncelenebilir T-SQL Reçeteleri:**
   Platform her zaman DBA'in inceleyebileceği, test ortamında deneyebileceği ve risklerini anlayabileceği **açıklamalı T-SQL kod blokları** üretir ve arayüzde panoya kopyalama imkanı sunar.

3. **SQL Injection Koruması:**
   Tüm kullanıcı girdileri (filtreler, arama metinleri, sunucu profilleri) backend katmanında parametreli sorgularla çalıştırılır; asla string birleştirme (concatenation) ile dinamik SQL üretilmez.

4. **Hassas Bilgi ve Bağlantı Güvenliği:**
   - SQL Server kullanıcı şifreleri asla terminale, konsola veya uygulama loglarına yazdırılmaz.
   - Tarayıcının `localStorage` alanında hiçbir veritabanı şifresi veya bağlantı dizesi saklanmaz.

---

## 7. Geliştirme Komutları (Development Commands)

### Backend (Python / FastAPI)
```bash
# Backend dizinine geçiş
cd datapath/backend

# Bağımlılıkları yükleme
pip install -r requirements.txt

# Geliştirme sunucusunu başlatma (Port 8000)
uvicorn app.main:app --reload --port 8000

# Otomatik birim ve entegrasyon testlerini çalıştırma (46 test)
pytest

# Belirli bir test modülünü çalıştırma
pytest tests/test_agent_jobs.py
```

### Frontend (React / Vite / TypeScript)
```bash
# Frontend dizinine geçiş
cd datapath/frontend

# Paket bağımlılıklarını kurma
npm install

# Geliştirme sunucusunu başlatma (Port 5173)
npm run dev

# TypeScript tür kontrolü ve üretim derlemesi (Sıfır hata doğrulaması)
npm run build

# Kod önizlemesi
npm run preview
```

---

## 8. Ortam Değişkenleri (Environment Variables)

Platformun `.env` dosyasında yer alan temel değişkenler:

| Değişken | Varsayılan | Açıklama |
| :--- | :--- | :--- |
| `DB_SERVER` | `localhost` | Hedef Microsoft SQL Server sunucu adresi veya IP |
| `DB_DATABASE` | `master` | İlk bağlantının açılacağı veritabanı |
| `DB_USERNAME` | `sa` | SQL Authentication kullanıcı adı (Windows Auth kapalıysa) |
| `DB_PASSWORD` | — | SQL Authentication parolası (Hassas bilgi) |
| `DB_TRUSTED_CONNECTION` | `yes` | Windows Integrated Authentication kullanımı (`yes`/`no`) |
| `DB_DRIVER` | `ODBC Driver 17 for SQL Server` | Kurulu Microsoft ODBC sürücüsü |
| `DB_TIMEOUT` | `5` | Bağlantı zaman aşımı süresi (saniye) |
| `VITE_API_URL` | `http://localhost:8000` | Frontend'in bağlandığı FastAPI backend adresi |

---

## 9. Test ve Kalite Standartlarım

Geliştirdiğin her yeni modül için:
1. Backend tarafında ilgili endpoint ve servisleri kapsayan **pytest testleri** yaz.
2. Canlı veritabanı bağlantısı olmadığında testlerin taklit (mock) veya demo fallback verileriyle eksiksiz çalıştığından emin ol.
3. Frontend tarafında `npm run build` komutunun **sıfır TypeScript ve derleme hatasıyla** bittiğini doğrula.
4. Testleri gerçekten çalıştırmadan bana asla "testler başarılı" deme.

---

## 10. Dokümantasyon ve Canlı Görev Takibi İşleyişi

Projemin kök dizininde bulunan `TODO.md` ve `TODOlist.md` dosyalarını sürecin doğal bir parçası olarak **otonom şekilde güncel tutmanı** istiyorum:
- Tamamlanan her özelliği anında `[x]` olarak işaretle ve ilgili kategorilere işle.
- Sıradaki somut hedefleri öncelik sırasına göre net tut.
- Dosyanın karmaşık ve okunaksız hale gelmesine izin verme; daima kısa, net ve uygulanabilir eylemlerden oluşsun.

---

## 11. Senden Beklediğim Çalışma ve İletişim Akışı

Benimle çalışırken her zaman şu 5 adımı izle:

1. **Adım 1 — İncele:** Kod tabanını, mevcut modelleri ve testleri incele. Çalışan kodu gereksiz yere bozma veya silme.
2. **Adım 2 — Kısaca Planla:** En sade ve doğrudan geliştirme yolunu belirle, uzun teorik metinlerle vakit kaybetme.
3. **Adım 3 — Uygula:** Uçtan uca geliştir; backend şemasını, servisini, API endpoint'ini ve frontend arayüzünü birbiriyle tam uyumlu bağla.
4. **Adım 4 — Doğrula:** `pytest` ile backend testlerini, `npm run build` ile frontend derlemesini çalıştır. Hata çıkarsa kendi kendine çöz.
5. **Adım 5 — Raporla ve Commit'le:** Yapılanları özetle; commit mesajlarını net ve standartlara uygun oluştur (kullanıcı talimatı varsa commit mesajlarında özel kısıtlamalara kesinlikle uy).
