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
  - `sys.dm_os_buffer_descriptors` ile RAM'deki sayfaların hangi tablolara ait olduğunu çıkarır.
  - Soğuk/sıcak veri ayrımı ve gereksiz RAM tüketen tabloları listeler.

- [x] **[FEAT-03] Plan Cache Şişmesi (Bloat) & Tek Seferlik Sorgu Radarı**
  - `usecounts = 1` ad-hoc planların harcadığı megabaytları ölçer.
  - `optimize for ad hoc workloads` önerisi ve bellek tasarrufu simülasyonu sunar.

- [x] **[FEAT-04] TempDB Tahsis Çekişmesi (PFS / GAM / SGAM Latches)**
  - `sys.dm_os_waiting_tasks` ile TempDB sayfa tahsis darboğazlarını yakalar.
  - Eşit boyutlu veri dosyası (T1117/T1118) yapılandırma kontrolü sağlar.

- [x] **[FEAT-05] Bellek Hibeleri & Bekleyenler (`sys.dm_exec_query_memory_grants`)**
  - `RESOURCE_SEMAPHORE` beklemesiyle kuyrukta bekleyen yüksek bellekli sorguları tespit eder.
  - Şişkin bellek tahsislerini (Over-granting) raporlar.

- [x] **[FEAT-06] İndeks Parçalanma Analizörü & Akıllı Bakım Planlayıcı**
  - Sayfa eşikli ve parçalanma yüzdesine duyarlı dinamik `REORGANIZE` / `REBUILD` T-SQL üretimi.
  - Hazır SQL Server Agent Job scripti çıktısı.

---

## 🟡 ORTA — Sonraki Sprint (Performans & Genişletilmiş Teşhis)

- [x] **[FEAT-07] Akıllı T-SQL Sorgu İyileştirici (Query Rewriter)**
  - Anti-pattern tespiti, SARGable dönüşümler ve yan yana T-SQL diff editörü.

- [x] **[FEAT-08] "What-If" Hipotetik İndeks Simülatörü**
  - Zero-disk WITH STATISTICS_ONLY = -1 ile tahmini maliyet kazanım simülasyonu.

- [x] **[FEAT-09] Otomatik Olay Kök Neden (RCA) Raporlayıcısı**
  - Kilitlenme olayları için executive summary, timeline, CAPA matrisi ve Markdown export.

- [x] **[FEAT-10] Buffer Pool Tomografisi ve Kirli Sayfa Denetleyicisi**
  - Veritabanı bazlı nesne RAM dökümü, dirty page oranı ve kontrollü CHECKPOINT yönergesi.

- [x] **[FEAT-11] Kurumsal Kimlik Doğrulama, Profil Yönetimi ve Google/GitHub OAuth**
  - Kurumsal giriş (`/login`), kayıt (`/register`) ve profil düzenleme (`/profile`) sayfaları.
  - Google ve GitHub OAuth sosyal giriş ve hesap bağlama entegrasyonu.
  - Senior DBA, DB Engineer, Operator ve Viewer 4 kademeli rol ve yetki matrisi.
  - TopBar kullanıcı avatarı, profil kartı açılır penceresi ve güvenli parola yönetimi.

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
| 🟡 **Orta** | Performans, Auth & Derin Analitik | 8 | 1 | **9** |
| 🟢 **Düşük** | Entegrasyon & Backlog | 0 | 3 | **3** |
| 🔵 **Altyapı** | Kalite & CI/CD | 2 | 2 | **4** |
| **GENEL TOPLAM** | | **22** | **6** | **28** |

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
