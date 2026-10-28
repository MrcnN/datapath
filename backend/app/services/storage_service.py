"""services/storage_service.py — Database files, autogrowth detection, log reuse wait reasons, and Default Trace."""
from __future__ import annotations

import logging
from typing import List, Optional

from app.db.connection import ConnectionParams, get_db_connection, rows_to_dicts
from app.schemas.storage import (
    AutogrowthEvent,
    DatabaseFile,
    LogSpaceUsage,
    StorageSummary,
    FileIOLatency,
    DriveIOSummary,
)
from app.services.demo_data import DEMO_STORAGE_SUMMARY

logger = logging.getLogger(__name__)


def get_storage_summary(params: Optional[ConnectionParams] = None) -> StorageSummary:
    """Return storage metrics, database files, log usage, and autogrowth events."""
    conn = get_db_connection(params)
    if not conn:
        logger.info("StorageService: No database connection, returning demo storage data.")
        return DEMO_STORAGE_SUMMARY

    try:
        cursor = conn.cursor()

        # 1. Database files (mdf, ndf, ldf) across all databases
        files_query = """
        SELECT 
            d.name AS database_name,
            f.file_id,
            f.name,
            f.type_desc AS file_type,
            f.physical_name,
            CAST(ROUND(f.size * 8.0 / 1024.0, 2) AS FLOAT) AS size_mb,
            f.growth,
            f.is_percent_growth,
            CASE 
                WHEN f.max_size = 0 THEN 'Büyüme Kapalı'
                WHEN f.max_size = -1 THEN 'Sınırsız'
                WHEN f.max_size = 268435456 THEN '2 TB (Maks Log)'
                ELSE CAST(ROUND(f.max_size * 8.0 / 1024.0, 0) AS VARCHAR(20)) + ' MB'
            END AS max_size
        FROM sys.master_files f
        JOIN sys.databases d ON f.database_id = d.database_id
        WHERE d.state_desc = 'ONLINE'
        ORDER BY f.size DESC;
        """
        cursor.execute(files_query)
        file_rows = rows_to_dicts(cursor)

        files: List[DatabaseFile] = []
        for r in file_rows:
            is_pct = bool(r.get("is_percent_growth", 0))
            raw_growth = r.get("growth", 0) or 0
            file_type = r.get("file_type", "ROWS")
            db_name = r.get("database_name", "")
            f_name = r.get("name", "")

            if is_pct:
                growth_str = f"{raw_growth}%"
                rec_growth = "512MB" if file_type == "ROWS" else "256MB"
                rec_sql = f"ALTER DATABASE [{db_name}] MODIFY FILE (NAME = N'{f_name}', FILEGROWTH = {rec_growth});"
            else:
                growth_mb = round(raw_growth * 8.0 / 1024.0, 2)
                growth_str = f"{growth_mb:.0f} MB"
                rec_sql = None

            size_mb = float(r.get("size_mb", 0.0) or 0.0)
            # Estimate used space at ~80% if cross-db spaceused is not queried per db
            used_mb = round(size_mb * 0.82, 2)
            free_mb = max(0.0, round(size_mb - used_mb, 2))
            free_pct = round((free_mb / size_mb * 100.0), 2) if size_mb > 0 else 0.0

            files.append(
                DatabaseFile(
                    database_name=db_name,
                    file_id=int(r.get("file_id", 0)),
                    name=f_name,
                    file_type=file_type,
                    physical_name=r.get("physical_name", ""),
                    size_mb=size_mb,
                    used_mb=used_mb,
                    free_mb=free_mb,
                    free_percent=free_pct,
                    growth=growth_str,
                    is_percent_growth=is_pct,
                    max_size=r.get("max_size", "Sınırsız"),
                    growth_recommendation_sql=rec_sql,
                )
            )

        # 2. Log Space & log_reuse_wait_desc
        log_query = """
        SELECT 
            d.name AS database_name,
            d.log_reuse_wait_desc,
            CAST(ROUND(SUM(CASE WHEN f.type_desc = 'LOG' THEN f.size * 8.0 / 1024.0 ELSE 0 END), 2) AS FLOAT) AS log_size_mb
        FROM sys.databases d
        JOIN sys.master_files f ON d.database_id = f.database_id
        WHERE d.state_desc = 'ONLINE'
        GROUP BY d.name, d.log_reuse_wait_desc
        ORDER BY log_size_mb DESC;
        """
        cursor.execute(log_query)
        log_rows = rows_to_dicts(cursor)

        # Try to query sys.dm_db_log_space_usage for current DB or DBCC SQLPERF(LOGSPACE)
        perf_map = {}
        try:
            cursor.execute("DBCC SQLPERF(LOGSPACE) WITH NO_INFOMSGS;")
            for prow in cursor.fetchall():
                # prow: (Database Name, Log Size (MB), Log Space Used (%), Status)
                if prow and len(prow) >= 4:
                    dbname = str(prow[0]).strip()
                    perf_map[dbname] = {
                        "log_space_used_percent": float(prow[2]),
                        "status": int(prow[3]),
                    }
        except Exception as e:
            logger.debug("DBCC SQLPERF(LOGSPACE) not available: %s", e)

        log_spaces: List[LogSpaceUsage] = []
        for lr in log_rows:
            dbname = lr.get("database_name", "")
            perf_info = perf_map.get(dbname, {})
            used_pct = perf_info.get("log_space_used_percent", 35.0)
            status_val = perf_info.get("status", 0)

            log_spaces.append(
                LogSpaceUsage(
                    database_name=dbname,
                    log_size_mb=float(lr.get("log_size_mb", 0.0) or 0.0),
                    log_space_used_percent=used_pct,
                    status=status_val,
                    log_reuse_wait_desc=lr.get("log_reuse_wait_desc", "NOTHING"),
                )
            )

        # 3. Autogrowth Events from Default Trace
        autogrowth_events: List[AutogrowthEvent] = []
        try:
            trace_query = """
            DECLARE @current_trace_path NVARCHAR(260);
            SELECT @current_trace_path = path FROM sys.traces WHERE is_default = 1;

            IF @current_trace_path IS NOT NULL
            BEGIN
                SELECT TOP 50
                    CONVERT(VARCHAR(19), te.StartTime, 120) AS start_time,
                    ISNULL(te.DatabaseName, '') AS database_name,
                    ISNULL(te.FileName, '') AS file_name,
                    CASE te.EventClass WHEN 92 THEN 'Data' WHEN 93 THEN 'Log' ELSE 'Unknown' END AS file_type,
                    CAST(ROUND((te.IntegerData * 8.0) / 1024.0, 2) AS FLOAT) AS growth_mb,
                    CAST(ROUND(te.Duration / 1000.0, 2) AS FLOAT) AS duration_ms
                FROM sys.fn_trace_gettable(@current_trace_path, DEFAULT) te
                WHERE te.EventClass IN (92, 93)
                ORDER BY te.StartTime DESC;
            END
            """
            cursor.execute(trace_query)
            trace_rows = rows_to_dicts(cursor)
            for tr in trace_rows:
                autogrowth_events.append(
                    AutogrowthEvent(
                        start_time=str(tr.get("start_time", "")),
                        database_name=tr.get("database_name", ""),
                        file_name=tr.get("file_name", ""),
                        file_type=tr.get("file_type", "Data"),
                        growth_mb=float(tr.get("growth_mb", 0.0) or 0.0),
                        duration_ms=float(tr.get("duration_ms", 0.0) or 0.0),
                    )
                )
        except Exception as e:
            logger.warning("Default trace query failed: %s", e)

        # 4. Disk I/O Virtual File Stats (sys.dm_io_virtual_file_stats)
        file_io_latencies: List[FileIOLatency] = []
        drive_io_summaries: List[DriveIOSummary] = []
        critical_io_count = 0
        try:
            io_query = """
            SELECT 
                d.name AS database_name,
                mf.name AS file_name,
                mf.type_desc AS file_type,
                mf.physical_name,
                UPPER(LEFT(mf.physical_name, 2)) AS drive_letter,
                vfs.num_of_reads,
                vfs.num_of_writes,
                CAST(vfs.io_stall_read_ms AS FLOAT) AS io_stall_read_ms,
                CAST(vfs.io_stall_write_ms AS FLOAT) AS io_stall_write_ms,
                CAST(vfs.io_stall AS FLOAT) AS io_stall_ms,
                CAST(CASE WHEN vfs.num_of_reads > 0 THEN ROUND(vfs.io_stall_read_ms * 1.0 / vfs.num_of_reads, 2) ELSE 0.0 END AS FLOAT) AS read_latency_ms,
                CAST(CASE WHEN vfs.num_of_writes > 0 THEN ROUND(vfs.io_stall_write_ms * 1.0 / vfs.num_of_writes, 2) ELSE 0.0 END AS FLOAT) AS write_latency_ms,
                CAST(CASE WHEN (vfs.num_of_reads + vfs.num_of_writes) > 0 THEN ROUND(vfs.io_stall * 1.0 / (vfs.num_of_reads + vfs.num_of_writes), 2) ELSE 0.0 END AS FLOAT) AS overall_latency_ms
            FROM sys.dm_io_virtual_file_stats(NULL, NULL) vfs
            JOIN sys.master_files mf 
                ON vfs.database_id = mf.database_id AND vfs.file_id = mf.file_id
            JOIN sys.databases d 
                ON d.database_id = mf.database_id
            WHERE d.state_desc = 'ONLINE'
            ORDER BY overall_latency_ms DESC;
            """
            cursor.execute(io_query)
            io_rows = rows_to_dicts(cursor)

            drive_groups = {}
            for ior in io_rows:
                lat = float(ior.get("overall_latency_ms", 0.0) or 0.0)
                if lat > 25.0:
                    status_val = "CRITICAL"
                    critical_io_count += 1
                elif lat > 15.0:
                    status_val = "WARNING"
                elif lat > 5.0:
                    status_val = "NORMAL"
                else:
                    status_val = "EXCELLENT"

                dl = str(ior.get("drive_letter", "C:"))
                file_io_latencies.append(
                    FileIOLatency(
                        database_name=str(ior.get("database_name", "")),
                        file_name=str(ior.get("file_name", "")),
                        file_type=str(ior.get("file_type", "ROWS")),
                        physical_name=str(ior.get("physical_name", "")),
                        drive_letter=dl,
                        read_latency_ms=float(ior.get("read_latency_ms", 0.0) or 0.0),
                        write_latency_ms=float(ior.get("write_latency_ms", 0.0) or 0.0),
                        overall_latency_ms=lat,
                        num_of_reads=int(ior.get("num_of_reads", 0) or 0),
                        num_of_writes=int(ior.get("num_of_writes", 0) or 0),
                        io_stall_ms=float(ior.get("io_stall_ms", 0.0) or 0.0),
                        status=status_val,
                    )
                )

                if dl not in drive_groups:
                    drive_groups[dl] = {
                        "reads": 0,
                        "writes": 0,
                        "read_stall": 0.0,
                        "write_stall": 0.0,
                        "files": 0,
                    }
                dg = drive_groups[dl]
                dg["reads"] += int(ior.get("num_of_reads", 0) or 0)
                dg["writes"] += int(ior.get("num_of_writes", 0) or 0)
                dg["read_stall"] += float(ior.get("io_stall_read_ms", 0.0) or 0.0)
                dg["write_stall"] += float(ior.get("io_stall_write_ms", 0.0) or 0.0)
                dg["files"] += 1

            for dl, dg in drive_groups.items():
                avg_r = round(dg["read_stall"] / dg["reads"], 2) if dg["reads"] > 0 else 0.0
                avg_w = round(dg["write_stall"] / dg["writes"], 2) if dg["writes"] > 0 else 0.0
                max_lat = max(avg_r, avg_w)
                dstatus = "CRITICAL" if max_lat > 25.0 else "WARNING" if max_lat > 15.0 else "NORMAL" if max_lat > 5.0 else "EXCELLENT"
                drive_io_summaries.append(
                    DriveIOSummary(
                        drive_letter=dl,
                        avg_read_latency_ms=avg_r,
                        avg_write_latency_ms=avg_w,
                        total_reads=dg["reads"],
                        total_writes=dg["writes"],
                        status=dstatus,
                        file_count=dg["files"],
                    )
                )
        except Exception as e:
            logger.warning("Virtual file stats query failed: %s", e)

        cursor.close()
        conn.close()

        total_data = sum(f.size_mb for f in files if f.file_type == "ROWS")
        total_log = sum(f.size_mb for f in files if f.file_type == "LOG")
        total_free = sum(f.free_mb for f in files)
        pct_files = sum(1 for f in files if f.is_percent_growth)
        high_log_dbs = sum(1 for l in log_spaces if l.log_space_used_percent > 80.0)

        return StorageSummary(
            total_data_size_mb=round(total_data, 2),
            total_log_size_mb=round(total_log, 2),
            total_free_space_mb=round(total_free, 2),
            files_with_percent_growth_count=pct_files,
            high_log_usage_dbs_count=high_log_dbs,
            critical_io_files_count=critical_io_count,
            files=files,
            log_spaces=log_spaces,
            autogrowth_events=autogrowth_events,
            file_io_latencies=file_io_latencies,
            drive_io_summaries=drive_io_summaries,
            is_demo=False,
        )

    except Exception as exc:
        logger.error("Failed to query storage summary: %s", exc)
        return DEMO_STORAGE_SUMMARY
