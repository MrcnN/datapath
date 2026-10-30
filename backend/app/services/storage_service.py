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
    DatabaseGrowthForecast,
    GrowthHistoryPoint,
    DatabaseVLFInfo,
    OpenTransaction,
    LogReuseWaitDetail,
    OpenTransactionsSummary,
)
from app.services.demo_data import (
    DEMO_STORAGE_SUMMARY,
    DEMO_GROWTH_FORECASTS,
    DEMO_VLF_INFOS,
    DEMO_OPEN_TRANSACTIONS_SUMMARY,
)

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

        # 5. Database Growth Trends & Capacity Forecasting
        growth_forecasts: List[DatabaseGrowthForecast] = []
        try:
            drive_space_map = {}
            cursor.execute(
                """
                SELECT DISTINCT
                    d.name AS database_name,
                    UPPER(LEFT(vs.volume_mount_point, 1)) + ':' AS drive_letter,
                    CAST(ROUND(vs.available_bytes / 1048576.0, 2) AS FLOAT) AS drive_free_space_mb
                FROM sys.master_files mf
                CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.file_id) vs
                JOIN sys.databases d ON mf.database_id = d.database_id
                WHERE mf.type = 0 AND d.state_desc = 'ONLINE';
                """
            )
            for row in rows_to_dicts(cursor):
                drive_space_map[row["database_name"]] = (row["drive_letter"], float(row["drive_free_space_mb"]))

            cursor.execute(
                """
                WITH DailyBackups AS (
                    SELECT 
                        database_name,
                        backup_start_date,
                        backup_size / 1048576.0 AS backup_size_mb,
                        ROW_NUMBER() OVER(
                            PARTITION BY database_name, CONVERT(VARCHAR(10), backup_start_date, 120) 
                            ORDER BY backup_start_date DESC
                        ) AS rn
                    FROM msdb.dbo.backupset
                    WHERE type = 'D'
                      AND backup_start_date >= DATEADD(day, -90, GETDATE())
                )
                SELECT 
                    database_name, 
                    CONVERT(VARCHAR(10), backup_start_date, 120) AS backup_date, 
                    CAST(ROUND(backup_size_mb, 2) AS FLOAT) AS backup_size_mb
                FROM DailyBackups
                WHERE rn = 1
                ORDER BY database_name, backup_date;
                """
            )
            growth_rows = rows_to_dicts(cursor)
            
            db_points = {}
            for gr in growth_rows:
                dbname = gr["database_name"]
                if dbname not in db_points:
                    db_points[dbname] = []
                db_points[dbname].append(GrowthHistoryPoint(date=gr["backup_date"], size_mb=float(gr["backup_size_mb"])))

            db_sizes = {}
            for f in files:
                if f.file_type == "ROWS":
                    db_sizes[f.database_name] = db_sizes.get(f.database_name, 0.0) + f.size_mb

            for dbname, cur_size in db_sizes.items():
                pts = db_points.get(dbname, [])
                drive_let, free_mb = drive_space_map.get(dbname, ("C:", 50000.0))

                s30 = None
                s60 = None
                s90 = None
                if pts:
                    s90 = pts[0].size_mb if len(pts) >= 1 else None
                    s60 = pts[len(pts) // 3].size_mb if len(pts) >= 3 else None
                    s30 = pts[-1].size_mb if pts else None

                base_30 = s30 if s30 is not None else cur_size
                growth_30 = max(0.0, cur_size - base_30) if cur_size > base_30 else 0.0
                pct_30 = round((growth_30 / base_30 * 100.0), 2) if base_30 > 0 else 0.0
                daily_mb = round(growth_30 / 30.0, 2)
                proj_90 = round(cur_size + (daily_mb * 90.0), 2)
                days_left = int(free_mb / daily_mb) if daily_mb > 0 else None

                status_str = "STABLE"
                if days_left is not None and days_left < 30:
                    status_str = "CRITICAL_CAPACITY"
                elif pct_30 > 15.0:
                    status_str = "RAPID_GROWTH"
                elif pct_30 > 5.0:
                    status_str = "MODERATE"

                growth_forecasts.append(
                    DatabaseGrowthForecast(
                        database_name=dbname,
                        current_size_mb=round(cur_size, 2),
                        size_30_days_ago_mb=round(s30, 2) if s30 else None,
                        size_60_days_ago_mb=round(s60, 2) if s60 else None,
                        size_90_days_ago_mb=round(s90, 2) if s90 else None,
                        growth_last_30_days_mb=round(growth_30, 2),
                        growth_percent_30_days=pct_30,
                        daily_growth_mb=daily_mb,
                        projected_size_90_days_mb=proj_90,
                        drive_letter=drive_let,
                        drive_free_space_mb=round(free_mb, 2),
                        days_until_disk_full=days_left,
                        status=status_str,
                        history_points=pts,
                    )
                )

        except Exception as e:
            logger.warning("Growth forecast query failed: %s", e)

        if not growth_forecasts:
            growth_forecasts = DEMO_GROWTH_FORECASTS

        # 6. VLF (Virtual Log File) Health via sys.dm_db_log_info
        vlf_infos: List[DatabaseVLFInfo] = []
        try:
            vlf_query = """
            SELECT 
                d.name AS database_name,
                d.recovery_model_desc AS recovery_model,
                d.log_reuse_wait_desc,
                COUNT(li.vlf_sequence_number) AS vlf_count,
                ISNULL(SUM(CASE WHEN li.vlf_status = 2 THEN 1 ELSE 0 END), 0) AS active_vlf_count,
                ISNULL(SUM(CASE WHEN li.vlf_status != 2 THEN 1 ELSE 0 END), 0) AS inactive_vlf_count,
                CAST(ROUND(SUM(li.vlf_size_mb), 2) AS FLOAT) AS log_size_mb,
                CAST(ROUND(AVG(li.vlf_size_mb), 2) AS FLOAT) AS avg_vlf_size_mb
            FROM sys.databases d
            CROSS APPLY sys.dm_db_log_info(d.database_id) li
            WHERE d.state_desc = 'ONLINE'
            GROUP BY d.name, d.recovery_model_desc, d.log_reuse_wait_desc
            ORDER BY vlf_count DESC;
            """
            cursor.execute(vlf_query)
            vlf_rows = rows_to_dicts(cursor)

            for r in vlf_rows:
                db_name = r.get("database_name", "")
                cnt = int(r.get("vlf_count", 0) or 0)
                act_cnt = int(r.get("active_vlf_count", 0) or 0)
                inact_cnt = int(r.get("inactive_vlf_count", 0) or 0)
                rec_model = r.get("recovery_model", "FULL")
                wait_desc = r.get("log_reuse_wait_desc", "NOTHING")
                l_size = float(r.get("log_size_mb", 0.0) or 0.0)
                avg_vlf = float(r.get("avg_vlf_size_mb", 0.0) or 0.0)

                if cnt > 1000:
                    status = "CRITICAL"
                    recom = f"Kritik VLF parçalanması ({cnt} VLF). Sık autogrowth nedeniyle aşırı VLF oluşmuş. Crash recovery ve failover gecikir. Log yedeği alıp SHRINKFILE ve büyük bloklarla MODIFY FILE uygulayınız."
                    remed_sql = f"-- 1. Log yedeği alarak inaktif VLF'leri serbest bırakınız\nBACKUP LOG [{db_name}] TO DISK = 'NUL';\nGO\n\n-- 2. Log dosyasını küçültünüz\nUSE [{db_name}];\nDBCC SHRINKFILE (2, 64);\nGO\n\n-- 3. Log dosyasını tek seferde uygun boyutta büyütünüz (Örn: 4GB = 64 VLF)\nALTER DATABASE [{db_name}] MODIFY FILE (NAME = 2, SIZE = 4096MB);\nGO\n\n-- 4. Büyüme artışını 512MB olarak sabitleyiniz\nALTER DATABASE [{db_name}] MODIFY FILE (NAME = 2, FILEGROWTH = 512MB);\nGO"
                elif cnt >= 250:
                    status = "WARNING"
                    recom = f"Orta seviye VLF parçalanması ({cnt} VLF). Gelecekteki autogrowth artışını 256MB veya 512MB seviyesine çıkarınız."
                    remed_sql = f"-- Log büyüme ayarını 256MB olarak yapılandırınız\nALTER DATABASE [{db_name}] MODIFY FILE (NAME = 2, FILEGROWTH = 256MB);\nGO"
                else:
                    status = "HEALTHY"
                    recom = f"VLF sayısı optimal seviyededir ({cnt} VLF). Bakım gerekmez."
                    remed_sql = f"-- VLF sayısı sağlıklı ({cnt} VLF). Müdahale gerekmiyor."

                vlf_infos.append(
                    DatabaseVLFInfo(
                        database_name=db_name,
                        vlf_count=cnt,
                        active_vlf_count=act_cnt,
                        inactive_vlf_count=inact_cnt,
                        log_size_mb=l_size,
                        avg_vlf_size_mb=avg_vlf,
                        recovery_model=rec_model,
                        log_reuse_wait_desc=wait_desc,
                        status=status,
                        recommendation=recom,
                        remediation_script=remed_sql,
                    )
                )
        except Exception as vlf_err:
            logger.warning("Could not query sys.dm_db_log_info (%s), falling back to demo VLF data.", vlf_err)
            vlf_infos = DEMO_VLF_INFOS

        if not vlf_infos:
            vlf_infos = DEMO_VLF_INFOS

        cursor.close()
        conn.close()

        total_data = sum(f.size_mb for f in files if f.file_type == "ROWS")
        total_log = sum(f.size_mb for f in files if f.file_type == "LOG")
        total_free = sum(f.free_mb for f in files)
        pct_files = sum(1 for f in files if f.is_percent_growth)
        high_log_dbs = sum(1 for l in log_spaces if l.log_space_used_percent > 80.0)
        critical_vlf_count = sum(1 for v in vlf_infos if v.status == "CRITICAL")

        # Fastest growing db and total 30-day growth
        fastest_db = None
        tot_growth_30 = sum(g.growth_last_30_days_mb for g in growth_forecasts)
        min_runway = None
        runway_candidates = [g.days_until_disk_full for g in growth_forecasts if g.days_until_disk_full is not None]
        if runway_candidates:
            min_runway = min(runway_candidates)

        sorted_growth = sorted(growth_forecasts, key=lambda x: x.growth_last_30_days_mb, reverse=True)
        if sorted_growth and sorted_growth[0].growth_last_30_days_mb > 0:
            top_g = sorted_growth[0]
            fastest_db = f"{top_g.database_name} (+{(top_g.growth_last_30_days_mb / 1024):.1f} GB / ay)"

        return StorageSummary(
            total_data_size_mb=round(total_data, 2),
            total_log_size_mb=round(total_log, 2),
            total_free_space_mb=round(total_free, 2),
            files_with_percent_growth_count=pct_files,
            high_log_usage_dbs_count=high_log_dbs,
            critical_io_files_count=critical_io_count,
            critical_vlf_dbs_count=critical_vlf_count,
            files=files,
            log_spaces=log_spaces,
            autogrowth_events=autogrowth_events,
            file_io_latencies=file_io_latencies,
            drive_io_summaries=drive_io_summaries,
            growth_forecasts=growth_forecasts,
            vlf_infos=vlf_infos,
            fastest_growing_db=fastest_db,
            total_30_day_growth_mb=round(tot_growth_30, 2),
            min_disk_runway_days=min_runway,
            is_demo=False,
        )

    except Exception as exc:
        logger.error("Failed to query storage summary: %s", exc)
        return DEMO_STORAGE_SUMMARY


def get_open_transactions_summary(params: Optional[ConnectionParams] = None) -> OpenTransactionsSummary:
    """Retrieve active open transactions and analyze log reuse wait blockers."""
    conn = get_db_connection(params)
    if not conn:
        logger.info("StorageService: No database connection, returning demo open transactions.")
        return DEMO_OPEN_TRANSACTIONS_SUMMARY

    try:
        cursor = conn.cursor()

        # 1. Open Transactions Query
        open_tran_query = """
        SELECT 
            s.session_id,
            at.transaction_id,
            ISNULL(at.name, 'unnamed') AS transaction_name,
            ISNULL(DB_NAME(s.database_id), 'master') AS database_name,
            ISNULL(s.login_name, '') AS login_name,
            ISNULL(s.host_name, '') AS host_name,
            ISNULL(s.program_name, '') AS program_name,
            CONVERT(VARCHAR(19), at.transaction_begin_time, 120) AS begin_time,
            ISNULL(DATEDIFF(SECOND, at.transaction_begin_time, GETDATE()), 0) AS duration_seconds,
            CASE at.transaction_state
                WHEN 0 THEN 'Başlatılmamış'
                WHEN 1 THEN 'Başlatılmış'
                WHEN 2 THEN 'Aktif'
                WHEN 3 THEN 'Hazırlanmış'
                WHEN 4 THEN 'Commit Edilmiş'
                WHEN 5 THEN 'Hazırlık Aşamasında'
                WHEN 6 THEN 'Aborted/Rollback'
                ELSE 'Bilinmiyor'
            END AS transaction_state,
            CASE at.transaction_type
                WHEN 1 THEN 'Okuma/Yazma (Read/Write)'
                WHEN 2 THEN 'Salt Okunur (Read-Only)'
                WHEN 3 THEN 'Sistem İşlemi'
                WHEN 4 THEN 'Dağıtık İşlem'
                ELSE 'Diğer'
            END AS transaction_type,
            s.status AS session_status,
            CASE WHEN s.status = 'sleeping' AND s.open_transaction_count > 0 THEN 1 ELSE 0 END AS is_dormant_active,
            ISNULL(s.open_transaction_count, 1) AS open_transaction_count,
            CAST(ROUND(ISNULL(dt.database_transaction_log_bytes_used, 0) / 1048576.0, 2) AS FLOAT) AS log_bytes_used_mb,
            ISNULL(dt.database_transaction_log_record_count, 0) AS log_records_count,
            ISNULL(st.text, ISNULL(con_st.text, '')) AS sql_text,
            ISNULL(blk.blocking_count, 0) AS blocking_session_count
        FROM sys.dm_tran_active_transactions at
        JOIN sys.dm_tran_session_transactions st_tran ON at.transaction_id = st_tran.transaction_id
        JOIN sys.dm_exec_sessions s ON st_tran.session_id = s.session_id
        LEFT JOIN sys.dm_tran_database_transactions dt ON at.transaction_id = dt.transaction_id
        LEFT JOIN sys.dm_exec_requests r ON s.session_id = r.session_id
        LEFT JOIN sys.dm_exec_connections c ON s.session_id = c.session_id
        OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) st
        OUTER APPLY sys.dm_exec_sql_text(c.most_recent_sql_handle) con_st
        LEFT JOIN (
            SELECT blocking_session_id, COUNT(*) AS blocking_count 
            FROM sys.dm_exec_requests 
            WHERE blocking_session_id <> 0 
            GROUP BY blocking_session_id
        ) blk ON s.session_id = blk.blocking_session_id
        WHERE s.is_user_process = 1
        ORDER BY duration_seconds DESC;
        """
        cursor.execute(open_tran_query)
        tran_rows = rows_to_dicts(cursor)

        transactions: List[OpenTransaction] = []
        for tr in tran_rows:
            dur_sec = int(tr.get("duration_seconds") or 0)
            if dur_sec >= 3600:
                hours = dur_sec // 3600
                mins = (dur_sec % 3600) // 60
                dur_fmt = f"{hours} sa {mins} dk"
            elif dur_sec >= 60:
                mins = dur_sec // 60
                secs = dur_sec % 60
                dur_fmt = f"{mins} dk {secs} sn"
            else:
                dur_fmt = f"{dur_sec} sn"

            spid = int(tr.get("session_id") or 0)
            transactions.append(
                OpenTransaction(
                    session_id=spid,
                    transaction_id=int(tr.get("transaction_id") or 0),
                    transaction_name=str(tr.get("transaction_name") or "unnamed"),
                    database_name=str(tr.get("database_name") or "master"),
                    login_name=str(tr.get("login_name") or ""),
                    host_name=str(tr.get("host_name") or ""),
                    program_name=str(tr.get("program_name") or ""),
                    begin_time=str(tr.get("begin_time") or ""),
                    duration_seconds=dur_sec,
                    duration_formatted=dur_fmt,
                    transaction_state=str(tr.get("transaction_state") or "Aktif"),
                    transaction_type=str(tr.get("transaction_type") or "Okuma/Yazma"),
                    session_status=str(tr.get("session_status") or "running"),
                    is_dormant_active=bool(tr.get("is_dormant_active", 0)),
                    open_transaction_count=int(tr.get("open_transaction_count") or 1),
                    log_bytes_used_mb=float(tr.get("log_bytes_used_mb") or 0.0),
                    log_records_count=int(tr.get("log_records_count") or 0),
                    sql_text=str(tr.get("sql_text") or "") if tr.get("sql_text") else None,
                    blocking_session_count=int(tr.get("blocking_session_count") or 0),
                    kill_script=f"-- DİKKAT: Yalnızca onaylı operasyonlarda çalıştırınız:\nKILL {spid};",
                )
            )

        # 2. Log Reuse Wait Query & Analysis
        log_reuse_query = """
        SELECT 
            d.name AS database_name,
            d.recovery_model_desc AS recovery_model,
            d.log_reuse_wait_desc,
            CAST(ROUND(SUM(CASE WHEN f.type_desc = 'LOG' THEN f.size * 8.0 / 1024.0 ELSE 0 END), 2) AS FLOAT) AS log_size_mb
        FROM sys.databases d
        JOIN sys.master_files f ON d.database_id = f.database_id
        WHERE d.state_desc = 'ONLINE'
        GROUP BY d.name, d.recovery_model_desc, d.log_reuse_wait_desc
        ORDER BY log_size_mb DESC;
        """
        cursor.execute(log_reuse_query)
        lr_rows = rows_to_dicts(cursor)

        log_reuse_waits: List[LogReuseWaitDetail] = []
        for lr in lr_rows:
            dbname = lr.get("database_name", "")
            rec_model = lr.get("recovery_model", "FULL")
            wait_desc = lr.get("log_reuse_wait_desc", "NOTHING")
            log_size = float(lr.get("log_size_mb") or 0.0)

            # Determine status & diagnostic mapping
            if wait_desc == "NOTHING":
                status = "HEALTHY"
                root_cause = "Log kesilmesini (truncation) engelleyen bir durum bulunmuyor. Bir sonraki log yedeğinde veya checkpoint işleminde inaktif VLF'ler temizlenecektir."
                impact = "Log büyümesi kontrol altında."
                steps = ["Rutin log yedekleme planınızı sürdürün."]
                remed_sql = f"-- {dbname} için log kesilmesi sağlıklı durumda."
            elif wait_desc == "ACTIVE_TRANSACTION":
                status = "CRITICAL"
                root_cause = "Açık kalan veya uzun süredir çalışan bir işlem (Active Transaction) MinLSN değerini tutuyor. İşlem tamamlanana kadar hiçbir log alanı boşaltılamaz."
                impact = "Log dosyası otomatik büyüyerek diski doldurabilir."
                steps = [
                    f"'{dbname}' üzerindeki açık işlemleri kontrol edin.",
                    "Oturum sleeping durumundaysa geliştirici/uygulama sahibine bildirin veya KILL uygulayın.",
                    "İşlem kapandıktan sonra log yedeği alarak log alanını geri kazanın.",
                ]
                remed_sql = f"-- 1. Açık işlemi inceleyin:\nDBCC OPENTRAN([{dbname}]);\nGO\n\n-- 2. Gerekirse askıdaki oturumu sonlandırın:\n-- KILL <SPID>;\nGO\n\n-- 3. Log yedeği alın:\nBACKUP LOG [{dbname}] TO DISK = N'C:\\Backups\\{dbname}_Log.trn' WITH COMPRESSION;\nGO"
            elif wait_desc == "LOG_BACKUP":
                status = "WARNING" if log_size < 5000 else "CRITICAL"
                root_cause = f"Veritabanı '{rec_model}' kurtarma modelinde çalışıyor ancak son log kesilmesinden sonra yeni bir Transaction Log yedeği alınmamış."
                impact = "Log dosyasında yer açılmıyor, her yeni işlem dosyanın diskte büyümesine neden oluyor."
                steps = [
                    f"'{dbname}' veritabanı için Transaction Log yedeği alın.",
                    "SQL Agent üzerinde log yedekleme işinin (Örn: her 15 dakikada bir) çalıştığından emin olun.",
                ]
                remed_sql = f"BACKUP LOG [{dbname}] TO DISK = N'C:\\Backups\\{dbname}_LogBackup.trn' WITH COMPRESSION, STATS = 10;\nGO"
            elif wait_desc == "CHECKPOINT":
                status = "HEALTHY"
                root_cause = "SIMPLE kurtarma modelinde bekleyen log kayıtlarının disk Checkpoint işlemi henüz gerçekleşmemiş."
                impact = "Düşük risk. Rutin otomatik Checkpoint döngüsünde temizlenir."
                steps = ["Gerekiyorsa manuel CHECKPOINT çalıştırılabilir."]
                remed_sql = f"USE [{dbname}];\nCHECKPOINT;\nGO"
            elif wait_desc in ("AVAILABILITY_GROUP", "DATABASE_MIRRORING"):
                status = "WARNING"
                root_cause = "AlwaysOn Availability Group veya Mirroring ikincil kopyası log kayıtlarını henüz kendi diskine yazmadı (harden etmedi)."
                impact = "İkincil replika senkronizasyonu tamamlamadan birincil sunucuda log kesilemez."
                steps = [
                    "İkincil replikanın erişilebilir ve ONLINE olduğunu doğrulayın.",
                    "Ağ gecikmesini ve replika senkronizasyon kuyruğunu kontrol edin.",
                ]
                remed_sql = f"SELECT replica_server_name, synchronization_health_desc, log_send_queue_size FROM sys.dm_hadr_database_replica_states WHERE is_local = 0;\nGO"
            elif wait_desc == "REPLICATION":
                status = "WARNING"
                root_cause = "Transactional Replication veya Change Data Capture (CDC) Log Reader Agent henüz bekleyen işlemleri okumadı."
                impact = "Replikasyon kuyruğu temizlenmeden log temizlenemez."
                steps = [
                    "SQL Server Agent üzerindeki Log Reader Agent işini kontrol edin.",
                    "Replikasyon durdurulduysa veya artık kullanılmıyorsa sp_repldone çalıştırın.",
                ]
                remed_sql = f"-- Replikasyon durumunu inceleyiniz:\nEXEC sp_repltrans;\nGO"
            else:
                status = "WARNING"
                root_cause = f"Log kesilmesi şu nedenle bekletiliyor: {wait_desc}."
                impact = "Log dosyası büyüme riski."
                steps = [f"SQL Server belgelerinde '{wait_desc}' nedenini inceleyin."]
                remed_sql = f"-- {dbname}: Bekleme nedeni = {wait_desc}"

            log_reuse_waits.append(
                LogReuseWaitDetail(
                    database_name=dbname,
                    recovery_model=rec_model,
                    log_reuse_wait_desc=wait_desc,
                    log_size_mb=log_size,
                    log_used_percent=50.0,
                    status=status,
                    root_cause_explanation=root_cause,
                    impact_summary=impact,
                    remediation_steps=steps,
                    remediation_script=remed_sql,
                )
            )

        cursor.close()
        conn.close()

        dormant_cnt = sum(1 for t in transactions if t.is_dormant_active)
        max_dur = max((t.duration_seconds for t in transactions), default=0)
        longest_spid = next((t.session_id for t in transactions if t.duration_seconds == max_dur), None)
        tot_held = round(sum(t.log_bytes_used_mb for t in transactions), 2)

        return OpenTransactionsSummary(
            total_active_transactions=len(transactions),
            dormant_open_transactions_count=dormant_cnt,
            longest_running_duration_sec=max_dur,
            longest_running_spid=longest_spid,
            total_log_space_held_mb=tot_held,
            transactions=transactions,
            log_reuse_waits=log_reuse_waits,
            is_demo=False,
        )

    except Exception as exc:
        logger.error("Failed to query open transactions: %s", exc)
        return DEMO_OPEN_TRANSACTIONS_SUMMARY

