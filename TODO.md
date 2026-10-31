# Datapath — Güvenlik Denetimi, Mimari & Geliştirme Yol Haritası (TODO)

> **Oluşturulma Tarihi:** 2026-10-30  
> **Durum:** Canlı Üretim Ortamlarına Açılmadan Önceki Kapsamlı Görev Matrisi  
> **Hedef:** Kurumsal Seviye Microsoft SQL Server Veritabanı Zekası Platformu

---

## 🔴 KRİTİK — Hemen Düzeltilmeli / Öncelikli (Güvenlik & Veri Bütünlüğü)

### GÜVENLİK & GÜVENLİ VARSAYILANLAR
- [x] **[SEC-01] Salt Okunur (Read-Only) Güvenlik Prensibinin Korunması**
  - Dosyalar: `backend/app/services/*`
  - Platform kesinlikle otonom `KILL`, `ALTER INDEX`, `RECONFIGURE` veya `RESTORE` komutları çalıştırmaz.
  - Tüm operasyonel düzeltmeler review-only açıklamalı T-SQL kod blokları olarak sunulur.

- [x] **[SEC-02] SQL Server Şifre ve Bağlantı Dizesi Güvenliği**
  - Dosyalar: `backend/app/core/config.py`, `backend/app/db/connection.py`
  - Şifreler terminale, konsola veya HTTP loglarına kesinlikle yazdırılmaz.
  - Tarayıcının `localStorage` alanına hiçbir hassas veritabanı parolası kaydedilmez.

- [x] **[SEC-03] SQL Injection ve Parametreli Sorgu Koruması**
  - Dosyalar: `backend/app/services/*.py`
  - Kullanıcıdan gelen tüm arama, filtre ve sunucu parametreleri `pyodbc` üzerinden parametreli (`?`) olarak işletilir; string birleştirme ile dinamik sorgu üretilmez.

### VERİ BÜTÜNLÜĞÜ & KRİZ TEŞHİSİ
- [x] **[CORE-01] Fiziksel Disk Bozuk Sayfa Radarı (`msdb.dbo.suspect_pages`)**
  - Dosyalar: `backend/app/services/backup_service.py`, `frontend/src/features/backups/BackupRecoveryPage.tsx`
  - I/O alt sisteminde yakalanan 823/824 ve Torn Page bozulmalarını anında kırmızı alarm olarak raporlar.
  - Bütün veritabanını geri yüklemeden tek tıkla sayfa bazlı kurtarma (`Page Restore`) T-SQL reçetesi üretir.

- [x] **[CORE-02] SQL Server Kritik Sistem Alarmları Radarı (`msdb.dbo.sysalerts`)**
  - Dosyalar: `backend/app/services/agent_jobs_service.py`, `frontend/src/features/agent-jobs/components/AlertsAndMailViewer.tsx`
  - Error 823, 824, 825 (Donanım/Checksum) ve Severity 17-25 (Öldürücü sistem hataları) tanımlarını denetler.
  - Eksik alarmları "Kör Nokta" olarak işaretleyip tek tıkla toplu alarm oluşturma betiği üretir.

- [x] **[CORE-03] Database Mail Kuyruk ve Başarısızlık İncelemesi (`msdb.dbo.sysmail_*`)**
  - Dosyalar: `backend/app/services/agent_jobs_service.py`, `frontend/src/features/agent-jobs/components/AlertsAndMailViewer.tsx`
  - Takılan veya SMTP relay hatası alan kritik DBA bildirim maillerini ve servis durumunu (`STARTED`/`STOPPED`) görüntüler.

---

## 🟠 YÜKSEK — Bu Sprint İçinde (Temel DBA Zekası)

### TEŞHİS & OPERASYONEL GÖRÜNÜRLÜK
- [x] **[FEAT-01] Açık Kalan İşlemler (Open Transactions) & `log_reuse_wait` Teşhisi**
  - `sys.dm_tran_active_transactions` üzerinden commit edilmemiş sahipsiz `sleeping` oturumları listeler.
  - LDF dosyasının kesilmesini engelleyen kök nedeni (`ACTIVE_TRANSACTION`, `REPLICATION`, `LOG_BACKUP`) ortaya çıkarır.

- [x] **[FEAT-02] Buffer Pool Bellek Dağılımı (Veritabanı & Tablo Bazında)**
  - `sys.dm_os_buffer_descriptors` ile RAM'i işgal eden veritabanlarını ve tabloları analiz eder.
  - Diske yazılmayı bekleyen kirli (dirty) sayfalar ile temiz sayfaların oranını gösterir.

- [x] **[FEAT-03] Ad-Hoc Plan Cache Şişmesi (Plan Cache Bloat) & Bellek Geri Kazanımı**
  - Tek seferlik çalıştırılan dinamik sorguların bellekte yarattığı israfı hesaplar.
  - `optimize for ad hoc workloads` sunucu parametresini önerir ve T-SQL reçetesi sağlar.

- [x] **[FEAT-04] Çalışma Belleği Hibeleri & `RESOURCE_SEMAPHORE` Kuyruk Teşhisi**
  - `sys.dm_exec_query_memory_grants` ile büyük Sort/Hash Join sorgularının bellek bekleme sürelerini gösterir.
  - Aşırı tahsis edilen bellek israfını (Over-grant Waste) hesaplar.

- [x] **[FEAT-05] Çoklu Sunucu Profil Yönetimi (Multi-Server Registry)**
  - Üst barda global sunucu seçicisi, Production/Staging/Dev ortam etiketleri ve anlık gecikme (latency) ölçümü.

- [x] **[FEAT-06] Tek Tıkla Kapsamlı Mühendislik Teşhis Dosyası (Dossier Export)**
  - Üst çubuktaki buton ile o anki sunucunun kilitlenme, bellek, disk, bütünlük ve alarm verilerini derleyip Markdown, HTML/PDF ve JSON olarak dışa aktarır.

---

## 🟡 ORTA — Sonraki Sprint (Gelişmiş Analitik & Optimizasyon)

### PERFORMANS & İNDEKS ZEKÂSI
- [x] **[FEAT-07] Tekrarlayan & Önek Çakışmalı İndeks Analizörü (Redundant Indexes)**
  - `sys.indexes` üzerinden aynı kolon önekini paylaşan gereksiz indeksleri bulur, `DROP INDEX` önerir.

- [x] **[FEAT-08] Virtual Log File (VLF) Mimarisi & Boyutlandırma Motoru**
  - 1000'den fazla VLF içeren veritabanlarını uyarır, log dosyasını doğru büyütme/küçültme adımlarını sunar.
  - Bağımsız `/api/storage/vlfs` uç noktası ve 1 tıkla T-SQL küçültme/büyütme reçetesi sağlar.

- [x] **[FEAT-09] Disk Kapasite Tükenme Tahmini (Capacity Runway Forecasting)**
  - Son 30/60/90 günlük büyüme trendini hesaplar ve diskin dolmasına kalan gün sayısını modeller.

- [x] **[FEAT-10] TempDB Allocation & Sayfa Mandallanması (PAGELATCH_UP/EX) & Sızıntı Takibi**
  - Dosyalar: `backend/app/services/tempdb_memory_service.py`, `frontend/src/features/tempdb/components/TempDBContentionViewer.tsx`
  - PFS (Page 1), GAM (Page 2), SGAM (Page 3) mandallanmalarını tespit eder.
  - `sys.dm_db_session_space_usage` ile `#temp` ve internal sıralama alanı sızdıran uyuyan işlemleri yakalar, çoklu dosya ve `AUTOGROW_ALL_FILES` reçetesi sunar.

- [x] **[FEAT-11] Plan Gerileme Radarı & Plan Zorlama (Query Store Plan Forcing)**
  - Dosyalar: `backend/app/services/query_performance_service.py`, `frontend/src/features/query-performance/QueryPerformancePage.tsx`
  - Baseline döneme kıyasla süresi ve CPU'su %500 ile %2500 arasında artan sorguları listeler.
  - Tek tıkla güvenli `sp_query_store_force_plan` T-SQL plan sabitleme reçetesi sağlar.

- [x] **[FEAT-12] Canlı Deadlock Grafiği İnteraktif SVG/Canvas Görselleştiricisi**
  - Dosyalar: `frontend/src/features/incidents/components/DeadlockGraphVisualizer.tsx`
  - XML metni yerine tarayıcıda düğüm, kilit yönü, kurban/kazanan ayrımı ve tıklanabilir T-SQL detay çizimi.

---

## 🟢 DÜŞÜK — Backlog (Kurumsal Ekosistem & Bildirimler)

### ENTEGRASYON & BİLDİRİMLER
- [x] **[FEAT-13] Webhook Bildirim Entegrasyonu (Discord, Slack, MS Teams, Generic JSON)**
  - Dosyalar: `backend/app/services/webhook_service.py`, `frontend/src/features/agent-jobs/components/WebhookSettingsView.tsx`
  - Kritik alarm tespit edildiğinde (Deadlock, Error 823/824 bozuk sayfa, Severity 17-25) webhook bildirim fırlatma ve test altyapısı.

- [ ] **[FEAT-13] Rol Tabanlı Erişim Denetimi (RBAC)**
  - Platform içi `Viewer` (Salt Okunur Gözlemci) ve `DBA` (T-SQL Betik Üretici) kullanıcı yetkilendirmesi.

- [ ] **[FEAT-14] Zamanlanmış Sağlık Denetimi & Otomatik E-Posta Raporu**
  - Haftalık sağlık özetini oluşturup ilgili teknik ekibe e-posta ile iletme.

---

## 🔵 ALTYAPI & KALİTE (CI/CD, Test Kapsamı & Doğrulama)

- [x] **[INFRA-01] Backend Birim ve Entegrasyon Testleri (pytest)**
  - 49 adet otomatik test ile tüm API router ve servislerinin %100 doğrulanması.

- [x] **[INFRA-02] Frontend Sıfır-Hata Derleme Kapısı (TypeScript & Vite)**
  - `tsc && vite build` komutunun sıfır hata ve temiz bundle ile tamamlanması.

- [ ] **[INFRA-03] GitHub Actions Otomatik CI/CD Hattı**
  - Her `push` ve `pull_request` anında backend testleri ve frontend derlemesinin otomatik koşulması.

- [ ] **[INFRA-04] Dockerfile & Docker-Compose ile Tek Komutla Kurulum**
  - Backend + Frontend tek bir `docker-compose up` ile ayağa kaldırılabilir hale getirilmesi.

---

## Öncelik Özeti

| Öncelik | Kategori | Tamamlanan | Kalan | Toplam |
| :--- | :--- | :---: | :---: | :---: |
| 🔴 **Kritik** | Güvenlik & Veri Bütünlüğü | 6 | 0 | **6** |
| 🟠 **Yüksek** | Temel DBA Zekası & Tanılama | 6 | 0 | **6** |
| 🟡 **Orta** | Performans & Derin Analitik | 3 | 2 | **5** |
| 🟢 **Düşük** | Entegrasyon & Backlog | 0 | 3 | **3** |
| 🔵 **Altyapı** | Kalite & CI/CD | 2 | 2 | **4** |
| **GENEL TOPLAM** | | **17** | **7** | **24** |

---

## Platform Güvenlik ve Risk Analizi

### Doğrudan Saldırı Riski: YOK
- Platform hiçbir şekilde hedef veritabanına veri yazmaz veya DDL çalıştırmaz.
- Tüm operasyonlar `SELECT` ve DMV sorgulamasıyla sınırlıdır.
- `pyodbc` katmanında kullanıcı girdileri ayrıştırılmış parametreler olarak bağlandığından SQL Injection riski bertaraf edilmiştir.

### Dolaylı Riskler ve Alınan Önlemler:
1. **Üretilen T-SQL Kodunun Canlıda Bilinçsizce Çalıştırılması Riski:**
   - *Önlem:* Platform betikleri otomatik yürütmez; her betiğin başında güvenlik uyarıları, rollback yönergeleri ve etki alanı açıklaması yer alır.
2. **Kimlik Bilgisi Sızıntısı:**
   - *Önlem:* Şifreler terminale ve loglara maskelenmeden yazılmaz; tarayıcı depolama alanında tutulmaz.
3. **Ağır DMV Sorgularının Sunucuya Ek Yük Getirmesi:**
   - *Önlem:* Tüm DMV sorgularında `TOP`, indeksli WHERE filtreleri ve `NOLOCK` benzeri kilitsiz okuma stratejileri kullanılır.
