# Datapath — Benim Proje Talimatlarım ve Geliştirme Kılavuzu

> **Ürün Adı:** Datapath
> **Ürün Türü:** Veritabanı Zekası Platformu (Database Intelligence Platform)
> **Birincil Veritabanı:** Microsoft SQL Server
> **Proje Hedefim:** Öncelikle işlevsel bir MVP'yi (Minimum Uygulanabilir Ürün) tamamlayarak profesyonel bir SQL Server DBA platformu oluşturmak.

---

## 1. Genel Kurallar

Tahmin etme; kararsız kaldığında soru sor.

### Temel Prensipler

1. **Çalışan MVP Önceliğim:** Bitmemiş onlarca özellik yerine her zaman eksiksiz çalışan bir MVP'ye öncelik ver.
2. **Sade ve Modüler Mimari:** Mimariyi daima basit, modüler ve sürdürülebilir tut.
3. **Gerçek Veri ve Salt Okunurluk:** Mümkün olan her yerde gerçek SQL Server meta verilerini ve salt okunur (read-only) DMV sorgularını kullan.
4. **Profesyonel Arayüz:** Geliştirdiğin arayüzün tutarlı, modern, responsive ve kurumsal seviyede olmasını bekliyorum.
5. **Aşırı Mühendislikten Kaçınma:** Gereksiz üçüncü parti kütüphanelerden, karmaşık soyutlamalardan ve aşırı mühendislikten (overengineering) kesinlikle kaçın.
6. **Eksiksiz Doğrulama:** Bana bir işi "tamamlandı" olarak bildirmeden önce testleri çalıştır ve varsa derleme/çalışma zamanı hatalarını gider.

---

## 2. Ürün Vizyonu

Datapath'i günlük SQL Server yönetimi, derin kök neden analizi, performans optimizasyonu ve operasyonel görünürlük sağlamak üzere tasarlıyorum.

Platformumun bir DBA olarak bana ve kullanıcılara şu soruların yanıtını net şekilde vermesini istiyorum:

- Şu anda bu SQL Server örneğinde tam olarak neler oluyor?
- Hangi oturumlar (sessions) kilitlenmiş (blocked), onları kilitleyen kök bloklayıcı kim ve hangi sorguyu çalıştırıyor?
- Hangi sorgular en çok CPU, süre veya mantıksal okuma (logical read) tüketiyor?
- Sorgu performanslarında gerileme (regression) veya yürütme planı anti-deseni var mı?
- Veritabanı yedeklemelerim sağlıklı mı, kurtarma hazırlığım (RPO) ne durumda?
- Hangi SQL Server Agent işleri veya adımları başarısız oldu?
- İki veritabanı şeması arasında hangi nesneler farklılaştı?
- Yaşanan bir sorunu güvenle araştırıp çözmek için hangi T-SQL betiklerine ihtiyacım var?
- Açık kalan (uncommitted) sahipsiz işlemler log dosyamı şişiriyor mu, log kesilmesini engelleyen sebep nedir?

### Ürünümün Farkı ve Odak Noktam

İlgilendiğim şirketin halihazırda yüzeysel bir Sağlık Monitörü (Health Monitor) ürünü bulunmaktadır. Bu yüzden senden sıradan bir genel check-up veya uyumluluk tarayıcısını yeniden üretmeni istemiyorum. 

Ben "sisteminde genel bir yavaşlık var" diyen yüzeysel araçlar yerine; **"şu sorgundaki CONVERT_IMPLICIT yüzünden indeks scan ediliyor", "SPID 58 oturumu açık unutulduğu için log truncate edilemiyor"** gibi cerrahi nokta atışı yapan derin DBA teşhis iş akışlarına odaklanıyorum:

- Canlı Olay ve Kilitlenme (Incident & Deadlock) araştırması
- Engelleme (Blocking) zincirleri ve kök bloklayıcı analitiği
- Derin sorgu performansı ve Query Store içgörüleri
- Yedekleme geçmişi, RPO analizi ve kurtarma hazırlığı
- Veritabanları arası şema karşılaştırması (Schema Diff)
- İnceleme amaçlı, güvenli DBA T-SQL araç seti
- Yüksek erişilebilirlik (AlwaysOn Availability Groups) görünürlüğü
- Açık işlemler, VLF mimarisi, Buffer Pool dağılımı ve Plan Cache şişmesi teşhisleri

---

## 3. Seçtiğim Teknoloji Yığını

Projede belirlediğim ve korumak istediğim teknoloji yığını şunlardır:

### Frontend (Ön Yüz)
- **Framework:** React + TypeScript + Vite
- **Stil Yönetimi:** Sürdürülebilir CSS / CSS Modules
- **Grafik:** Yalnızca gerçek ve faydalı bir analitik bilgi sunduğunda Recharts
- **İkonlar:** Tutarlı Lucide Icons seti

### Backend (Arka Uç)
- **Dil & Framework:** Python 3.12+ ve FastAPI
- **Veritabanı Sürücüsü:** pyodbc (ODBC Driver 17 for SQL Server)
- **Doğrulama & Şema:** Pydantic v2
- **Test:** pytest ve pytest-asyncio

### Veritabanı & Katman
- Microsoft SQL Server
- Sistem katalog görünümleri, Dinamik Yönetim Görünümleri (DMV'ler)
- Query Store (aktif olduğunda)

### Mimari Karar
Ben modüler bir monolit yapı tercih ediyorum. Frontend doğrudan backend API ile konuşmalı; tüm SQL Server bağlantıları ve DMV sorguları backend servisleri tarafından güvenle yönetilmelidir. Projeme mikroservisler, RabbitMQ/Kafka gibi mesaj kuyrukları veya Kubernetes gibi gereksiz karmaşık altyapılar eklemeni istemiyorum.

---

## 4. Geliştirme Stratejisi

Projeyi aşamalar halinde, kontrollü bir şekilde büyütmek istiyorum. Bir aşama stabil hale gelmeden diğerine geçilmemelidir.

### Sürüm 0 — İşlevsel MVP
1. Profesyonel, temiz ve koyu temalı uygulama düzeni (`Sidebar`, `TopBar`, `PageHeader`).
2. Canlı sunucuya bağlı olunmadığında açıkça etiketlenmiş demo verileriyle çalışan Dashboard.
3. Güvenli SQL Server bağlantı formu ve test uç noktası.
4. Başarılı bağlantı sonrası sunucu meta verileri ve kaynak bilgileri.
5. Oturumları ve engellemeleri gösteren salt okunur ilk operasyonel ekran.
6. Panoya kopyalanabilir, aranabilir DBA betik kütüphanesi (`ToolkitPage`).
7. Yükleniyor, boş, hata ve demo durumları.
8. Backend sağlık (`/api/health`) uç noktası.
9. `README.md`, `.env.example` ve otomatik birim testleri.

### Sürüm 1 — Olay Merkezi (Incident Center)
- Canlı oturumlar ve engelleme zincirleri (Blocking Chains)
- Deadlock XML yükleme, yapıştırma ve görsel ayrıştırma motoru
- SQL Server Agent başarısız iş geçmişi ve adım detayları
- SQL Server hata günlüğü (Error Log) görüntüleyici
- Olay zaman çizelgesi (Incident Timeline)

### Sürüm 2 — Sorgu Performansı
- Query Store genel bakış metrikleri
- CPU, süre, mantıksal okuma ve çalışma sayısına göre en maliyetli sorgular
- Performans gerileme (Regression) analizi
- Yürütme planı anti-desenleri, TempDB spill ve `CONVERT_IMPLICIT` teşhisi

### Sürüm 3 — Yedekleme ve Şema Araçları
- Veritabanı yedekleme geçmişi (Full, Diff, Log)
- RPO kurtarma hazırlığı ve risk kontrol listesi
- İki veritabanı arasında şema karşılaştırması (Schema Diff)
- Yalnızca inceleme amaçlı üretilen, asla otomatik çalıştırılmayan T-SQL senkronizasyon betikleri

### Sürüm 4 — Gelişmiş Operasyonlar
- Sunucu loginleri, kullanıcılar, roller ve sysadmin denetimi
- AlwaysOn Availability Groups replika sağlık durumları
- Ek DBA analiz araçları

### Sürüm 5 — Derin Kurumsal Teşhis & Zeka
- Canlı işlem gezgini, kök bloklayıcı ve `sp_whoisactive` zekası
- Tekrarlayan ve önek çakışmalı (redundant) indeks tespiti
- Disk büyüme trendi ve kapasite tükenme tahmini (capacity runway)
- `sp_configure` denetimi ve DBA uyumluluk skoru
- VLF mimarisi denetimi ve yeniden boyutlandırma motoru
- Extended Events (XE) oturum yönetimi ve `system_health` ring buffer tanılaması
- Çoklu sunucu ortam geçişi (Multi-Server Registry)
- Açık kalan işlemler (Open Transactions) ve log kesilme engelleri (`log_reuse_wait`)
- Buffer Pool dağılımı ve Ad-Hoc Plan Cache şişmesi (Plan Cache Bloat)

---

## 5. Uygulama Gezinimi (Navigation)

Uygulamamda şu menü yapısını benimsedim:

- **Gösterge Paneli** (`/`)
- **Sunucular & Bağlantı** (`/instances`)
- **Olay Merkezi** (`/incidents`)
- **Sorgu Performansı** (`/query-performance`)
- **İndeks Zekası** (`/indexes`)
- **Bekleme İstatistikleri** (`/waits`)
- **Depolama & Dosyalar** (`/storage`)
- **TempDB & Bellek** (`/tempdb`)
- **Yedekleme & Kurtarma** (`/backups`)
- **Yüksek Erişilebilirlik** (`/high-availability`)
- **DBA Araç Seti** (`/toolkit`)
- **SQL Agent İşleri** (`/agent-jobs`)
- **Şema Karşılaştırması** (`/schema-diff`)
- **İzinler & Güvenlik** (`/permissions`)
- **Ayarlar** (`/settings`)

Hiçbir işlevi olmayan sahte veya boş butonlar koymanı istemiyorum. Sahte verileri de sanki gerçek SQL Server'dan geliyormuş gibi gösterme; canlı bağlantı yoksa bunu her zaman açıkça belirt.

---

## 6. Görsel Tasarım ve Markalama Kurallarım

Arayüzün basit bir öğrenci projesi gibi değil, birinci sınıf bir kurumsal veritabanı platformu gibi hissettirmesini istiyorum.

### Görsel Standartlarım:
- **Karanlık Tema Öncelikli (Dark-first):** Kömür ve grafit tonlarında profesyonel arka planlar.
- **Vurgu Renkleri:** Ölçülü mavi (`accent`), yeşil (başarı), sarı (uyarı) ve kırmızı (kritik hata).
- **Tipografi & Boşluklar:** Temiz, dengeli ve tutarlı boşluk hiyerarşisi.
- **Veri Odaklı Tablolar:** Sayfalama, sıralama ve okunabilir metrikler.
- **Kaçınılacaklar:** Göz yoran neon efektleri, aşırı gradyanlar, anlamsız animasyonlar ve jenerik yer tutucu metinler.

### Markalama:
Marka tanımlarımı tek bir merkezde topladım:
`frontend/src/config/brand.ts`
- **Ürün Adı:** Datapath
- **Ürün Tanımlayıcısı:** Veritabanı Zekası Platformu

Bu bilgileri uygulamanın diğer sayfalarında asla sabit kodlama (hardcode); merkezi yapıdan çek.

---

## 7. SQL Server Bağlantı ve Güvenlik Yönetimi

- Bağlantı testlerini ve DMV sorgularını backend üzerinden güvenle yürüt.
- Kullanıcıya açıklayıcı ve anlaşılır Türkçe hata/başarı mesajları dön.
- **Asla Hassas Bilgi Loglama:** SQL Server şifrelerini veya tam bağlantı dizelerini (connection string) asla terminale veya loglara yazdırma.
- Kimlik bilgilerini tarayıcının `localStorage` alanında saklama.
- Yapılandırma için `.env` dosyasını kullan ve projede her zaman güncel bir `.env.example` bulundur. Gerçek şifre içeren `.env` dosyalarını asla git'e ekleme.

---

## 8. Güvenlik ve Güvenli Varsayılanlar İlkem (Review-Only Policy)

Platformum varsayılan olarak **salt okunur (read-only)** prensibiyle çalışmalıdır.

Senden hiçbir koşulda şu işlemleri **otonom veya otomatik olarak çalıştırmamanı** istiyorum:
- Bir veritabanı oturumunu aniden sonlandırmak (`KILL`)
- İndeksleri doğrudan yeniden oluşturmak (`REBUILD`)
- Sunucu yapılandırmasını (`sp_configure`) değiştirmek
- Availability group failover tetiklemek
- Veritabanını geri yüklemek veya üzerine yazmak
- Üretilen şema eşitleme betiklerini otomatik yürütmek

Bunun yerine her zaman DBA'in inceleyebileceği (review-only), gerekçesi ve riskleri açıkça belirtilmiş **T-SQL iyileştirme betikleri üret** ve kopyalama butonu sağla.

Sorgularda kullanıcı girdilerini asla doğrudan SQL içine birleştirme; SQL Injection riskine karşı her zaman parametreli sorgu kullan.

---

## 9. Proje Dizin Yapım

Mevcut modüler yapıyı koru ve gereksiz klasör karmaşası yaratma:

```text
datapath/
  backend/
    app/
      api/          # REST uç nokta yönlendiricileri (FastAPI routers)
      core/         # Yapılandırma, ayarlar ve özel istisnalar
      db/           # pyodbc bağlantı fabrikası ve bağlam yöneticisi
      schemas/      # Pydantic istek ve yanıt modelleri
      services/     # SQL Server DMV sorguları ve iş mantığı
      main.py       # FastAPI uygulama giriş noktası
    tests/          # pytest birim ve entegrasyon testleri
    requirements.txt
    .env.example
  frontend/
    src/
      app/          # Uygulama iskeleti ve Router
      components/   # Ortak bileşenler (TopBar, Sidebar, DataTable, StatusBadge)
      config/       # Merkezi marka kimliği (brand.ts)
      features/     # Modül bazlı sayfalar ve bileşenler
      lib/          # API istemcisi, TypeScript türleri, yardımcı fonksiyonlar
      styles/       # Global CSS ve değişkenler
  TODO.md           # Dinamik proje pusulası ve görev takibi
  CLAUDE.md         # Bu talimatname
```

---

## 10. Test ve Kalite Standartlarım

Geliştirdiğin her yeni modül için:
1. Backend tarafında ilgili endpoint ve servisleri kapsayan **pytest testleri** yaz.
2. Canlı veritabanı bağlantısı olmadığında testlerin taklit (mock) veya demo fallback verileriyle eksiksiz çalıştığından emin ol.
3. Frontend tarafında `npm run build` komutunun **sıfır TypeScript ve derleme hatasıyla** bittiğini doğrula.
4. Testleri gerçekten çalıştırmadan bana asla "testler başarılı" deme.

---

## 11. Dokümantasyon ve TODO.md İşleyişi

Projemin kök dizininde bulunan `TODO.md` dosyasını sürecin doğal bir parçası olarak **otonom şekilde güncel tutmanı** istiyorum:
- Tamamlanan her özelliği anında `[x]` olarak işaretle ve "Tamamlananlar" bölümüne taşı.
- Sıradaki somut hedefleri "Sıradaki Görevler" başlığı altında net tut.
- Dosyanın karmaşık ve okunaksız hale gelmesine izin verme; daima kısa ve uygulanabilir eylemlerden oluşsun.

---

## 12. Senden Beklediğim Çalışma ve İletişim Akışı

Benimle çalışırken her zaman şu 5 adımı izle:

1. **Adım 1 — İncele:** Kod tabanını, mevcut modelleri ve testleri incele. Çalışan kodu gereksiz yere bozma veya silme.
2. **Adım 2 — Kısaca Planla:** En sade ve doğrudan geliştirme yolunu belirle, uzun teorik metinlerle vakit kaybetme.
3. **Adım 3 — Uygula:** Uçtan uca geliştir; backend şemasını, servisini, API endpoint'ini ve frontend arayüzünü birbiriyle tam uyumlu bağla.
4. **Adım 4 — Doğrula:** `pytest` ile backend testlerini, `npm run build` ile frontend derlemesini çalıştır. Hata çıkarsa kendi kendine çöz.
5. **Adım 5 — Raporla ve Commit'le:** 
