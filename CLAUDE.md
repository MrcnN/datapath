# Datapath — Claude Code Proje Talimatları

> **Ürün Adı:** Datapath
> **Ürün Türü:** Veritabanı Zekası Platformu (Database Intelligence Platform)
> **Birincil Veritabanı:** Microsoft SQL Server
> **Proje Hedefi:** Öncelikle işlevsel bir MVP'yi (Minimum Uygulanabilir Ürün) tamamlayarak profesyonel bir SQL Server DBA platformu oluşturmak.

---

## 1. Rolünüz ve Göreviniz

Kıdemli bir full-stack geliştirici ve SQL Server DBA (Veritabanı Yöneticisi) olarak hareket edin.

Sorumluluğunuz, sadece planlar, örnekler veya eğitimler sunmak değil, mevcut depoda (repository) çalışan bir uygulama geliştirmektir.

Temel hedef, kişisel bir geliştirici portföyü için olabildiğince hızlı bir şekilde derli toplu ve işlevsel bir proje oluşturmaktır.

### Temel Prensipler

1. Bitmemiş bir sürü özellik yerine çalışan bir MVP'ye öncelik verin.
2. Mimariyi basit, modüler ve sürdürülebilir tutun.
3. Mümkün olduğunca gerçek SQL Server meta verilerini ve salt okunur (read-only) sorguları kullanın.
4. Profesyonel, tutarlı ve duyarlı (responsive) bir arayüz oluşturun.
5. Gereksiz bağımlılıklardan ve aşırı mühendislikten (overengineering) kaçının.
6. Uygulamayı test edin ve çalışmayı tamamlandı olarak bildirmeden önce hataları düzeltin.
7. Ürün adını ve marka kimliğini daha sonra değiştirilebilecek şekilde tek bir merkezde tutun.
8. Planlama aşamasından sonra durmayın. Gerçek kodu yazın.

**Önemli:** Datapath geçici bir çalışma adıdır ve ileride değişebilir. Ürün adını, alt başlığı, sloganı ve marka renklerini uygulamanın her yerine sabit kodlamak (hardcode) yerine tek bir yapılandırma (configuration) dosyasında saklayın.

---

## 2. Ürün Vizyonu

Datapath, günlük SQL Server yönetimi, sorun giderme, performans analizi ve operasyonel görünürlüğe odaklanan bir Veritabanı Zekası Platformudur.

Platform, bir DBA'in şu tür soruları yanıtlamasına yardımcı olmalıdır:

- Bu SQL Server sunucusunda neler oluyor?
- Hangi oturumlar (sessions) engellenmiş (blocked) ve onları ne engelliyor?
- Hangi sorgular en çok CPU, süre veya mantıksal okuma (logical read) tüketiyor?
- Sorgu performans metriklerinde gerileme var mı?
- Veritabanı yedeklemeleri başarıyla çalışıyor mu?
- Hangi SQL Server Agent görevleri başarısız oldu?
- İki veritabanı şeması arasında ne değişti?
- Hangi T-SQL betikleri bir sorunu araştırmaya yardımcı olabilir?

Uygulama bu iş akışlarını tek bir profesyonel arayüzde bir araya getirmelidir.

### Ürün Farklılaşması

Kullanıcının ilgilendiği şirketin halihazırda bir Sağlık Monitörü (Health Monitor) ürünü bulunmaktadır. Sadece bir sağlık izleme veya uyumluluk tarama uygulamasını yeniden yaratmayın.

Pratik DBA iş akışlarına odaklanın:

- Olay (Incident) araştırması
- Engelleme (Blocking) ve oturum analizi
- Sorgu performans analizi
- Query Store (Sorgu Deposu) içgörüleri
- Yedekleme geçmişi ve kurtarma hazırlığı
- Şema karşılaştırması
- SQL Server operasyonel araçları
- Temel yüksek erişilebilirlik (high availability) görünürlüğü

MVP'de tam kapsamlı bir güvenlik uyumluluk tarayıcısı oluşturmayın.

---

## 3. Teknoloji Yığını

Değişiklik yapmadan önce depoyu inceleyin. Halihazırda çalışan bir teknoloji yığını varsa onu koruyun.

Depo boşsa, aşağıdaki teknoloji yığınını kullanın.

### Frontend (Ön Yüz)

- React
- TypeScript
- Vite
- Sürdürülebilir CSS veya CSS Modules
- Yalnızca bir grafik faydalı bilgi sağladığında Recharts kullanımı
- Gerekirse tutarlı bir ikon kütüphanesi

### Backend (Arka Uç)

- Python 3.12+
- FastAPI
- SQL Server bağlantısı için pyodbc
- İstek ve yanıt doğrulama için Pydantic
- Otomatik testler için pytest

### Veritabanı

- Microsoft SQL Server
- Sistem katalog görünümleri ve Dinamik Yönetim Görünümleri (DMV'ler)
- Etkinleştirildiğinde ve erişilebilir olduğunda Query Store

### Mimari

Modüler bir monolit yapı kullanın.

Frontend, backend API ile iletişim kurmalıdır. Tüm SQL Server bağlantıları ve sorguları backend tarafından ele alınmalıdır.

Mikroservisler, mesaj kuyrukları (message brokers), Kubernetes veya gereksiz altyapılar eklemeyin.

Mevcut teknolojileri net bir teknik neden olmadan değiştirmeyin.

---

## 4. Geliştirme Stratejisi

Uygulamayı aşamalar (phases) halinde geliştirin.

**Sonraki sürümleri uygulamadan önce Sürüm 0'ı tamamlayın.**

Planlanan tüm özellikleri aynı anda uygulamaya çalışmayın.

### Sürüm 0 — İşlevsel MVP

MVP şunları içermelidir:

1. Profesyonel uygulama düzeni ve gezinme (navigation).
2. Canlı bir sunucu bağlı olmadığında açıkça belirtilmiş demo verileri içeren gösterge paneli (Dashboard).
3. SQL Server bağlantı yapılandırma formu.
4. Bir SQL Server bağlantısını test etmek için backend uç noktası (endpoint).
5. Başarılı bir bağlantıdan sonra temel sunucu (instance) meta verileri.
6. Oturumları ve engellemeleri görüntülemek için gerçek, salt okunur tek bir operasyonel özellik.
7. Panoya kopyalama (copy-to-clipboard) işlevine sahip, aranabilir DBA betik kütüphanesi.
8. Yükleniyor, boş, hata ve erişim engellendi durumları.
9. Backend sağlık (health) uç noktası.
10. README, `.env.example` ve temel otomatik testler.

MVP sadece statik bir kullanıcı arayüzü (UI) tasarımı (mockup) olmamalıdır.

Mevcut olduğunda, en azından bağlantı testi ve bir operasyonel iş akışı gerçek bir SQL Server sunucusuna karşı çalışmalıdır.

Geliştirme sırasında SQL Server kullanılamıyorsa, özelliği sahte (mocked) testlerle oluşturun ve daha sonra gerçek bir sunucunun nasıl bağlanacağını belgelendirin.

### Sürüm 1 — Olay Merkezi (Incident Center)

Uygulanacaklar:

- Mevcut oturumlar ve engelleme zincirleri
- Deadlock XML yükleme veya yapıştır-ve-ayrıştır iş akışı
- Okunabilir deadlock katılımcıları ve kaynakları
- Başarısız SQL Server Agent görev geçmişi
- Desteklendiğinde SQL Server hata günlüğü (error-log) alımı
- Temel olay zaman çizelgesi

Bir olayın arkasındaki kanıtları görüntüleyin. Doğrulanmış gerçekleri olası açıklamalardan açıkça ayırın.

### Sürüm 2 — Sorgu Performansı

Uygulanacaklar:

- Query Store genel bakış
- Maliyetli sorgu listesi
- Mevcut olduğunda CPU, süre, yürütme sayısı ve mantıksal okumalar
- Zaman aralığı karşılaştırması
- Potansiyel performans gerilemesi göstergeleri
- Pratikse temel yürütme planı (execution plan) incelemesi

Query Store'un devre dışı bırakıldığı veya erişilemediği durumları ele alın.

### Sürüm 3 — Yedekleme ve Şema Araçları

Uygulanacaklar:

- Veritabanı yedekleme geçmişi
- Tam (Full), fark (differential) ve işlem günlüğü (transaction log) yedekleme bilgileri
- Yedekleme güncellik göstergeleri
- Kurtarmaya hazırlık kontrol listesi
- Veritabanları veya anlık görüntüler (snapshots) arasında şema karşılaştırması
- Tablolar, sütunlar, veri türleri, kısıtlamalar, indeksler ve görünümlerdeki farklılıklar
- Yalnızca inceleme amaçlı SQL betiği oluşturma

Oluşturulan şema değişikliği betiklerini asla otomatik olarak yürütmeyin.

### Sürüm 4 — Gelişmiş Operasyonlar

Önceki sürümler stabil olduğunda uygulanacaklar:

- Temel login, kullanıcı, rol ve izin envanteri
- Temel Always On availability group ve replika durumu
- Ek DBA betikleri
- Açık onay ve denetim günlüğü (audit logging) gerektiren isteğe bağlı kontrollü otomasyon

MVP ve temel modüller güvenilir bir şekilde çalışana kadar kapsamı genişletmekten kaçının.

---

## 5. Uygulama Gezinimi (Navigation)

Aşağıdaki gezinim yapısını kullanın:

- Dashboard (Gösterge Paneli)
- Instances (Sunucular)
- Incident Center (Olay Merkezi)
- Query Performance (Sorgu Performansı)
- Backup & Recovery (Yedekleme ve Kurtarma)
- Schema Diff (Şema Karşılaştırması)
- DBA Toolkit (DBA Araç Seti)
- Settings (Ayarlar)

MVP aşamasında öncelikle Dashboard, Instances ve DBA Toolkit'i uygulayın.

Diğer bölümler planlanmış olarak işaretlenebilir veya uygulanana kadar devre dışı (disabled) bırakılabilir.

İşlevsel görünen ancak hiçbir işe yaramayan butonlar oluşturmayın.

Sahte canlı verileri sanki SQL Server'dan geliyormuş gibi göstermeyin.

---

## 6. Görsel Tasarım

Arayüz, başlangıç seviyesinde bir eğitim projesi değil, birinci sınıf bir veritabanı operasyonları ürünü gibi hissettirmelidir.

### Görsel Yönelim

- Karanlık tema öncelikli (Dark-first) arayüz
- Grafit veya kömür rengi arka planlar
- Ölçülü deniz mavisi (teal) veya yeşil vurgu rengi
- Temiz tipografi
- Tutarlı boşluklar
- Hafif kenarlıklar (borders) ve gölgeler
- Kompakt kenar çubuğu (sidebar) navigasyonu
- Okunabilir veri tabloları
- Açık başarı, uyarı ve hata göstergeleri
- Minimal, amaca uygun animasyon
- Duyarlı (responsive) masaüstü ve tablet düzenleri

Kaçınılması gerekenler:

- Aşırı gradyanlar
- Her yerde neon efektleri
- Aşırı büyük gösterge paneli kartları
- Gereksiz animasyonlar
- Aşırı yuvarlatılmış kapsayıcılar (containers)
- Karmaşık tablolar
- Jenerik yer tutucu (placeholder) içerik

Tutarlı boşluklar, tipografi, renk belirteçleri (color tokens) ve yeniden kullanılabilir bileşenler (components) kullanın.

Okunabilir kontrast ve görünür klavye odak durumları (focus states) sağlayın.

Düzeni duyarlı tutun ve yatay taşmaları (horizontal overflow) önleyin.

### Markalama

Markalamayı şu dosya gibi bir merkezde toplayın:

`src/config/brand.ts`

Aşağıdaki değerleri tek bir yerde tutun:

- Ürün adı: Datapath
- Ürün tanımlayıcısı: Veritabanı Zekası Platformu
- Slogan: Araştır. Anla. Çöz.
- Marka renkleri

Ürün adı daha sonra değişebilir, bu nedenle bunu uygulamanın hiçbir yerinde sabit kodlamayın (hardcode).

---

## 7. SQL Server Bağlantı Yönetimi

Bağlantı yönetimini backend üzerinde uygulayın.

Gereksinimler:

- Bağlantı ayarlarını doğrulayın.
- Bir backend uç noktası aracılığıyla bağlantıları test edin.
- Faydalı başarı ve başarısızlık mesajları döndürün.
- Bağlandıktan sonra temel sunucu (instance) meta verilerini alın.
- Bağlantı zaman aşımlarını (timeouts) ele alın.
- Kimlik doğrulama (authentication) hatalarını ele alın.
- Eksik izinleri ele alın.
- Erişilemeyen sunucuları ele alın.
- Kimlik bilgilerini veya hassas bağlantı dizelerini (connection strings) loglamaktan kaçının.

SQL Server kimlik bilgilerini asla sabit kodlamayın.

Backend yapılandırması için ortam (environment) değişkenlerini kullanın ve yer tutucu değerlere sahip bir `.env.example` dosyası sağlayın.

Gerçek `.env` dosyalarını veya gizli anahtarları (secrets) asla commit etmeyin.

Gerekli ODBC sürücüsü kurulumunu belgelendirin.

MVP için açıkça yapılandırılmış bir SQL Server bağlantısına öncelik verin. Karmaşık çok kiracılı (multi-tenant) bağlantı yönetimi oluşturmayın.

Kimlik bilgilerini tarayıcının yerel depolama alanında (local storage) saklamayın.

---

## 8. SQL Server Sorgu Yönergeleri

Mümkün olan her yerde belgelenmiş sistem katalog görünümlerini ve DMV'leri kullanın.

Her operasyonel sorgu şunları yapmalıdır:

- Yalnızca UI'ın ihtiyaç duyduğu sütunları döndürmeli.
- Sınırlı (bounded) sonuç kümeleri kullanmalı.
- Makul zaman aşımları uygulamalı.
- Eksik izinleri sorunsuz (gracefully) bir şekilde ele almalı.
- Üretim (production) sunucularında gereksiz yükten kaçınmalı.
- İlgili SQL Server sürümünü ve izin gereksinimlerini belgelendirmeli.
- Desteklenmeyen özellikleri açıkça ele almalı.

Tüm SQL Server sürümlerinin aynı sütunları veya işlevselliği sunduğunu varsaymayın.

Query Store için, veri almaya çalışmadan önce etkinleştirilip etkinleştirilmediğini kontrol edin.

SQL Server Agent için, özelliğin kullanılamadığı durumları ele alın.

Always On için, availability group'ların (kullanılabilirlik gruplarının) yapılandırılmadığı sunucuları ele alın.

Gerçek bir SQL Server sunucusu kullanılmadığı sürece canlı entegrasyonun test edildiğini iddia etmeyin.

---

## 9. Güvenlik ve Güvenli Varsayılanlar

Uygulama varsayılan olarak salt okunur olmalıdır.

Şunları asla otomatik olarak yapmayın:

- Veritabanı oturumlarını sonlandırmak (Kill)
- İndeksleri yeniden oluşturmak (Rebuild)
- Sunucu yapılandırmasını değiştirmek
- Bir availability group'u failover yapmak
- Bir veritabanını geri yüklemek veya üzerine yazmak
- Yedekleri silmek
- Oluşturulan şema migrasyonlarını (migrations) yürütmek
- Kimliği doğrulanmamış bir istemci tarafından gönderilen rastgele (arbitrary) SQL'leri çalıştırmak

Değerler için parametreli SQL kullanın. Güvenilmeyen kullanıcı girdilerini asla SQL ifadelerine birleştirmeyin (concatenate).

Girdileri (inputs) backend tarafında doğrulayın.

Veritabanı kimlik bilgilerini frontend kodunda, API yanıtlarında, loglarda veya hata mesajlarında asla ifşa etmeyin.

Gelecekteki herhangi bir durum değiştirici işlem varsayılan olarak devre dışı bırakılmalı ve hedefi ve olası etkiyi açıklayan açık bir onay gerektirmelidir.

Geliştirme sırasında yerel veya test amaçlı SQL Server sunucularını kullanın.

Bu kişisel projede işverene ait kaynak kodunu, müşteri verilerini, canlı üretim kimlik bilgilerini veya gizli şemaları kullanmayın.

Uygun kimlik doğrulama ve yetkilendirme (authorization) olmadan, kısıtlanmamış uzak veritabanı bağlantılarını açığa çıkarmayın.

---

## 10. Önerilen Proje Yapısı

Bu yapıyı mevcut depoya uyarlayın. Mevcut klasörleri kopyalamayın veya gereksiz soyutlamalar (abstractions) oluşturmayın.

### Backend

```text
backend/
  app/
    main.py
    api/
    core/
    db/
    schemas/
    services/
  tests/
  requirements.txt
  .env.example
  Sorumluluklar:

main.py: FastAPI uygulaması ve sağlık uç noktası

api/: API yönlendirme işleyicileri (route handlers)

core/: yapılandırma ve paylaşılan yardımcı programlar

db/: bağlantı yönetimi

schemas/: Pydantic istek ve yanıt modelleri

services/: SQL sorguları ve iş mantığı

tests/: otomatik testler

Frontend
Plaintext
frontend/
  src/
    app/
    components/
    config/
      brand.ts
    features/
      dashboard/
      instances/
      incidents/
      query-performance/
      backups/
      schema-diff/
      toolkit/
    lib/
Mevcut özellikleri destekleyen en basit yapıyı kullanın.

Projeyi daha büyük göstermek için içi boş modüller oluşturmayın.

11. API Yönergeleri
Açık, tutarlı REST uç noktaları kullanın.

Önerilen MVP uç noktaları:

GET /api/health

POST /api/connections/test

GET /api/instances/metadata

GET /api/instances/sessions

GET /api/instances/blocking

GET /api/toolkit/scripts

Uç nokta yapısını gerektiğinde ayarlayın, ancak API'yi öngörülebilir tutun.

Gereksinimler:

İstek ve yanıt şemalarını doğrulayın.

Uygun HTTP durum kodlarını döndürün.

Tutarlı hata yanıt biçimleri kullanın.

Yığın izlerini (stack traces) veya gizli bilgileri frontend'e döndürmeyin.

API yönlendirmesini veritabanı sorgu mantığından ayırın.

Frontend API istemcisini paylaşılan bir modülde tutun.

12. Test ve Kalite
En azından şunlar için testler sağlayın:

API sağlık (health) uç noktası

Bağlantı isteği doğrulaması

Bağlantı hatası yönetimi

Sunucu meta verisi yanıt yönetimi

Oturum/engelleme sorgusu yanıt yönetimi

DBA Toolkit arama davranışı

Çoğu testin canlı bir veritabanı olmadan çalışabilmesi için SQL Server çağrılarını taklit (mock) edin.

Deadlock XML ayrıştırma özelliği uygulandığında bunun için testler ekleyin.

Bir sürümü bitirmeden önce:

Mevcut otomatik testleri çalıştırın.

Yapılandırılmışsa frontend lint ve tür kontrollerini (type checks) çalıştırın.

Bozuk import'ları ve çalışma zamanı (runtime) hatalarını düzeltin.

Tarayıcı konsolu hatalarını kontrol edin.

Yükleniyor, boş ve hata durumlarını doğrulayın.

Çalıştırılamayan kontrolleri belgelendirin.

Gerçekten yürütülmediği sürece testleri başarılı olarak bildirmeyin.

13. Dokümantasyon
Aşağıdakileri içeren kısa ama faydalı bir README oluşturun:

Ürün genel bakışı

Mevcut özellikler

Teknoloji yığını

Önkoşullar

Gerekli SQL Server ODBC sürücüsü

Ortam değişkeni kurulumu

Backend kurulumu ve çalıştırma komutları

Frontend kurulumu ve çalıştırma komutları

Test komutları

Bağlantı kurulum talimatları

Gerekli SQL Server izinleri

Güvenlik notları

Mevcut kısıtlamalar

Planlanan özellikler

Gerektiğinde, sadece yer tutucuları kullanarak .env.example dosyalarını dahil edin.

Proje Yönetimi (TODO.md İşleyişi):
Süreci yönetmek ve bir sonraki somut görevlere odaklanmak için projenin kök dizininde bir TODO.md dosyasını otomatik olarak oluşturun ve güncel tutun.

Bu dosya dinamik bir pusula işlevi görmelidir.

Dosya içeriğini "Sıradaki Görevler (To Do)", "Devam Edenler (In Progress)" ve "Tamamlananlar (Done)" şeklinde kategorilere ayırın.

MVP tamamlanana kadar ileri sürümlerin (Sürüm 1, 2 vb.) karmaşık detaylarıyla bu dosyayı doldurmayın; dosyayı daima kısa ve uygulanabilir eylemlerden oluşacak şekilde yapılandırın.

14. Claude Code İş Akışı
Proje üzerinde çalışırken her zaman bu iş akışını izleyin.

Adım 1 — İncele
Mevcut depoyu inceleyin.

Mevcut çerçeveyi (framework), paket yöneticisini ve proje yapısını belirleyin.

Faydalı mevcut kodu koruyun.

Neyin zaten çalıştığını ve neyin eksik olduğunu belirleyin.

Adım 2 — Kısaca Planla
En kısa uygulama (geliştirme) yolunu belirtin.

Oluşturulması veya değiştirilmesi gereken dosyaları belirleyin.

Uzun planlama belgelerinden kaçının.

Adım 3 — Uygula
Sürüm 0 (Release 0) ile başlayın.

Frontend ve backend'i birlikte geliştirin.

Kullanıcı arayüzünü çalışan API uç noktalarına bağlayın.

Mümkün olan yerlerde gerçek SQL Server davranışını uygulayın.

Açıkça etiketlenmiş demo verilerini yalnızca canlı bir bağlantı kullanılamadığında kullanın.

Adım 4 — Doğrula
Mevcut testleri ve kontrolleri çalıştırın.

Hataları sadece raporlamak yerine düzeltin.

Belgelenen komutların gerçek projeyle eşleştiğini doğrulayın.

Doğrulanmamış (unverified) kalan herhangi bir canlı SQL Server testini belirleyin.

Adım 5 — Raporla ve Güncelle
Bir görevin sonunda şunları sağlayın:

Nelerin uygulandığı

Hangi dosyaların değiştiği

Uygulamayı çalıştırmak için kesin komutlar

Yürütülen testler ve kontroller

Bilinen kısıtlamalar

Sonraki üç somut görev

[ZORUNLU] Herhangi bir komut beklemeden TODO.md dosyasını otomatik olarak açın, tamamlanan işleri [x] olarak işaretleyip "Tamamlananlar" kısmına alın ve projenin o anki aşamasına uygun sıradaki görevleri dosyaya ekleyin.

Çalışma Kuralları
Bir plan ürettikten sonra durmayın.

Rutin teknik kararlar için onay istemeyin.

Makul varsayılanları seçin ve devam edin.

Yalnızca eksik bir karar, uygulamayı engelliyorsa veya önemli bir güvenlik ya da veri kaybı riski oluşturuyorsa soru sorun.

Çalışan kodu gereksiz yere yeniden yazmayın.

MVP bozukken sonraki sürümleri uygulamayın.

Sahte işlevlerden ve uydurulmuş canlı metriklerden kaçının.

Herhangi bir hatırlatmaya gerek duymadan TODO.md dosyasını sürecin doğal bir parçası olarak otonom bir şekilde güncelleyin.

Yanıtları kısa ve uygulamaya odaklı tutun.

15. MVP Bitti Tanımı (Definition of Done)
Sürüm 0, yalnızca aşağıdaki durumlarda tamamlanmış sayılır:

[ ] Frontend belgelenmiş komutları kullanarak başlatılabiliyor.

[ ] Backend belgelenmiş komutları kullanarak başlatılabiliyor.

[ ] Gösterge paneli (Dashboard) çalışma zamanı hataları olmadan render ediliyor.

[ ] Demo verileri açıkça belirtilmiş.

[ ] SQL Server bağlantı ayarları güvenli bir şekilde gönderilebiliyor.

[ ] Bağlantıyı Test Et (Test Connection) faydalı bir sonuç döndürüyor.

[ ] Başarılı bağlantılar temel sunucu meta verilerini döndürüyor.

[ ] Bir bağlantı mevcut olduğunda en az bir operasyonel ekran gerçek SQL Server verilerini çekebiliyor.

[ ] DBA Toolkit betikleri aranabiliyor ve kopyalanabiliyor.

[ ] Yükleniyor, boş, hata ve izin durumları ele alınmış durumda.

[ ] Otomatik testler geçiyor veya engellenen kontroller belgelenmiş durumda.

[ ] README ve .env.example mevcut.

[ ] Markalama merkezi hale getirilmiş ve kolayca değiştirilebiliyor.

[ ] TODO.md dosyası oluşturulmuş ve proje süreciyle uyumlu şekilde güncelleniyor.

16. İlk Görev — Hemen Geliştirmeye Başla
Depoyu inceleyin ve Sürüm 0'ı uçtan uca uygulayın.

Kişisel bir geliştirici portföyünde gösterilebilecek güvenilir, işlevsel bir MVP'ye giden en kısa yol için optimize edin.

Planlanan her modülü aynı anda uygulamayın.

Çalışan yazılıma, net belgelendirmeye, güvenli salt okunur SQL Server entegrasyonuna ve profesyonel bir kullanıcı deneyimine öncelik verin.

Mevcut çalışma adı olarak Datapath'i ve ürün tanımlayıcısı olarak Veritabanı Zekası Platformu'nu kullanın. Markalamayı merkezde tutun, böylece ad daha sonra tüm kod tabanını düzenlemeden değiştirilebilir.