-- ============================================================================
-- Traceforge Platformu — Şema Karşılaştırması (Schema Diff) için Staging DB
-- Veritabanı Adı: Traceforge_TestDB_Staging
-- Amaç: Traceforge_TestDB ile bu veritabanını karşılaştırıp farkları görmek!
-- ============================================================================

USE [master];
GO

IF DB_ID('Traceforge_TestDB_Staging') IS NOT NULL
BEGIN
    ALTER DATABASE [Traceforge_TestDB_Staging] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [Traceforge_TestDB_Staging];
END
GO

CREATE DATABASE [Traceforge_TestDB_Staging];
GO

USE [Traceforge_TestDB_Staging];
GO

-- 1. Customers Tablosu (Fark: PhoneNumber ve LoyaltyTier sütunları eklendi!)
CREATE TABLE dbo.Customers (
    CustomerID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CustomerCode VARCHAR(20) NOT NULL UNIQUE,
    FullName NVARCHAR(100) NOT NULL,
    Email VARCHAR(100) NOT NULL,
    City NVARCHAR(50) NOT NULL,
    Country NVARCHAR(50) NOT NULL DEFAULT 'Türkiye',
    PhoneNumber VARCHAR(20) NULL,           -- STAGING FARKI: Yeni sütun
    LoyaltyTier VARCHAR(10) DEFAULT 'BRONZE', -- STAGING FARKI: Yeni sütun
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- 2. Categories Tablosu (Birebir aynı)
CREATE TABLE dbo.Categories (
    CategoryID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CategoryName NVARCHAR(50) NOT NULL,
    Description NVARCHAR(250) NULL
);

-- 3. Products Tablosu (Fark: UnitPrice tipi DECIMAL(18,4) yapıldı!)
CREATE TABLE dbo.Products (
    ProductID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CategoryID INT NOT NULL FOREIGN KEY REFERENCES dbo.Categories(CategoryID),
    ProductCode VARCHAR(30) NOT NULL UNIQUE,
    ProductName NVARCHAR(100) NOT NULL,
    UnitPrice DECIMAL(18,4) NOT NULL,       -- STAGING FARKI: DECIMAL(18,2) -> DECIMAL(18,4)
    StockQuantity INT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

-- 4. Orders Tablosu (Birebir aynı)
CREATE TABLE dbo.Orders (
    OrderID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CustomerID INT NOT NULL FOREIGN KEY REFERENCES dbo.Customers(CustomerID),
    OrderDate DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    TotalAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    OrderStatus VARCHAR(20) NOT NULL DEFAULT 'Pending',
    ShippingAddress NVARCHAR(250) NULL
);

-- 5. STAGING FARKI: Yeni Tablo -> Supplier (Ana DB'de yok!)
CREATE TABLE dbo.Suppliers (
    SupplierID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CompanyName NVARCHAR(100) NOT NULL,
    ContactName NVARCHAR(50) NULL,
    ContactEmail VARCHAR(100) NULL,
    IsApproved BIT NOT NULL DEFAULT 1
);

-- 6. STAGING FARKI: OrderDetails tablosu Staging'de bilerek çıkarıldı (Silinen nesne testi için!)
GO

PRINT '===========================================================================';
PRINT 'Traceforge_TestDB_Staging veritabanı başarıyla oluşturuldu!';
PRINT 'Artık Traceforge arayüzünde "Şema Karşılaştırması" sayfasına gidip';
PRINT 'Kaynak: Traceforge_TestDB, Hedef: Traceforge_TestDB_Staging seçip';
PRINT 'tablo, sütun ve tip farklarını tek tıkla test edebilirsiniz!';
PRINT '===========================================================================';
