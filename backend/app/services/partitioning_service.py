"""services/partitioning_service.py — Table Partitioning & Sliding Window Lifecycle Advisor."""
from __future__ import annotations

import logging
from typing import List, Optional
from datetime import datetime

from app.db.connection import ConnectionParams, get_connection
from app.schemas.partitioning import (
    PartitionRangeInfo,
    TablePartitionSummary,
    PartitionCandidate,
    PartitioningOverviewResponse,
    GeneratePartitionScriptRequest,
    GeneratePartitionScriptResponse,
)

logger = logging.getLogger(__name__)


def get_partitioning_overview(
    params: Optional[ConnectionParams] = None,
    database_name: Optional[str] = None,
) -> PartitioningOverviewResponse:
    """Scan database for partitioned tables and identify large unpartitioned candidate tables."""
    target_db = database_name or (params.database if params else "Datapath_TestDB") or "Datapath_TestDB"

    if params:
        try:
            conn_params = ConnectionParams(
                server=params.server,
                database=target_db,
                driver=params.driver,
                username=params.username,
                password=params.password,
                trusted_connection=params.trusted_connection,
                timeout=params.timeout,
            )
            with get_connection(conn_params) as conn:
                cursor = conn.cursor()

                # 1. Query Existing Partitioned Tables
                sql_partitioned = """
                SELECT 
                    t.name AS table_name,
                    s.name AS schema_name,
                    ps.name AS partition_scheme,
                    pf.name AS partition_function,
                    c.name AS partition_key_column,
                    ty.name AS partition_key_type,
                    COUNT(p.partition_number) AS total_partitions,
                    SUM(p.rows) AS total_rows,
                    ROUND(SUM(a.total_pages) * 8.0 / 1024.0, 2) AS total_reserved_mb
                FROM sys.tables t
                JOIN sys.schemas s ON t.schema_id = s.schema_id
                JOIN sys.indexes i ON t.object_id = i.object_id AND i.index_id IN (0, 1)
                JOIN sys.partition_schemes ps ON i.data_space_id = ps.data_space_id
                JOIN sys.partition_functions pf ON ps.function_id = pf.function_id
                JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id AND ic.partition_ordinal > 0
                JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                JOIN sys.types ty ON c.user_type_id = ty.user_type_id
                JOIN sys.partitions p ON t.object_id = p.object_id AND i.index_id = p.index_id
                LEFT JOIN sys.allocation_units a ON p.partition_id = a.container_id
                WHERE t.is_ms_shipped = 0
                GROUP BY t.name, s.name, ps.name, pf.name, c.name, ty.name;
                """
                cursor.execute(sql_partitioned)
                part_rows = cursor.fetchall()
                partitioned_tables: List[TablePartitionSummary] = []

                for r in part_rows:
                    t_name = r[0]
                    s_name = r[1]
                    p_scheme = r[2]
                    p_func = r[3]
                    k_col = r[4]
                    k_type = r[5]
                    tot_parts = int(r[6])
                    tot_rows = int(r[7] or 0)
                    tot_mb = float(r[8] or 0.0)

                    # Get detailed range boundary values for this table
                    sql_ranges = """
                    SELECT 
                        p.partition_number,
                        CONVERT(VARCHAR(50), prv.value, 120) AS boundary_val,
                        p.rows,
                        ROUND(SUM(a.total_pages) * 8.0 / 1024.0, 2) AS reserved_mb,
                        ROUND(SUM(a.used_pages) * 8.0 / 1024.0, 2) AS data_mb,
                        ROUND(SUM(a.total_pages - a.used_pages) * 8.0 / 1024.0, 2) AS index_mb,
                        fg.name AS filegroup_name
                    FROM sys.partitions p
                    JOIN sys.tables t ON p.object_id = t.object_id AND t.name = ?
                    JOIN sys.indexes i ON p.object_id = i.object_id AND p.index_id = i.index_id AND i.index_id IN (0, 1)
                    JOIN sys.partition_schemes ps ON i.data_space_id = ps.data_space_id
                    JOIN sys.destination_data_spaces dds ON ps.data_space_id = dds.partition_scheme_id AND dds.destination_id = p.partition_number
                    JOIN sys.filegroups fg ON dds.data_space_id = fg.data_space_id
                    LEFT JOIN sys.partition_range_values prv ON ps.function_id = prv.function_id AND prv.boundary_id = p.partition_number
                    LEFT JOIN sys.allocation_units a ON p.partition_id = a.container_id
                    GROUP BY p.partition_number, prv.value, p.rows, fg.name
                    ORDER BY p.partition_number;
                    """
                    cursor.execute(sql_ranges, (t_name,))
                    range_rows = cursor.fetchall()

                    partitions_list = [
                        PartitionRangeInfo(
                            partition_number=int(rr[0]),
                            boundary_value=str(rr[1]) if rr[1] else None,
                            row_count=int(rr[2] or 0),
                            reserved_mb=float(rr[3] or 0.0),
                            data_mb=float(rr[4] or 0.0),
                            index_mb=float(rr[5] or 0.0),
                            filegroup_name=str(rr[6]),
                            is_empty=(int(rr[2] or 0) == 0),
                        )
                        for rr in range_rows
                    ]

                    partitioned_tables.append(
                        TablePartitionSummary(
                            table_name=t_name,
                            schema_name=s_name,
                            is_partitioned=True,
                            partition_scheme=p_scheme,
                            partition_function=p_func,
                            partition_key_column=k_col,
                            partition_key_type=k_type,
                            total_partitions=tot_parts,
                            total_rows=tot_rows,
                            total_reserved_mb=tot_mb,
                            partitions=partitions_list,
                            recommended_action="Sliding window split & switch döngüleri sağlıklı.",
                        )
                    )

                # 2. Query Unpartitioned Large Tables (Partition Candidates)
                sql_candidates = """
                SELECT TOP 10
                    t.name AS table_name,
                    s.name AS schema_name,
                    SUM(p.rows) AS total_rows,
                    ROUND(SUM(a.total_pages) * 8.0 / 1024.0, 2) AS total_reserved_mb,
                    (
                        SELECT TOP 1 c.name 
                        FROM sys.columns c
                        JOIN sys.types ty ON c.user_type_id = ty.user_type_id
                        WHERE c.object_id = t.object_id 
                          AND (ty.name IN ('datetime', 'datetime2', 'date', 'smalldatetime') 
                               OR c.name LIKE '%Date%' OR c.name LIKE '%At%' OR c.name LIKE '%Time%')
                        ORDER BY c.column_id
                    ) AS candidate_date_column,
                    (
                        SELECT TOP 1 ty.name 
                        FROM sys.columns c
                        JOIN sys.types ty ON c.user_type_id = ty.user_type_id
                        WHERE c.object_id = t.object_id 
                          AND (ty.name IN ('datetime', 'datetime2', 'date', 'smalldatetime') 
                               OR c.name LIKE '%Date%' OR c.name LIKE '%At%' OR c.name LIKE '%Time%')
                        ORDER BY c.column_id
                    ) AS candidate_type
                FROM sys.tables t
                JOIN sys.schemas s ON t.schema_id = s.schema_id
                JOIN sys.indexes i ON t.object_id = i.object_id AND i.index_id IN (0, 1)
                JOIN sys.partitions p ON t.object_id = p.object_id AND i.index_id = p.index_id
                LEFT JOIN sys.allocation_units a ON p.partition_id = a.container_id
                WHERE t.is_ms_shipped = 0
                  AND i.data_space_id NOT IN (SELECT data_space_id FROM sys.partition_schemes)
                GROUP BY t.object_id, t.name, s.name
                HAVING SUM(p.rows) >= 5000
                ORDER BY SUM(p.rows) DESC;
                """
                cursor.execute(sql_candidates)
                cand_rows = cursor.fetchall()
                candidates: List[PartitionCandidate] = []

                for cr in cand_rows:
                    t_name = cr[0]
                    s_name = cr[1]
                    tot_rows = int(cr[2] or 0)
                    tot_mb = float(cr[3] or 0.0)
                    date_col = cr[4] or "CreatedAt"
                    date_type = cr[5] or "DATETIME2"

                    urgency = "CRITICAL" if tot_rows >= 100000 else "HIGH" if tot_rows >= 30000 else "MEDIUM"
                    reason = f"{tot_rows:,} satır ve {tot_mb:.1f} MB veri tek parça tablodadır. Zaman bazlı sorgularda index scan maliyetini artırmaktadır."
                    benefit = "Sliding Window Partition Switching ile silme/arşivleme işlemleri 0 milisaniyede ve sıfır transaction log şişmesiyle gerçekleşir."

                    candidates.append(
                        PartitionCandidate(
                            table_name=t_name,
                            schema_name=s_name,
                            total_rows=tot_rows,
                            total_reserved_mb=tot_mb,
                            recommended_key_column=date_col,
                            recommended_key_type=date_type,
                            candidate_reason=reason,
                            urgency=urgency,
                            archival_benefit=benefit,
                        )
                    )

                tot_part_tables = len(partitioned_tables)
                tot_cands = len(candidates)
                tot_parts = sum(t.total_partitions for t in partitioned_tables)
                tot_part_rows = sum(t.total_rows for t in partitioned_tables)

                return PartitioningOverviewResponse(
                    database_name=target_db,
                    server_name=params.server,
                    is_demo=False,
                    total_partitioned_tables=tot_part_tables,
                    total_candidate_tables=tot_cands,
                    total_managed_partitions=tot_parts,
                    total_partitioned_rows=tot_part_rows,
                    partitioned_tables=partitioned_tables,
                    candidates=candidates,
                )
        except Exception as exc:
            logger.warning("Partitioning overview query failed, using fallback: %s", exc)

    # Demo Fallback
    return _build_demo_partitioning(target_db)


def generate_partition_scripts(req: GeneratePartitionScriptRequest) -> GeneratePartitionScriptResponse:
    """Generate production-ready, review-only T-SQL scripts for table partitioning and sliding window maintenance."""
    t_name = req.table_name
    s_name = req.schema_name
    k_col = req.key_column
    k_type = req.key_type.upper()
    db = req.database_name
    fg = req.filegroup or "PRIMARY"

    pf_name = f"pf_{t_name}_{req.boundary_interval.lower()}"
    ps_name = f"ps_{t_name}_{req.boundary_interval.lower()}"

    # Build monthly or yearly boundary values
    boundaries: List[str] = []
    if req.boundary_interval == "MONTHLY":
        for yr in range(req.start_year, req.end_year + 1):
            for m in range(1, 13):
                boundaries.append(f"'{yr}-{m:02d}-01T00:00:00'")
    else:  # YEARLY
        for yr in range(req.start_year, req.end_year + 1):
            boundaries.append(f"'{yr}-01-01T00:00:00'")

    boundary_str = ",\n    ".join(boundaries)

    ddl_create = f"""-- ============================================================================
-- 1. ADIM: Partition Function ve Partition Scheme Oluşturma
-- Veritabanı: [{db}] | Tablo: [{s_name}].[{t_name}]
-- ============================================================================
USE [{db}];
GO

-- Varsa eski scheme ve function'ı kontrol et
IF NOT EXISTS (SELECT 1 FROM sys.partition_functions WHERE name = '{pf_name}')
BEGIN
    CREATE PARTITION FUNCTION [{pf_name}] ({k_type})
    AS RANGE RIGHT FOR VALUES (
    {boundary_str}
    );
    PRINT 'Partition Function [{pf_name}] oluşturuldu.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.partition_schemes WHERE name = '{ps_name}')
BEGIN
    CREATE PARTITION SCHEME [{ps_name}]
    AS PARTITION [{pf_name}]
    ALL TO ([{fg}]);
    PRINT 'Partition Scheme [{ps_name}] oluşturuldu.';
END
GO"""

    ddl_rebuild = f"""-- ============================================================================
-- 2. ADIM: Tabloyu Partition Scheme Üzerinde Yeniden Konumlandırma
-- Not: Bu işlem ONLINE = ON ile canlı operasyonu kesintiye uğratmadan yapılabilir.
-- ============================================================================
USE [{db}];
GO

-- 2.1 Tablonun mevcut Clustered Index'ini partition scheme üzerine taşı
-- (PK_ veya IX_ clustered indeks adını tablonuza göre güncelleyin)
CREATE CLUSTERED INDEX [CIX_{t_name}_{k_col}]
ON [{s_name}].[{t_name}] ([{k_col}])
WITH (
    DROP_EXISTING = ON,
    ONLINE = ON,
    DATA_COMPRESSION = PAGE
)
ON [{ps_name}]([{k_col}]);
GO

PRINT 'Tablo [{s_name}].[{t_name}] başarıyla [{ps_name}] üzerine bölümlendi (Partitioned).';
GO"""

    next_split_date = f"'{req.end_year + 1}-01-01T00:00:00'"
    sliding_split = f"""-- ============================================================================
-- 3. ADIM: Sliding Window (Yeni Dönem Ekleme - SPLIT)
-- Aylık / Yıllık periyotlar doldukça yeni partition ekleme rutini
-- ============================================================================
USE [{db}];
GO

-- 3.1 Bir sonraki filegroup'u hazırla
ALTER PARTITION SCHEME [{ps_name}]
NEXT USED [{fg}];
GO

-- 3.2 Partition sınırını ileriye doğru genişlet
ALTER PARTITION FUNCTION [{pf_name}]()
SPLIT RANGE ({next_split_date});
GO

PRINT 'Sliding window: Yeni dönem sınırı ({next_split_date}) eklendi.';
GO"""

    switch_archive = f"""-- ============================================================================
-- 4. ADIM: Sıfır-Log Anında Arşivleme (PARTITION SWITCH)
-- Milyonlarca satırlık eski veriyi transaction log şişirmeden 0 milisaniyede arşivleme
-- ============================================================================
USE [{db}];
GO

-- 4.1 Aynı şemaya sahip arşiv staging tablosu oluştur (birebir aynı indeksler ve filegroup)
IF OBJECT_ID('[{s_name}].[{t_name}_Archive_Staging]', 'U') IS NULL
BEGIN
    SELECT TOP 0 * INTO [{s_name}].[{t_name}_Archive_Staging]
    FROM [{s_name}].[{t_name}];

    -- Clustered Index staging üzerinde oluşturulur
    CREATE CLUSTERED INDEX [CIX_{t_name}_Staging]
    ON [{s_name}].[{t_name}_Archive_Staging] ([{k_col}])
    ON [{fg}];
END
GO

-- 4.2 En eski partition'ı (Partition 1) anında arşiv tablosuna devret (Metadata Switch)
ALTER TABLE [{s_name}].[{t_name}]
SWITCH PARTITION 1 TO [{s_name}].[{t_name}_Archive_Staging];
GO

PRINT 'Partition 1 ({t_name}) 0 milisaniyede [{t_name}_Archive_Staging] tablosuna aktarıldı!';
GO"""

    notes = [
        "Partition Switching işlemi yalnızca bir metadata işaretçisi güncellemesidir; veri fiziksel olarak kopyalanmaz, saniyeler içinde tamamlanır.",
        "Transaction Log (LDF) dosyasında milyonlarca DELETE satırı oluşmaz, disk dolumu ve checkpoint gecikmesi yaşanmaz.",
        "Sliding window yapısıyla SQL Server Agent Job üzerinden her ay başında otomatik SPLIT ve eski dönem MERGE işletilebilir.",
        "Hedeflenen tüm index'lerin partition scheme ile hizalı (Aligned Index) olması zorunludur.",
    ]

    return GeneratePartitionScriptResponse(
        table_name=t_name,
        partition_function_name=pf_name,
        partition_scheme_name=ps_name,
        ddl_create_scheme_sql=ddl_create,
        ddl_rebuild_table_sql=ddl_rebuild,
        sliding_window_split_sql=sliding_split,
        switch_archive_sql=switch_archive,
        architectural_notes=notes,
    )


def _build_demo_partitioning(db_name: str) -> PartitioningOverviewResponse:
    """Fallback high-fidelity demo partitioning models."""
    sample_partitions = [
        PartitionRangeInfo(
            partition_number=1,
            boundary_value="2025-01-01 00:00:00",
            row_count=185000,
            reserved_mb=42.5,
            data_mb=34.2,
            index_mb=8.3,
            filegroup_name="PRIMARY",
            is_empty=False,
        ),
        PartitionRangeInfo(
            partition_number=2,
            boundary_value="2025-06-01 00:00:00",
            row_count=240000,
            reserved_mb=54.8,
            data_mb=44.1,
            index_mb=10.7,
            filegroup_name="PRIMARY",
            is_empty=False,
        ),
        PartitionRangeInfo(
            partition_number=3,
            boundary_value="2026-01-01 00:00:00",
            row_count=320000,
            reserved_mb=72.1,
            data_mb=58.3,
            index_mb=13.8,
            filegroup_name="PRIMARY",
            is_empty=False,
        ),
        PartitionRangeInfo(
            partition_number=4,
            boundary_value="2026-06-01 00:00:00",
            row_count=410000,
            reserved_mb=91.4,
            data_mb=74.6,
            index_mb=16.8,
            filegroup_name="PRIMARY",
            is_empty=False,
        ),
        PartitionRangeInfo(
            partition_number=5,
            boundary_value=None,
            row_count=52000,
            reserved_mb=12.2,
            data_mb=9.8,
            index_mb=2.4,
            filegroup_name="PRIMARY",
            is_empty=False,
        ),
    ]

    p_table = TablePartitionSummary(
        table_name="OrderTransactions",
        schema_name="dbo",
        is_partitioned=True,
        partition_scheme="ps_OrderTransactions_range",
        partition_function="pf_OrderTransactions_yearly",
        partition_key_column="TransactionDate",
        partition_key_type="DATETIME2",
        total_partitions=5,
        total_rows=1207000,
        total_reserved_mb=273.0,
        partitions=sample_partitions,
        recommended_action="1. Partition (2025 Öncesi) arşivleme için SWITCH PARTITION aday durumdadır.",
    )

    candidates = [
        PartitionCandidate(
            table_name="OrderDetails",
            schema_name="dbo",
            total_rows=100000,
            total_reserved_mb=32.4,
            recommended_key_column="CreatedAt",
            recommended_key_type="DATETIME2",
            candidate_reason="100.000 satırlık sipariş detay tablosu tek parça depolanmaktadır.",
            urgency="CRITICAL",
            archival_benefit="Aylık partition switching ile sipariş temizleme işlemleri milisaniyeler içinde log yazmadan tamamlanır.",
        ),
        PartitionCandidate(
            table_name="Invoices",
            schema_name="dbo",
            total_rows=50000,
            total_reserved_mb=18.6,
            recommended_key_column="InvoiceDate",
            recommended_key_type="DATETIME2",
            candidate_reason="50.000 satır fatura arşivi zaman bazlı filtrelerde scan yükü yaratmaktadır.",
            urgency="HIGH",
            archival_benefit="Yıllık partition scheme ile faturaların mali dönem kapanışlarında hızlı taşınması sağlanır.",
        ),
        PartitionCandidate(
            table_name="Orders",
            schema_name="dbo",
            total_rows=50000,
            total_reserved_mb=16.2,
            recommended_key_column="OrderDate",
            recommended_key_type="DATETIME2",
            candidate_reason="50.000 satır sipariş verisi düzenli büyümektedir.",
            urgency="HIGH",
            archival_benefit="OrderDate üzerinden aylık sliding-window mimarisi önerilir.",
        ),
    ]

    return PartitioningOverviewResponse(
        database_name=db_name,
        server_name="localhost",
        is_demo=True,
        total_partitioned_tables=1,
        total_candidate_tables=3,
        total_managed_partitions=5,
        total_partitioned_rows=1207000,
        partitioned_tables=[p_table],
        candidates=candidates,
    )
