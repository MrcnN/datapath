"""services/demo_data.py — Clearly labeled demo fallback data when no live SQL Server is connected."""
from __future__ import annotations

from datetime import datetime, timezone
from app.schemas.instances import (
    BlockedSession,
    BlockingChain,
    BlockingResponse,
    DatabaseInfo,
    ServerMetadata,
    SessionInfo,
)
from app.schemas.backups import BackupRecord, RecoveryReadiness
from app.schemas.permissions import DatabaseUser, ServerLogin, ServerRole, RoleMember
from app.schemas.high_availability import HAStatusResponse, AvailabilityGroup, AGReplica, AGDatabase

DEMO_DATABASES = [
    DatabaseInfo(name="master", state="ONLINE", recovery_model="SIMPLE", size_mb=12.5, log_size_mb=4.0, compatibility_level=160, is_read_only=False, create_date="2023-01-10T10:00:00"),
    DatabaseInfo(name="msdb", state="ONLINE", recovery_model="SIMPLE", size_mb=35.0, log_size_mb=12.0, compatibility_level=160, is_read_only=False, create_date="2023-01-10T10:00:00"),
    DatabaseInfo(name="AppDb_Production (Demo)", state="ONLINE", recovery_model="FULL", size_mb=45200.0, log_size_mb=8200.0, compatibility_level=160, is_read_only=False, create_date="2023-06-15T14:30:00"),
    DatabaseInfo(name="AppDb_Staging (Demo)", state="ONLINE", recovery_model="FULL", size_mb=41500.0, log_size_mb=6500.0, compatibility_level=160, is_read_only=False, create_date="2023-08-20T09:15:00"),
    DatabaseInfo(name="Reporting_Warehouse (Demo)", state="ONLINE", recovery_model="SIMPLE", size_mb=128000.0, log_size_mb=15400.0, compatibility_level=150, is_read_only=False, create_date="2023-03-01T11:00:00"),
    DatabaseInfo(name="Archive_2023 (Demo)", state="ONLINE", recovery_model="SIMPLE", size_mb=85000.0, log_size_mb=2100.0, compatibility_level=140, is_read_only=True, create_date="2024-01-01T00:00:00"),
]

DEMO_METADATA = ServerMetadata(
    server_name="SQL-PROD-CLUSTER01 (Demo)",
    version="Microsoft SQL Server 2022 (RTM-CU12) (KB5033663) - 16.0.4115.5 (X64)",
    edition="Enterprise Edition: Core-based Licensing (64-bit)",
    product_level="RTM",
    product_version="16.0.4115.5",
    collation="SQL_Latin1_General_CP1_CI_AS",
    cpu_count=16,
    memory_gb=64.0,
    max_memory_gb=58.0,
    sql_agent_running=True,
    databases=DEMO_DATABASES,
)

DEMO_SESSIONS = [
    SessionInfo(
        session_id=52,
        login_name="app_backend_user",
        host_name="WEB-APP-NODE01",
        program_name=".Net SqlClient Data Provider",
        db_name="AppDb_Production",
        status="running",
        cpu_time=1450,
        reads=12500,
        writes=840,
        logical_reads=84200,
        memory_usage=32,
        command="SELECT",
        wait_type="ASYNC_NETWORK_IO",
        wait_time_ms=250,
        blocking_session_id=0,
        last_request_start_time=datetime.now(timezone.utc).isoformat(),
        sql_text="SELECT o.OrderID, o.OrderDate, c.CustomerName, SUM(oi.UnitPrice * oi.Quantity) as Total FROM Orders o JOIN Customers c ON c.CustomerID = o.CustomerID JOIN OrderItems oi ON oi.OrderID = o.OrderID WHERE o.Status = 'Pending' GROUP BY o.OrderID, o.OrderDate, c.CustomerName ORDER BY o.OrderDate DESC;",
    ),
    SessionInfo(
        session_id=68,
        login_name="etl_service",
        host_name="ETL-JOB-RUNNER",
        program_name="SQLAgent - TSQL JobStep",
        db_name="Reporting_Warehouse",
        status="running",
        cpu_time=8900,
        reads=450000,
        writes=12000,
        logical_reads=1890000,
        memory_usage=128,
        command="INSERT",
        wait_type="PAGEIOLATCH_SH",
        wait_time_ms=120,
        blocking_session_id=0,
        last_request_start_time=datetime.now(timezone.utc).isoformat(),
        sql_text="INSERT INTO FactDailySales (DateKey, ProductKey, Quantity, TotalAmount) SELECT CAST(CONVERT(VARCHAR(8), OrderDate, 112) AS INT), ProductKey, Quantity, UnitPrice * Quantity FROM StagingSales WHERE Processed = 0;",
    ),
    SessionInfo(
        session_id=74,
        login_name="bi_reporting_tool",
        host_name="BI-DASHBOARD-SRV",
        program_name="PowerBI Desktop",
        db_name="AppDb_Production",
        status="suspended",
        cpu_time=420,
        reads=1500,
        writes=0,
        logical_reads=24000,
        memory_usage=16,
        command="SELECT",
        wait_type="LCK_M_S",
        wait_time_ms=1850,
        blocking_session_id=88,
        last_request_start_time=datetime.now(timezone.utc).isoformat(),
        sql_text="SELECT * FROM InventoryLevels WITH (HOLDLOCK) WHERE WarehouseID = 4;",
    ),
    SessionInfo(
        session_id=88,
        login_name="inventory_updater",
        host_name="INVENTORY-SYNC-01",
        program_name="InventoryServiceWorker",
        db_name="AppDb_Production",
        status="running",
        cpu_time=850,
        reads=3200,
        writes=2400,
        logical_reads=18500,
        memory_usage=24,
        command="UPDATE",
        wait_type="PAGEIOLATCH_EX",
        wait_time_ms=45,
        blocking_session_id=0,
        last_request_start_time=datetime.now(timezone.utc).isoformat(),
        sql_text="UPDATE InventoryLevels SET QuantityOnHand = QuantityOnHand - 5 WHERE ItemID = 1042 AND WarehouseID = 4;",
    ),
]

DEMO_BLOCKING = BlockingResponse(
    has_blocking=True,
    chains=[
        BlockingChain(
            blocker=DEMO_SESSIONS[3],  # session 88
            blocked=[
                BlockedSession(
                    session_id=74,
                    login_name="bi_reporting_tool",
                    host_name="BI-DASHBOARD-SRV",
                    db_name="AppDb_Production",
                    wait_type="LCK_M_S",
                    wait_time_ms=1850,
                    sql_text="SELECT * FROM InventoryLevels WITH (HOLDLOCK) WHERE WarehouseID = 4;",
                )
            ],
            wait_type="LCK_M_S",
            wait_duration_ms=1850,
        )
    ],
)
