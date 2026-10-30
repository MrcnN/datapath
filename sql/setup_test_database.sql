-- ============================================================================
-- Datapath Platformu — Test Veritabanı Kurulum Betiği (SSMS için)
-- Veritabanı Adı: Datapath_TestDB
-- Amaç: Dashboard, Query Store, Oturumlar, Yedekleme ve Şema Karşılaştırma
--        modüllerini canlı olarak test etmek için zengin örnek veri ortamı.
-- ============================================================================

USE [master];
GO

-- 1. Varsa eski test veritabanını temizle
IF DB_ID('Datapath_TestDB') IS NOT NULL
BEGIN
    ALTER DATABASE [Datapath_TestDB] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [Datapath_TestDB];
END
GO

-- 2. Yeni test veritabanını oluştur
CREATE DATABASE [Datapath_TestDB];
GO

-- 3. Kurtarma modelini FULL yap (Yedekleme ve Log analizi için zorunlu)
ALTER DATABASE [Datapath_TestDB] SET RECOVERY FULL;
GO

-- 4. Query Store'u (Sorgu Deposu) etkinleştir ve agresif istatistik toplamaya ayarla
ALTER DATABASE [Datapath_TestDB] SET QUERY_STORE = ON (
    OPERATION_MODE = READ_WRITE,
    CLEANUP_POLICY = (STALE_QUERY_THRESHOLD_DAYS = 30),
    DATA_FLUSH_INTERVAL_SECONDS = 60,
    MAX_STORAGE_SIZE_MB = 1024,
    INTERVAL_LENGTH_MINUTES = 1,
    QUERY_CAPTURE_MODE = ALL
);
GO

USE [Datapath_TestDB];
GO

-- ============================================================================
-- 5. TABLOLARIN OLUŞTURULMASI
-- ============================================================================

-- Müşteriler Tablosu
CREATE TABLE dbo.Customers (
    CustomerID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CustomerCode VARCHAR(20) NOT NULL UNIQUE,
    FullName NVARCHAR(100) NOT NULL,
    Email VARCHAR(100) NOT NULL,
    City NVARCHAR(50) NOT NULL,
    Country NVARCHAR(50) NOT NULL DEFAULT 'Türkiye',
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- Ürün Kategorileri
CREATE TABLE dbo.Categories (
    CategoryID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CategoryName NVARCHAR(50) NOT NULL,
    Description NVARCHAR(250) NULL
);

-- Ürünler Tablosu
CREATE TABLE dbo.Products (
    ProductID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CategoryID INT NOT NULL FOREIGN KEY REFERENCES dbo.Categories(CategoryID),
    ProductCode VARCHAR(30) NOT NULL UNIQUE,
    ProductName NVARCHAR(100) NOT NULL,
    UnitPrice DECIMAL(18,2) NOT NULL,
    StockQuantity INT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- Siparişler Tablosu
CREATE TABLE dbo.Orders (
    OrderID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CustomerID INT NOT NULL FOREIGN KEY REFERENCES dbo.Customers(CustomerID),
    OrderDate DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    TotalAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    OrderStatus VARCHAR(20) NOT NULL DEFAULT 'Pending', -- 'Pending', 'Processing', 'Completed', 'Cancelled'
    ShippingAddress NVARCHAR(250) NULL
);

-- Sipariş Detayları
CREATE TABLE dbo.OrderDetails (
    OrderDetailID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    OrderID INT NOT NULL FOREIGN KEY REFERENCES dbo.Orders(OrderID),
    ProductID INT NOT NULL FOREIGN KEY REFERENCES dbo.Products(ProductID),
    Quantity INT NOT NULL,
    UnitPrice DECIMAL(18,2) NOT NULL,
    LineTotal AS (Quantity * UnitPrice) PERSISTED
);

-- Denetim Günlüğü (Audit Log)
CREATE TABLE dbo.AuditLogs (
    LogID BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    TableName NVARCHAR(50) NOT NULL,
    ActionType VARCHAR(10) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    RecordID INT NOT NULL,
    ChangedBy NVARCHAR(100) NOT NULL DEFAULT SUSER_SNAME(),
    ChangedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    OldValue NVARCHAR(MAX) NULL,
    NewValue NVARCHAR(MAX) NULL
);

-- Depo ve Stok Hareketleri (Parçalanma - Fragmentation Analiz Testi için)
-- GUID Clustered Index rastgele sayfa bölünmelerine (Page Split) ve yüksek parçalanmaya yol açar
CREATE TABLE dbo.InventoryLogs (
    MovementID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY CLUSTERED,
    ProductID INT NOT NULL FOREIGN KEY REFERENCES dbo.Products(ProductID),
    DeltaStock INT NOT NULL,
    BatchNumber VARCHAR(50) NOT NULL,
    Notes NVARCHAR(200) NULL,
    LoggedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- ============================================================================
-- 6. İNDEKSLER (Performans ve Kullanım Analizi için)
-- ============================================================================
CREATE NONCLUSTERED INDEX IX_Orders_CustomerID ON dbo.Orders(CustomerID) INCLUDE (OrderDate, TotalAmount);
CREATE NONCLUSTERED INDEX IX_Orders_OrderDate ON dbo.Orders(OrderDate);
CREATE NONCLUSTERED INDEX IX_OrderDetails_OrderID ON dbo.OrderDetails(OrderID);
CREATE NONCLUSTERED INDEX IX_Products_CategoryID ON dbo.Products(CategoryID) INCLUDE (ProductName, UnitPrice);

-- Kullanılmayan İndeks Simülasyonu (Unused Index Testi için bilerek eklendi)
-- Sorgular bu sütunu WHERE içinde aramayacak ancak UPDATE/INSERT işlemleri bu indekse yazma maliyeti getirecek
CREATE NONCLUSTERED INDEX IX_Customers_Unused_Country ON dbo.Customers(Country);
GO

-- ============================================================================
-- 7. GÖRÜNÜMLER (VIEWS)
-- ============================================================================
CREATE OR ALTER VIEW dbo.vw_CustomerOrderSummary
AS
SELECT 
    c.CustomerID,
    c.CustomerCode,
    c.FullName,
    c.City,
    COUNT(o.OrderID) AS TotalOrders,
    ISNULL(SUM(o.TotalAmount), 0) AS LifetimeValue,
    MAX(o.OrderDate) AS LastOrderDate
FROM dbo.Customers c
LEFT JOIN dbo.Orders o ON o.CustomerID = c.CustomerID
GROUP BY c.CustomerID, c.CustomerCode, c.FullName, c.City;
GO

CREATE OR ALTER VIEW dbo.vw_TopSellingProducts
AS
SELECT 
    p.ProductID,
    p.ProductName,
    cat.CategoryName,
    SUM(od.Quantity) AS TotalSoldUnits,
    SUM(od.LineTotal) AS TotalRevenue
FROM dbo.Products p
JOIN dbo.Categories cat ON cat.CategoryID = p.CategoryID
JOIN dbo.OrderDetails od ON od.ProductID = p.ProductID
GROUP BY p.ProductID, p.ProductName, cat.CategoryName;
GO

-- ============================================================================
-- 8. GERÇEKÇİ ÖRNEK VERİLERİN YÜKLENMESİ (10.000+ Kayıt)
-- ============================================================================
PRINT 'Örnek veriler yükleniyor...';

-- Kategoriler
INSERT INTO dbo.Categories (CategoryName, Description) VALUES
('Elektronik', 'Bilgisayar, telefon ve donanım ürünleri'),
('Yazılım & Lisans', 'Veritabanı, işletim sistemi ve araçlar'),
('Ağ Donanımları', 'Router, switch ve sunucu kabinleri'),
('Depolama Birimleri', 'NVMe SSD, SAN ve NAS üniteleri');

-- 100 Ürün Ekle
;WITH Nums AS (
    SELECT TOP (100) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
    FROM sys.all_columns
)
INSERT INTO dbo.Products (CategoryID, ProductCode, ProductName, UnitPrice, StockQuantity)
SELECT 
    (n % 4) + 1,
    'PRD-' + RIGHT('000' + CAST(n AS VARCHAR(5)), 4),
    'Kurumsal Sunucu Bileşeni #' + CAST(n AS NVARCHAR(10)),
    CAST((n * 15.5) + 50.0 AS DECIMAL(18,2)),
    (n * 5) + 10
FROM Nums;

-- 1.000 Müşteri Ekle
;WITH Nums AS (
    SELECT TOP (1000) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
    FROM sys.all_columns a CROSS JOIN sys.all_columns b
)
INSERT INTO dbo.Customers (CustomerCode, FullName, Email, City)
SELECT 
    'CUST-' + RIGHT('0000' + CAST(n AS VARCHAR(6)), 5),
    N'Kurumsal Müşteri ' + CAST(n AS NVARCHAR(10)),
    'musteri' + CAST(n AS VARCHAR(10)) + '@sirket.com',
    CASE (n % 5)
        WHEN 0 THEN N'İstanbul'
        WHEN 1 THEN N'Ankara'
        WHEN 2 THEN N'İzmir'
        WHEN 3 THEN N'Bursa'
        ELSE N'Antalya'
    END
FROM Nums;

-- 5.000 Sipariş Ekle
;WITH Nums AS (
    SELECT TOP (5000) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
    FROM sys.all_columns a CROSS JOIN sys.all_columns b
)
INSERT INTO dbo.Orders (CustomerID, OrderDate, TotalAmount, OrderStatus, ShippingAddress)
SELECT 
    ((n * 7) % 1000) + 1,
    DATEADD(DAY, -((n % 180)), SYSDATETIME()),
    CAST(((n % 50) + 1) * 120.0 AS DECIMAL(18,2)),
    CASE (n % 4)
        WHEN 0 THEN 'Completed'
        WHEN 1 THEN 'Processing'
        WHEN 2 THEN 'Pending'
        ELSE 'Cancelled'
    END,
    N'Örnek Organize Sanayi Bölgesi No: ' + CAST((n % 100) + 1 AS NVARCHAR(10))
FROM Nums;

-- 10.000 Sipariş Detayı Ekle
;WITH Nums AS (
    SELECT TOP (10000) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
    FROM sys.all_columns a CROSS JOIN sys.all_columns b
)
INSERT INTO dbo.OrderDetails (OrderID, ProductID, Quantity, UnitPrice)
SELECT 
    ((n * 3) % 5000) + 1,
    ((n * 11) % 100) + 1,
    (n % 5) + 1,
    CAST(((n % 100) * 15.0) + 25.0 AS DECIMAL(18,2))
FROM Nums;

-- 5.000 Depo / Stok Hareketi Ekle (Rastgele GUID clustered index ile parçalanma simülasyonu)
;WITH Nums AS (
    SELECT TOP (5000) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
    FROM sys.all_columns a CROSS JOIN sys.all_columns b
)
INSERT INTO dbo.InventoryLogs (MovementID, ProductID, DeltaStock, BatchNumber, Notes)
SELECT 
    NEWID(),
    ((n * 7) % 100) + 1,
    (n % 20) - 10,
    'BATCH-' + CAST(n AS VARCHAR(10)),
    N'Rastgele Giriş/Çıkış Hareketi #' + CAST(n AS NVARCHAR(10))
FROM Nums;

PRINT 'Tablolar ve veriler başarıyla oluşturuldu.';
GO

-- ============================================================================
-- 9. SORGULARI ÇALIŞTIRMA & İNDEKS TESTLERİNİ TETİKLEME
-- ============================================================================
PRINT 'Query Store ve İndeks İstatistikleri üretiliyor...';

-- A. Unused Index Simülasyonu: Customers üzerinde update yaparak IX_Customers_Unused_Country indeksine yazma maliyeti üret
UPDATE dbo.Customers 
SET CreatedAt = SYSDATETIME() 
WHERE CustomerID % 2 = 0;

-- B. Missing Index Simülasyonu 1: Orders.ShippingAddress üzerinde indeks olmadığı için eksik indeks DMV'sine düşer
EXEC (N'
    SELECT OrderID, OrderDate, TotalAmount, ShippingAddress 
    FROM dbo.Orders 
    WHERE ShippingAddress LIKE ''%Organize%'' AND OrderStatus = ''Pending'';
');
GO 8

-- C. Missing Index Simülasyonu 2: Customers.Email araması
EXEC (N'
    SELECT CustomerID, FullName, Email, City 
    FROM dbo.Customers 
    WHERE Email = ''musteri500@sirket.com'';
');
GO 6

-- D. Maliyetli CPU ve IO sorgusu (Query Store analitiği için)
EXEC (N'
    SELECT TOP 50 c.City, COUNT(o.OrderID) as SiparisSayisi, SUM(od.LineTotal) as Ciro
    FROM dbo.Customers c
    JOIN dbo.Orders o ON o.CustomerID = c.CustomerID
    JOIN dbo.OrderDetails od ON od.OrderID = o.OrderID
    GROUP BY c.City
    ORDER BY Ciro DESC;
');
GO 5

EXEC (N'
    -- Başka bir sık çalışan sorgu simülasyonu
    SELECT TOP 20 * FROM dbo.Products WHERE StockQuantity > 50 ORDER BY UnitPrice DESC;
');
GO 10

-- ============================================================================
-- 10. İLK YEDEK ALMA (Backup & Recovery Ekranında Veri Gözükmesi İçin)
-- ============================================================================
PRINT 'Örnek veritabanı tam ve log yedekleri alınıyor...';
DECLARE @BackupDir NVARCHAR(260);
-- Windows geçici dizinine güvenle yedek al
SET @BackupDir = N'C:\Windows\Temp\';

DECLARE @FullBackupPath NVARCHAR(500) = @BackupDir + N'Datapath_TestDB_Full.bak';
DECLARE @LogBackupPath NVARCHAR(500) = @BackupDir + N'Datapath_TestDB_Log.trn';

-- 1. Tam Yedek (Full Backup)
BACKUP DATABASE [Datapath_TestDB] 
TO DISK = @FullBackupPath 
WITH INIT, COMPRESSION, STATS = 10;

-- 2. İşlem Günlüğü Yedeği (Transaction Log Backup)
BACKUP LOG [Datapath_TestDB] 
TO DISK = @LogBackupPath 
WITH INIT, COMPRESSION, STATS = 10;
GO

PRINT '===========================================================================';
PRINT 'Datapath_TestDB başarıyla kuruldu ve test verileriyle dolduruldu!';
PRINT '1. Tablolar, 15.000+ satır veri, ilişkiler ve indeksler eklendi.';
PRINT '2. Parçalanmış GUID indeks (dbo.InventoryLogs) ve Unused İndeks oluşturuldu.';
PRINT '3. Query Store ve Eksik İndeks (Missing Index) DMV verileri simüle edildi.';
PRINT '4. Tam (Full) ve Log yedekleri alındı (Backup & Recovery ekranı için).';
PRINT '===========================================================================';
