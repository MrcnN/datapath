-- ============================================================================
-- Datapath Platform — Zengin Test Verisi & İş Yükü Simülasyon Betiği
-- Veritabanı: Datapath_TestDB
-- Amaç: Query Store, Eksik İndeksler, Parameter Sniffing, Plan Gerilemeleri
--        ve Depolama analizörlerini canlı test verileriyle beslemek.
-- ============================================================================

USE [Datapath_TestDB];
GO

SET NOCOUNT ON;
PRINT '1. Invoices (Fatura) tablosu ve Parameter Sniffing senaryosu hazırlanıyor...';

IF OBJECT_ID('dbo.Invoices', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Invoices (
        InvoiceID INT IDENTITY(1,1) NOT NULL PRIMARY KEY CLUSTERED,
        CustomerID INT NOT NULL FOREIGN KEY REFERENCES dbo.Customers(CustomerID),
        InvoiceNumber VARCHAR(30) NOT NULL UNIQUE,
        InvoiceDate DATETIME2 NOT NULL,
        DueDate DATETIME2 NOT NULL,
        TotalAmount DECIMAL(18,2) NOT NULL,
        PaymentStatus VARCHAR(20) NOT NULL, -- 'PAID' (%99.5) vs 'DISPUTED' (%0.5)
        Currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
        Notes NVARCHAR(500) NULL
    );

    CREATE NONCLUSTERED INDEX IX_Invoices_PaymentStatus ON dbo.Invoices(PaymentStatus);
END
GO

-- 2. 50.000 Fatura Kaydı Ekle (Asimetrik Veri Dağılımı: 49.750 PAID, 250 DISPUTED)
IF (SELECT COUNT(*) FROM dbo.Invoices) < 50000
BEGIN
    PRINT '50.000 adet fatura kaydı yükleniyor (Skewed / Asimetrik Dağılım)...';
    
    ;WITH Nums AS (
        SELECT TOP (50000) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
        FROM sys.all_columns a CROSS JOIN sys.all_columns b
    )
    INSERT INTO dbo.Invoices (CustomerID, InvoiceNumber, InvoiceDate, DueDate, TotalAmount, PaymentStatus, Notes)
    SELECT
        ((n * 13) % 1000) + 1,
        'INV-2026-' + RIGHT('000000' + CAST(n AS VARCHAR(10)), 6),
        DATEADD(DAY, -((n % 365)), SYSDATETIME()),
        DATEADD(DAY, -((n % 365)) + 30, SYSDATETIME()),
        CAST(((n % 200) + 1) * 85.5 AS DECIMAL(18,2)),
        CASE 
            WHEN n % 200 = 0 THEN 'DISPUTED' -- Sadece %0.5 (Nadir veri)
            ELSE 'PAID'                      -- %99.5 (Baskın veri)
        END,
        N'Kurumsal fatura kaydı #' + CAST(n AS NVARCHAR(10))
    FROM Nums;

    PRINT 'Faturalar başarıyla yüklendi.';
END
GO

-- 3. Orders Tablosunu 50.000 satıra tamamlama
DECLARE @CurrentOrders INT;
SELECT @CurrentOrders = COUNT(*) FROM dbo.Orders;

IF @CurrentOrders < 50000
BEGIN
    PRINT 'Siparişler 50.000 adede tamamlanıyor...';
    DECLARE @Needed INT = 50000 - @CurrentOrders;

    ;WITH Nums AS (
        SELECT TOP (@Needed) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
        FROM sys.all_columns a CROSS JOIN sys.all_columns b
    )
    INSERT INTO dbo.Orders (CustomerID, OrderDate, TotalAmount, OrderStatus, ShippingAddress)
    SELECT
        ((n * 17) % 1000) + 1,
        DATEADD(MINUTE, -((n * 15)), SYSDATETIME()),
        CAST(((n % 100) + 1) * 145.0 AS DECIMAL(18,2)),
        CASE (n % 4)
            WHEN 0 THEN 'Completed'
            WHEN 1 THEN 'Processing'
            WHEN 2 THEN 'Pending'
            ELSE 'Cancelled'
        END,
        N'Bölge Organize Sanayi Sitesi Cad. No: ' + CAST((n % 500) + 1 AS NVARCHAR(10))
    FROM Nums;

    PRINT 'Siparişler 50.000 adede tamamlandı.';
END
GO

-- 4. OrderDetails Tablosunu 100.000 satıra tamamlama
DECLARE @CurrentDetails INT;
SELECT @CurrentDetails = COUNT(*) FROM dbo.OrderDetails;

IF @CurrentDetails < 100000
BEGIN
    PRINT 'Sipariş detayları 100.000 adede tamamlanıyor...';
    DECLARE @NeededDetails INT = 100000 - @CurrentDetails;

    ;WITH Nums AS (
        SELECT TOP (@NeededDetails) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
        FROM sys.all_columns a CROSS JOIN sys.all_columns b
    )
    INSERT INTO dbo.OrderDetails (OrderID, ProductID, Quantity, UnitPrice)
    SELECT
        ((n * 7) % 50000) + 1,
        ((n * 13) % 100) + 1,
        (n % 8) + 1,
        CAST(((n % 150) * 12.5) + 30.0 AS DECIMAL(18,2))
    FROM Nums;

    PRINT 'Sipariş detayları 100.000 adede tamamlandı.';
END
GO

-- 5. Eksik İndeks Simülasyonu (DMV'lerin etki puanı üretmesi için)
PRINT 'Eksik İndeks ve Ağır Sorgu telemetrisi oluşturuluyor...';

-- A. Invoices.DueDate eksik indeks araması
SELECT CustomerID, InvoiceNumber, TotalAmount, DueDate
FROM dbo.Invoices
WHERE DueDate BETWEEN DATEADD(DAY, -60, SYSDATETIME()) AND SYSDATETIME()
  AND PaymentStatus = 'DISPUTED';

-- B. Orders.ShippingAddress LIKE araması (Missing Index + Table Scan)
SELECT TOP 100 o.OrderID, o.OrderDate, o.TotalAmount, o.ShippingAddress
FROM dbo.Orders o
WHERE o.ShippingAddress LIKE '%Sanayi%' AND o.OrderStatus = 'Pending';

-- C. Customers.Email eşitlik araması
SELECT CustomerID, FullName, Email, City
FROM dbo.Customers
WHERE Email = 'musteri350@sirket.com';

-- D. Ağır Raporlama / Maliyetli Sorgu (Query Store ve CPU telemetrisi için)
SELECT TOP 25
    c.City,
    COUNT(DISTINCT o.OrderID) AS ToplamSiparis,
    SUM(od.LineTotal) AS ToplamCiro,
    AVG(od.UnitPrice) AS OrtalamaFiyat
FROM dbo.Customers c
JOIN dbo.Orders o ON o.CustomerID = c.CustomerID
JOIN dbo.OrderDetails od ON od.OrderID = o.OrderID
WHERE o.OrderDate >= DATEADD(DAY, -90, SYSDATETIME())
GROUP BY c.City
ORDER BY ToplamCiro DESC;
GO

-- E. Parameter Sniffing Tetikleyici Stored Procedure
CREATE OR ALTER PROCEDURE dbo.usp_GetInvoicesByStatus
    @Status VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        i.InvoiceID,
        i.InvoiceNumber,
        i.InvoiceDate,
        i.TotalAmount,
        i.PaymentStatus,
        c.FullName,
        c.City
    FROM dbo.Invoices i
    JOIN dbo.Customers c ON c.CustomerID = i.CustomerID
    WHERE i.PaymentStatus = @Status
    ORDER BY i.InvoiceDate DESC;
END;
GO

-- F. Parameter Sniffing Çalıştırması:
-- Önce nadir parametre ('DISPUTED') ile derle (Index Seek planı önbelleğe alınır)
EXEC dbo.usp_GetInvoicesByStatus @Status = 'DISPUTED';
-- Sonra baskın parametre ('PAID') ile çalıştır (Seek planı 49.750 satır için key lookup fırtınası koparır!)
EXEC dbo.usp_GetInvoicesByStatus @Status = 'PAID';
GO

PRINT 'Simülasyon başarıyla tamamlandı. Datapath_TestDB zengin verilerle dolduruldu!';
