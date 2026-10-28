# Datapath — Veritabanı Zekası Platformu (Database Intelligence Platform)

> **Slogan:** Araştır. Anla. Çöz. (Investigate. Understand. Resolve.)  
> **Birincil Veritabanı:** Microsoft SQL Server  
> **Mimari:** Modüler Monolit (FastAPI Backend + React/TypeScript Frontend)

---

## 📌 Ürün Genel Bakışı

Datapath, Microsoft SQL Server veritabanı yöneticileri (DBA) ve sistem mühendisleri için geliştirilmiş profesyonel bir operasyon, sorun giderme ve performans analiz platformudur. 

Geleneksel uyumluluk tarayıcılarının aksine Datapath, doğrudan günlük operasyonel iş akışlarına odaklanır:
- **Neler Oluyor?** — Canlı oturumlar, kaynak tüketimleri ve beklemeler.
- **Kimi Kim Engelliyor?** — Engelleme zincirleri (head blocker tespiti) ve kilitlenme (deadlock) XML grafik analizi.
- **Performans Neden Düştü?** — Query Store runtime istatistikleri ve performans gerilemesi tespiti.
- **Felakete Hazır mıyız?** — RPO bazlı yedekleme güncelliği ve kurtarma kontrol listesi.
- **Ne Değişti?** — İki veritabanı şeması arasındaki nesne ve sütun farkları (salt inceleme amaçlı güvenli betik üretimi).

---

## 🚀 Özellikler ve Modüller

### Sürüm 0 — İşlevsel MVP
- **Gösterge Paneli (Dashboard):** Canlı sunucu bağlı olmadığında açıkça etiketlenmiş demo verileriyle genel sağlık, oturum eğilimleri ve veritabanı durumları.
- **Sunucu & Bağlantı Yönetimi (Instances):** Windows / SQL Server kimlik doğrulaması, bağlantı testi ve sunucu meta verileri (sürüm, CPU, RAM, veritabanları).
- **DBA Araç Seti (Toolkit):** 20'den fazla kategorize edilmiş, aranabilir ve tek tıkla kopyalanabilir T-SQL teşhis betiği (Salt Okunur / Dikkat / Tehlikeli güvenlik etiketleriyle).

### Sürüm 1 — Olay Merkezi (Incident Center)
- **Aktif Oturumlar:** DMV tabanlı CPU, IO, bellek ve çalışan SQL metinleri.
- **Engelleme Zincirleri (Blocking):** Kök bloklayıcıları ve etkilenen oturumları ağaç yapısında görselleştirme.
- **Deadlock Ayrıştırıcı:** XDL / XML deadlock grafiklerini kurban, işlem ve kilitli nesne düzeyinde ayrıştırma.
- **SQL Server Agent İşleri:** msdb üzerinden başarısız iş adımları ve hata mesajları.
- **Hata Günlüğü (Error Log):** sp_readerrorlog entegrasyonu ile filtrelenebilir sunucu hata kayıtları.
- **Olay Zaman Çizelgesi (Timeline):** Kilitlenmeler, başarısız işler ve kritik hataların birleşik kronolojisi.

### Sürüm 2 — Sorgu Performansı (Query Store)
- **Query Store Durumu:** Etkinlik, yakalama modu ve depolama kullanım metrikleri.
- **Maliyetli Sorgular:** CPU, toplam süre, mantıksal okuma ve çalışma sayısına göre en ağır sorgular.
- **Performans Gerilemesi (Regressions):** Önceki zaman aralığına göre kötüleşen sorguların otomatik tespiti.

### Sürüm 3 — Yedekleme ve Şema Araçları
- **Yedekleme Geçmişi:** Tam (Full), fark (Differential) ve işlem günlüğü (Log) boyutları, süreleri ve sıkıştırma oranları.
- **Kurtarma Hazırlığı (Recovery Readiness):** RPO risk seviyesi ve eksik yedek uyarıları.
- **Şema Karşılaştırması (Schema Diff):** İki veritabanı arasındaki tablo, sütun, görünüm ve indeks farklarını tespit etme.
- **Yalnızca İnceleme Amaçlı Değişim Betiği:** Şema değişikliklerini uygulamak için SQL üretir; **asla otomatik çalıştırmaz**.

### Sürüm 4 — Gelişmiş Operasyonlar
- **İzin ve Güvenlik Envanteri:** Sunucu loginleri, veritabanı kullanıcıları, roller ve sysadmin yetki tespiti.
- **Yüksek Erişilebilirlik (Always On AG):** Kullanılabilirlik grupları, birincil/ikincil replika durumları ve senkronizasyon sağlığı.

---

## 🛠️ Teknoloji Yığını

| Katman | Teknoloji | Açıklama |
|---|---|---|
| **Frontend** | React 18, TypeScript, Vite | CSS Modules, Dark-first tema (Grafit & Teal), Recharts, Lucide İkonları |
| **Backend** | Python 3.12+, FastAPI | Pydantic v2, RESTful API, Uvicorn |
| **Veritabanı Erişimi** | pyodbc | Microsoft ODBC Driver for SQL Server, DMVs & System Catalogs |
| **Test** | pytest, httpx | Sahte (mocked) test paketi ile bağımsız doğrulama |

---

## 🔒 Güvenlik İlkeleri ve Güvenli Varsayılanlar

1. **Varsayılan Olarak Salt Okunur:** Uygulama hiçbir zaman otomatik olarak oturum sonlandırmaz (`KILL`), indeksleri yeniden oluşturmaz (`REBUILD`), veritabanı geri yüklemez veya şema migrasyonu çalıştırmaz.
2. **Kimlik Bilgisi Güvenliği:** Parolalar ve bağlantı dizeleri asla sunucu loglarına yazılmaz, istemci tarafına (Local Storage) kaydedilmez.
3. **Parametreli Sorgular:** Tüm SQL sorguları `pyodbc` üzerinden parametreli (`?`) olarak yürütülür; SQL injection riski ortadan kaldırılmıştır.
4. **Zaman Aşımı ve Sınırlama:** Her sorgu için varsayılan zaman aşımı (timeout) ve satır sınırlaması (TOP N) uygulanır.

---

## ⚙️ Kurulum ve Çalıştırma

### 1. Önkoşullar
- **Node.js:** v18+ (v20+ önerilir)
- **Python:** 3.12+
- **ODBC Sürücüsü:** Microsoft ODBC Driver 17 veya 18 for SQL Server ([İndirme Bağlantısı](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server))

### 2. Backend Kurulumu ve Başlatma

```bash
# Backend dizinine geçin
cd backend

# Sanal ortam oluşturun ve aktif edin
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
# source venv/bin/activate

# Bağımlılıkları yükleyin
pip install -r requirements.txt

# Örnek ortam dosyasını kopyalayın
copy .env.example .env

# Backend API sunucusunu başlatın
uvicorn app.main:app --reload --port 8000
```

Backend API: `http://localhost:8000`  
Swagger Dokümantasyonu: `http://localhost:8000/docs`

### 3. Frontend Kurulumu ve Başlatma

```bash
# Frontend dizinine geçin
cd frontend

# Bağımlılıkları yükleyin
npm install

# Geliştirme sunucusunu başlatın
npm run dev
```

Frontend Arayüzü: `http://localhost:5173`

### 4. Testleri Çalıştırma

```bash
# Backend testlerini çalıştırma (Canlı veritabanı gerektirmez, mock'ludur)
cd backend
pytest

# Frontend tür ve derleme kontrolü
cd frontend
npm run build
```

---

## 📋 Gerekli SQL Server İzinleri

Platformdaki analizlerin eksiksiz çalışabilmesi için veritabanı kullanıcısına aşağıdaki salt okunur izinlerin verilmesi tavsiye edilir:

```sql
-- Temel sunucu meta verileri ve oturum DMVs için:
GRANT VIEW SERVER STATE TO [TraceforgeUser];

-- Hata günlüğü ve gelişmiş teşhis için (isteğe bağlı):
GRANT VIEW ANY DEFINITION TO [TraceforgeUser];

-- Query Store verilerini okumak için ilgili veritabanında:
GRANT VIEW DATABASE STATE TO [TraceforgeUser];

-- SQL Server Agent geçmişi için (msdb veritabanında):
-- msdb -> SQLAgentReaderRole rol üyeliği yeterlidir.
```

---

## ⚠️ Bilinen Kısıtlamalar

- Query Store analizleri, yalnızca hedef veritabanında Query Store özelliği etkinleştirilmişse veri döndürür.
- Always On yüksek erişilebilirlik paneli, sunucu örneğinde HADR özelliği etkin değilse bilgilendirici boş durum (unsupported-state) gösterir.
- Şema karşılaştırma aracı DDL şema değişiklik betiği üretir; üretim ortamlarında çalıştırmadan önce DBA onayı gereklidir.
