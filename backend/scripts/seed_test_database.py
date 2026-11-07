"""
seed_test_database.py - Realistic Datapath Test Database Seeder & Workload Engine.
Populates Datapath_TestDB with rich operational data and triggers real SQL Server diagnostic telemetry:
- Query Store runtime statistics & execution history
- Parameter Sniffing & plan variation
- Non-SARGable table scans & missing index recommendations
- Real index fragmentation via random GUID page splits
- Implicit conversion warnings and TempDB allocation
"""
import sys
import time
import random
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
import pyodbc

DB_CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=localhost;"
    "DATABASE=Datapath_TestDB;"
    "Trusted_Connection=yes;"
    "Timeout=15;"
)

CITIES = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Adana", "Konya", "Gaziantep", "Kocaeli", "Eskişehir"]
STATUSES = ["Completed", "Processing", "Pending", "Cancelled", "FraudReview"]
STATUS_WEIGHTS = [0.85, 0.08, 0.04, 0.02, 0.01]  # Skewed for parameter sniffing!

ACTION_TYPES = ["INSERT", "UPDATE", "DELETE", "LOGIN", "GRANT", "DENY", "BACKUP", "ALTER"]
TABLE_NAMES = ["Customers", "Orders", "OrderDetails", "Products", "SystemSecurity"]
CHANGERS = ["sa", "app_user", "batch_agent", "report_service", "migration_tool"]


def get_connection():
    return pyodbc.connect(DB_CONN_STR, autocommit=True)


def ensure_query_store(conn):
    print("[1/6] Query Store yapilandirmasi dogrulaniyor...")
    cursor = conn.cursor()
    cursor.execute("""
    IF (SELECT is_query_store_on FROM sys.databases WHERE name = 'Datapath_TestDB') = 0
    BEGIN
        ALTER DATABASE Datapath_TestDB SET QUERY_STORE = ON (
            OPERATION_MODE = READ_WRITE,
            CLEANUP_POLICY = (STALE_QUERY_THRESHOLD_DAYS = 30),
            DATA_FLUSH_INTERVAL_SECONDS = 60,
            MAX_STORAGE_SIZE_MB = 1024,
            INTERVAL_LENGTH_MINUTES = 1
        );
    END
    """)
    print("  -> Query Store Datapath_TestDB uzerinde aktif!")


def seed_customers(conn, target_count=5000):
    print(f"[2/6] Musteri tablosu genisletiliyor (Hedef: {target_count}+)...")
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM Customers")
    curr_count = cursor.fetchone()[0]

    if curr_count < target_count:
        needed = target_count - curr_count
        print(f"  -> {needed} yeni musteri uretiliyor...")
        batch = []
        now = datetime.now()
        for i in range(1, needed + 1):
            cid = curr_count + i
            code = f"CUST-{cid:05d}"
            name = f"Kurumsal Sirket Müşterisi {cid}"
            email = f"iletisim{cid}@firma{cid%200}.com"
            city = random.choice(CITIES)
            country = "Türkiye"
            created = now - timedelta(days=random.randint(1, 730))
            batch.append((code, name, email, city, country, created))

            if len(batch) >= 1000:
                cursor.executemany(
                    "INSERT INTO Customers (CustomerCode, FullName, Email, City, Country, CreatedAt) VALUES (?, ?, ?, ?, ?, ?)",
                    batch
                )
                batch = []
        if batch:
            cursor.executemany(
                "INSERT INTO Customers (CustomerCode, FullName, Email, City, Country, CreatedAt) VALUES (?, ?, ?, ?, ?, ?)",
                batch
            )
    cursor.execute("SELECT COUNT(*) FROM Customers")
    print(f"  -> Customers toplam: {cursor.fetchone()[0]} kayit.")


def seed_products(conn, target_count=500):
    print(f"[3/6] Urun tablosu kontrol ediliyor (Hedef: {target_count}+)...")
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM Products")
    curr_count = cursor.fetchone()[0]

    if curr_count < target_count:
        needed = target_count - curr_count
        print(f"  -> {needed} yeni urun uretiliyor...")
        cursor.execute("SELECT CategoryID FROM Categories")
        cat_ids = [r[0] for r in cursor.fetchall()] or [1]
        batch = []
        now = datetime.now()
        for i in range(1, needed + 1):
            pid = curr_count + i
            cat = random.choice(cat_ids)
            code = f"PRD-{pid:04d}"
            pname = f"Enterprise Cloud Donanim Bileseni #{pid}"
            price = Decimal(str(round(random.uniform(50.0, 5000.0), 2)))
            stock = random.randint(5, 500)
            batch.append((cat, code, pname, price, stock, 1, now))

            if len(batch) >= 500:
                cursor.executemany(
                    "INSERT INTO Products (CategoryID, ProductCode, ProductName, UnitPrice, StockQuantity, IsActive, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    batch
                )
                batch = []
        if batch:
            cursor.executemany(
                "INSERT INTO Products (CategoryID, ProductCode, ProductName, UnitPrice, StockQuantity, IsActive, CreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
                batch
            )
    cursor.execute("SELECT COUNT(*) FROM Products")
    print(f"  -> Products toplam: {cursor.fetchone()[0]} kayit.")


def seed_orders_and_details(conn, target_orders=20000):
    print(f"[4/6] Siparis ve siparis kalemleri genisletiliyor (Hedef: {target_orders}+ siparis)...")
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM Orders")
    curr_orders = cursor.fetchone()[0]

    if curr_orders < target_orders:
        needed = target_orders - curr_orders
        print(f"  -> {needed} yeni siparis ve bagli detaylar uretiliyor...")
        
        cursor.execute("SELECT MIN(CustomerID), MAX(CustomerID) FROM Customers")
        min_c, max_c = cursor.fetchone()
        
        cursor.execute("SELECT ProductID, UnitPrice FROM Products")
        prod_data = cursor.fetchall()

        now = datetime.now()
        order_batch = []
        for i in range(1, needed + 1):
            cust_id = random.randint(min_c, max_c)
            days_ago = random.randint(0, 365)
            odate = now - timedelta(days=days_ago, minutes=random.randint(0, 1440))
            status = random.choices(STATUSES, weights=STATUS_WEIGHTS)[0]
            amount = Decimal("0.00")
            addr = f"{random.choice(CITIES)} Sanayi Bölgesi No: {random.randint(1, 150)}"
            order_batch.append((cust_id, odate, amount, status, addr))

            if len(order_batch) >= 2000:
                cursor.executemany(
                    "INSERT INTO Orders (CustomerID, OrderDate, TotalAmount, OrderStatus, ShippingAddress) VALUES (?, ?, ?, ?, ?)",
                    order_batch
                )
                order_batch = []

        if order_batch:
            cursor.executemany(
                "INSERT INTO Orders (CustomerID, OrderDate, TotalAmount, OrderStatus, ShippingAddress) VALUES (?, ?, ?, ?, ?)",
                order_batch
            )

    # Attach OrderDetails to any orders that lack them
    cursor.execute("""
    SELECT o.OrderID FROM Orders o
    LEFT JOIN OrderDetails od ON o.OrderID = od.OrderID
    WHERE od.OrderDetailID IS NULL
    """)
    empty_order_ids = [r[0] for r in cursor.fetchall()]
    if empty_order_ids:
        print(f"  -> {len(empty_order_ids)} siparise detay satirlari baglaniyor...")
        cursor.execute("SELECT ProductID, UnitPrice FROM Products")
        prod_data = cursor.fetchall()

        detail_batch = []
        for oid in empty_order_ids:
            num_lines = random.randint(1, 4)
            for _ in range(num_lines):
                prod_id, unit_p = random.choice(prod_data)
                qty = random.randint(1, 10)
                detail_batch.append((oid, prod_id, qty, unit_p))

            if len(detail_batch) >= 3000:
                cursor.executemany(
                    "INSERT INTO OrderDetails (OrderID, ProductID, Quantity, UnitPrice) VALUES (?, ?, ?, ?)",
                    detail_batch
                )
                detail_batch = []

        if detail_batch:
            cursor.executemany(
                "INSERT INTO OrderDetails (OrderID, ProductID, Quantity, UnitPrice) VALUES (?, ?, ?, ?)",
                detail_batch
            )

        # Update Orders TotalAmount based on line totals
        cursor.execute("""
        UPDATE o
        SET o.TotalAmount = ISNULL(sub.Total, 150.00)
        FROM Orders o
        CROSS APPLY (
            SELECT SUM(od.LineTotal) AS Total
            FROM OrderDetails od
            WHERE od.OrderID = o.OrderID
        ) sub
        WHERE o.TotalAmount = 0
        """)

    cursor.execute("SELECT COUNT(*) FROM Orders")
    order_cnt = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM OrderDetails")
    det_cnt = cursor.fetchone()[0]
    print(f"  -> Orders toplam: {order_cnt} kayit | OrderDetails: {det_cnt} kayit.")


def seed_audit_logs(conn, target_logs=10000):
    print(f"[5/6] Denetim (AuditLogs) kayitlari uretiliyor (Hedef: {target_logs}+)...")
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM AuditLogs")
    curr_logs = cursor.fetchone()[0]

    if curr_logs < target_logs:
        needed = target_logs - curr_logs
        print(f"  -> {needed} yeni denetim kaydi olusturuluyor...")
        batch = []
        now = datetime.now()
        for i in range(needed):
            tbl = random.choice(TABLE_NAMES)
            action = random.choice(ACTION_TYPES)
            rec_id = random.randint(1, 25000)
            user = random.choice(CHANGERS)
            dt = now - timedelta(hours=random.randint(0, 720), minutes=random.randint(0, 59))
            old_val = f'{{"status": "OLD_STATE", "val": {random.randint(10, 99)}}}'
            new_val = f'{{"status": "NEW_STATE", "val": {random.randint(100, 999)}}}'
            batch.append((tbl, action, rec_id, user, dt, old_val, new_val))

            if len(batch) >= 2000:
                cursor.executemany(
                    "INSERT INTO AuditLogs (TableName, ActionType, RecordID, ChangedBy, ChangedAt, OldValue, NewValue) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    batch
                )
                batch = []

        if batch:
            cursor.executemany(
                "INSERT INTO AuditLogs (TableName, ActionType, RecordID, ChangedBy, ChangedAt, OldValue, NewValue) VALUES (?, ?, ?, ?, ?, ?, ?)",
                batch
            )

    cursor.execute("SELECT COUNT(*) FROM AuditLogs")
    print(f"  -> AuditLogs toplam: {cursor.fetchone()[0]} kayit.")


def setup_fragmented_table_and_procs(conn):
    print("[6/6] DBA Teshis Tablosu (Index Fragmentation) ve Stored Procedure'lar kuruluyor...")
    cursor = conn.cursor()

    # 1. Fragmented Table setup (GUID clustered index triggers real 70%+ fragmentation)
    cursor.execute("""
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CustomerActivityLog')
    BEGIN
        CREATE TABLE dbo.CustomerActivityLog (
            ActivityID UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY CLUSTERED,
            CustomerID INT NOT NULL,
            ActivityType VARCHAR(50) NOT NULL,
            Payload VARCHAR(500) NOT NULL,
            CreatedAt DATETIME2 DEFAULT SYSDATETIME()
        );
    END
    """)

    # Populate fragmented records
    cursor.execute("SELECT COUNT(*) FROM dbo.CustomerActivityLog")
    frag_count = cursor.fetchone()[0]
    if frag_count < 8000:
        print("  -> Rastgele GUID Clustered sayfa parcalanmasi (fragmentation) olusturuluyor...")
        frag_batch = []
        for _ in range(8000 - frag_count):
            frag_batch.append((
                str(uuid.uuid4()),
                random.randint(1, 5000),
                random.choice(["PAGE_VIEW", "CART_ADD", "CHECKOUT_ATTEMPT", "EXPORT_REPORT"]),
                "x" * random.randint(150, 450)
            ))
            if len(frag_batch) >= 1000:
                cursor.executemany(
                    "INSERT INTO dbo.CustomerActivityLog (ActivityID, CustomerID, ActivityType, Payload) VALUES (?, ?, ?, ?)",
                    frag_batch
                )
                frag_batch = []
        if frag_batch:
            cursor.executemany(
                "INSERT INTO dbo.CustomerActivityLog (ActivityID, CustomerID, ActivityType, Payload) VALUES (?, ?, ?, ?)",
                frag_batch
            )
        print("  -> CustomerActivityLog tablosunda yuksek parcalanma olusturuldu!")

    # 2. Diagnostic Stored Procedures
    cursor.execute("""
    CREATE OR ALTER PROCEDURE dbo.usp_SearchOrdersByStatus
        @Status VARCHAR(20)
    AS
    BEGIN
        SET NOCOUNT ON;
        -- Parameter Sniffing testi icin: Skewed data filtreleme
        SELECT o.OrderID, o.CustomerID, c.FullName, o.OrderDate, o.TotalAmount, o.OrderStatus
        FROM dbo.Orders o
        INNER JOIN dbo.Customers c ON o.CustomerID = c.CustomerID
        WHERE o.OrderStatus = @Status
        ORDER BY o.OrderDate DESC;
    END;
    """)

    cursor.execute("""
    CREATE OR ALTER PROCEDURE dbo.usp_YearlyRevenueReport
        @Year INT
    AS
    BEGIN
        SET NOCOUNT ON;
        -- Non-SARGable fonksiyon: YEAR(OrderDate) index seek'i engeller, Table Scan yaptirir!
        SELECT c.City, COUNT(o.OrderID) AS TotalOrders, SUM(o.TotalAmount) AS TotalRevenue
        FROM dbo.Orders o
        INNER JOIN dbo.Customers c ON o.CustomerID = c.CustomerID
        WHERE YEAR(o.OrderDate) = @Year
        GROUP BY c.City
        ORDER BY TotalRevenue DESC;
    END;
    """)

    cursor.execute("""
    CREATE OR ALTER PROCEDURE dbo.usp_HeavyCustomerReport
    AS
    BEGIN
        SET NOCOUNT ON;
        -- TempDB worktable & memory grant zorlayici agır sorgu
        SELECT 
            c.CustomerID, c.FullName, c.City,
            COUNT(DISTINCT o.OrderID) AS OrderCount,
            AVG(o.TotalAmount) AS AvgOrder,
            SUM(od.Quantity * od.UnitPrice) AS CalculatedGross,
            STRING_AGG(p.ProductName, ', ') WITHIN GROUP (ORDER BY p.ProductID) AS AllProducts
        FROM dbo.Customers c
        INNER JOIN dbo.Orders o ON c.CustomerID = o.CustomerID
        INNER JOIN dbo.OrderDetails od ON o.OrderID = od.OrderID
        INNER JOIN dbo.Products p ON od.ProductID = p.ProductID
        GROUP BY c.CustomerID, c.FullName, c.City
        HAVING COUNT(DISTINCT o.OrderID) > 5;
    END;
    """)
    print("  -> Teshis Stored Procedure'lari (usp_SearchOrdersByStatus, usp_YearlyRevenueReport, usp_HeavyCustomerReport) tanimlandi!")


def execute_workload_simulation(conn, iterations=15):
    print(f"\n[+] Canli Telemetri & Query Store Yuk Simülasyonu Calistiriliyor ({iterations} dongu)...")
    cursor = conn.cursor()

    for i in range(1, iterations + 1):
        # 1. Parameter Sniffing: run with low-frequency first to compile seek plan, then with high-frequency!
        cursor.execute("EXEC dbo.usp_SearchOrdersByStatus @Status = 'FraudReview'")
        _ = cursor.fetchall()

        cursor.execute("EXEC dbo.usp_SearchOrdersByStatus @Status = 'Completed'")
        _ = cursor.fetchall()

        # 2. Non-SARGable table scan query
        cursor.execute("EXEC dbo.usp_YearlyRevenueReport @Year = 2025")
        _ = cursor.fetchall()

        # 3. Missing index trigger: Filter on unindexed columns
        cursor.execute("""
        SELECT TOP 100 o.OrderID, o.OrderDate, o.TotalAmount, o.ShippingAddress
        FROM dbo.Orders o
        WHERE o.ShippingAddress LIKE '%Sanayi Bölgesi No: 4%'
          AND o.TotalAmount > 500.00
        ORDER BY o.TotalAmount DESC;
        """)
        _ = cursor.fetchall()

        # 4. Implicit conversion: Filter varchar column with unicode nvarchar literal
        cursor.execute("""
        SELECT c.CustomerID, c.CustomerCode, c.FullName, c.Email
        FROM dbo.Customers c
        WHERE c.CustomerCode = N'CUST-00042';
        """)
        _ = cursor.fetchall()

        if i % 5 == 0:
            print(f"  -> Simülasyon döngüsü: {i}/{iterations} tamamlandı.")

    # Force Query Store to flush in-memory data to disk so Datapath API immediately reads it!
    try:
        cursor.execute("EXEC sys.sp_query_store_flush_db;")
        print("  -> Query Store bellek tamponu diske yazildi (sp_query_store_flush_db).")
    except Exception as e:
        print(f"  -> sp_query_store_flush_db uyarisi: {e}")

    print("[OK] Tum test verileri ve DBA teshis telemetrileri basariyla uretildi!")


def main():
    print("=" * 70)
    print("DATAPATH TEST DATABASE SEEDER & WORKLOAD ENGINE")
    print("Hedef: Datapath_TestDB (localhost)")
    print("=" * 70)
    start_time = time.time()

    try:
        conn = get_connection()
        ensure_query_store(conn)
        seed_customers(conn, target_count=5000)
        seed_products(conn, target_count=500)
        seed_orders_and_details(conn, target_orders=20000)
        seed_audit_logs(conn, target_logs=10000)
        setup_fragmented_table_and_procs(conn)
        execute_workload_simulation(conn, iterations=12)
        conn.close()

        elapsed = round(time.time() - start_time, 2)
        print(f"\nIslem {elapsed} saniyede eksiksiz tamamlandi!")

    except Exception as e:
        print(f"\nHATA: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
