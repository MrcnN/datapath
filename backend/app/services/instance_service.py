"""services/instance_service.py — SQL Server instance metadata, sessions, blocking."""
from __future__ import annotations

import logging
from typing import List, Optional

import pyodbc

from app.core.exceptions import DatabaseConnectionError, PermissionDeniedError
from app.db.connection import ConnectionParams, get_db_connection, rows_to_dicts
from app.schemas.instances import (
    BlockedSession,
    BlockingChain,
    BlockingResponse,
    DatabaseInfo,
    ServerMetadata,
    SessionInfo,
    ConfigurationItem,
    ServerConfigurationSummary,
    LiveProcessSummary,
)

logger = logging.getLogger(__name__)


def get_server_metadata(params: ConnectionParams) -> ServerMetadata:
    with get_db_connection(params) as conn:
        cursor = conn.cursor()

        # Core server properties
        cursor.execute(
            """
            SELECT
                CAST(SERVERPROPERTY('ServerName')     AS NVARCHAR(256)) AS server_name,
                CAST(SERVERPROPERTY('ProductVersion') AS NVARCHAR(128)) AS product_version,
                CAST(SERVERPROPERTY('ProductLevel')   AS NVARCHAR(128)) AS product_level,
                CAST(SERVERPROPERTY('Edition')        AS NVARCHAR(256)) AS edition,
                CAST(SERVERPROPERTY('Collation')      AS NVARCHAR(256)) AS collation,
                @@VERSION                                               AS version,
                (SELECT CAST(value_in_use AS FLOAT)
                   FROM sys.configurations
                  WHERE name = 'max server memory (MB)') / 1024.0      AS max_memory_gb,
                (SELECT CAST(physical_memory_kb AS FLOAT)
                   FROM sys.dm_os_sys_info) / 1048576.0                AS memory_gb,
                (SELECT cpu_count
                   FROM sys.dm_os_sys_info)                            AS cpu_count
            """
        )
        row = rows_to_dicts(cursor)[0]

        # SQL Agent running status (graceful failure)
        sql_agent_running: Optional[bool] = None
        try:
            cursor.execute(
                """
                SELECT COUNT(1) AS cnt
                  FROM sys.dm_server_services
                 WHERE servicename LIKE 'SQL Server Agent%'
                   AND status_desc = 'Running'
                """
            )
            agent_row = cursor.fetchone()
            sql_agent_running = (agent_row[0] > 0) if agent_row else None
        except pyodbc.Error:
            pass  # view may be restricted

        # Database list
        cursor.execute(
            """
            SELECT
                d.name,
                d.state_desc                                          AS state,
                d.recovery_model_desc                                 AS recovery_model,
                CAST(SUM(CASE WHEN mf.type = 0 THEN mf.size END) * 8.0 / 1024 AS DECIMAL(18,2)) AS size_mb,
                CAST(SUM(CASE WHEN mf.type = 1 THEN mf.size END) * 8.0 / 1024 AS DECIMAL(18,2)) AS log_size_mb,
                d.compatibility_level,
                d.is_read_only,
                d.create_date
            FROM sys.databases d
            LEFT JOIN sys.master_files mf ON mf.database_id = d.database_id
            GROUP BY d.name, d.state_desc, d.recovery_model_desc,
                     d.compatibility_level, d.is_read_only, d.create_date
            ORDER BY d.name
            """
        )
        db_rows = rows_to_dicts(cursor)
        databases = [
            DatabaseInfo(
                name=r["name"],
                state=r.get("state"),
                recovery_model=r.get("recovery_model"),
                size_mb=float(r["size_mb"]) if r.get("size_mb") is not None else None,
                log_size_mb=float(r["log_size_mb"]) if r.get("log_size_mb") is not None else None,
                compatibility_level=r.get("compatibility_level"),
                is_read_only=r.get("is_read_only"),
                create_date=r.get("create_date"),
            )
            for r in db_rows
        ]

        return ServerMetadata(
            server_name=row.get("server_name"),
            version=row.get("version"),
            edition=row.get("edition"),
            product_level=row.get("product_level"),
            product_version=row.get("product_version"),
            collation=row.get("collation"),
            cpu_count=row.get("cpu_count"),
            memory_gb=float(row["memory_gb"]) if row.get("memory_gb") is not None else None,
            max_memory_gb=float(row["max_memory_gb"]) if row.get("max_memory_gb") is not None else None,
            sql_agent_running=sql_agent_running,
            databases=databases,
        )


def get_sessions(
    params: ConnectionParams,
    include_sleeping: bool = False,
    min_duration_ms: int = 0,
) -> List[SessionInfo]:
    with get_db_connection(params) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                s.session_id,
                s.login_name,
                s.host_name,
                s.program_name,
                DB_NAME(COALESCE(r.database_id, s.database_id)) AS db_name,
                s.status,
                s.cpu_time,
                s.reads,
                s.writes,
                s.logical_reads,
                s.memory_usage,
                r.command,
                r.wait_type,
                r.wait_time                         AS wait_time_ms,
                ISNULL(r.blocking_session_id, 0)    AS blocking_session_id,
                s.last_request_start_time,
                ISNULL(r.total_elapsed_time, DATEDIFF(millisecond, s.last_request_start_time, GETDATE())) AS elapsed_time_ms,
                s.open_transaction_count,
                CASE s.transaction_isolation_level
                    WHEN 0 THEN 'Unspecified'
                    WHEN 1 THEN 'ReadUncommitted'
                    WHEN 2 THEN 'ReadCommitted'
                    WHEN 3 THEN 'RepeatableRead'
                    WHEN 4 THEN 'Serializable'
                    WHEN 5 THEN 'Snapshot'
                    ELSE 'ReadCommitted'
                END                                 AS transaction_isolation_level,
                CAST(ROUND((ISNULL(ssu.user_objects_alloc_page_count, 0) + ISNULL(ssu.internal_objects_alloc_page_count, 0)) * 8.0 / 1024.0, 2) AS FLOAT) AS tempdb_allocations_mb,
                CAST(ROUND(ISNULL(mg.granted_memory_kb, 0) / 1024.0, 2) AS FLOAT) AS memory_grant_mb,
                SUBSTRING(
                    ISNULL(CAST(t.text AS NVARCHAR(MAX)), ''), 1, 1000
                )                                   AS sql_text,
                SUBSTRING(
                    ISNULL(CAST(t.text AS NVARCHAR(MAX)), ''),
                    (ISNULL(r.statement_start_offset, 0)/2) + 1,
                    ((CASE WHEN r.statement_end_offset = -1 OR r.statement_end_offset IS NULL
                           THEN DATALENGTH(ISNULL(CAST(t.text AS NVARCHAR(MAX)), ''))
                           ELSE r.statement_end_offset END - ISNULL(r.statement_start_offset, 0))/2) + 1
                )                                   AS current_statement
            FROM sys.dm_exec_sessions s
            LEFT JOIN sys.dm_exec_requests r
                   ON r.session_id = s.session_id
            OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t
            LEFT JOIN sys.dm_db_session_space_usage ssu ON ssu.session_id = s.session_id
            LEFT JOIN sys.dm_exec_query_memory_grants mg ON mg.session_id = s.session_id AND mg.request_id = r.request_id
            WHERE s.is_user_process = 1
              AND (? = 1 OR s.status != 'sleeping')
              AND ISNULL(r.wait_time, 0) >= ?
            ORDER BY ISNULL(r.total_elapsed_time, 0) DESC, ISNULL(r.wait_time, 0) DESC;
            """,
            (1 if include_sleeping else 0, min_duration_ms),
        )
        rows = rows_to_dicts(cursor)

        blocked_counts: dict[int, int] = {}
        for r in rows:
            bid = r.get("blocking_session_id") or 0
            if bid > 0:
                blocked_counts[bid] = blocked_counts.get(bid, 0) + 1

        sessions: List[SessionInfo] = []
        for r in rows:
            sid = r["session_id"]
            bid = r.get("blocking_session_id") or 0
            blocks_others = blocked_counts.get(sid, 0)
            is_root = blocks_others > 0 and bid == 0
            stmt = r.get("current_statement") or r.get("sql_text")

            sessions.append(
                SessionInfo(
                    session_id=sid,
                    login_name=r.get("login_name"),
                    host_name=r.get("host_name"),
                    program_name=r.get("program_name"),
                    db_name=r.get("db_name"),
                    status=r.get("status"),
                    cpu_time=r.get("cpu_time"),
                    reads=r.get("reads"),
                    writes=r.get("writes"),
                    logical_reads=r.get("logical_reads"),
                    memory_usage=r.get("memory_usage"),
                    command=r.get("command"),
                    wait_type=r.get("wait_type"),
                    wait_time_ms=r.get("wait_time_ms"),
                    blocking_session_id=bid,
                    last_request_start_time=r.get("last_request_start_time"),
                    sql_text=r.get("sql_text"),
                    elapsed_time_ms=int(r.get("elapsed_time_ms") or 0),
                    current_statement=stmt,
                    tempdb_allocations_mb=float(r.get("tempdb_allocations_mb") or 0.0),
                    memory_grant_mb=float(r.get("memory_grant_mb") or 0.0),
                    open_transaction_count=int(r.get("open_transaction_count") or 0),
                    transaction_isolation_level=r.get("transaction_isolation_level") or "ReadCommitted",
                    is_root_blocker=is_root,
                    blocked_session_count=blocks_others,
                    kill_statement=f"KILL {sid};",
                )
            )
        return sessions


def get_live_process_summary(
    params: ConnectionParams,
    active_only: bool = True,
    min_duration_ms: int = 0,
) -> LiveProcessSummary:
    """Retrieve summarized real-time active sessions with KPI aggregates for the Live Process Explorer."""
    try:
        sessions = get_sessions(params, include_sleeping=not active_only, min_duration_ms=min_duration_ms)
        running = len([s for s in sessions if s.status == "running"])
        blocked = len([s for s in sessions if s.blocking_session_id and s.blocking_session_id > 0])
        root_blockers = len([s for s in sessions if s.is_root_blocker])
        total_tempdb = round(sum([s.tempdb_allocations_mb or 0.0 for s in sessions]), 1)
        total_mem = round(sum([s.memory_grant_mb or 0.0 for s in sessions]), 1)

        return LiveProcessSummary(
            total_active_sessions=len(sessions),
            running_sessions=running,
            blocked_sessions=blocked,
            root_blockers_count=root_blockers,
            total_tempdb_mb=total_tempdb,
            total_memory_grant_mb=total_mem,
            sessions=sessions,
            is_demo=False,
        )
    except Exception as exc:
        logger.warning("Could not fetch live process summary, falling back to demo data: %s", exc)
        from app.services.demo_data import DEMO_LIVE_PROCESS_SUMMARY
        return DEMO_LIVE_PROCESS_SUMMARY


def get_blocking(params: ConnectionParams) -> BlockingResponse:
    with get_db_connection(params) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            WITH blocking AS (
                SELECT DISTINCT blocking_session_id AS blocker_id
                FROM sys.dm_exec_requests
                WHERE blocking_session_id > 0
            )
            SELECT
                r.blocking_session_id               AS blocker_id,
                s.session_id                        AS blocked_id,
                s.login_name                        AS blocked_login,
                s.host_name                         AS blocked_host,
                DB_NAME(s.database_id)              AS blocked_db,
                r.wait_type,
                r.wait_time                         AS wait_time_ms,
                SUBSTRING(
                    ISNULL(CAST(t.text AS NVARCHAR(MAX)), ''), 1, 500
                )                                   AS sql_text
            FROM sys.dm_exec_requests r
            JOIN sys.dm_exec_sessions s ON s.session_id = r.session_id
            OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t
            WHERE r.blocking_session_id > 0
            ORDER BY r.blocking_session_id, r.wait_time DESC
            """
        )
        blocked_rows = rows_to_dicts(cursor)

        if not blocked_rows:
            return BlockingResponse(has_blocking=False, chains=[])

        # Fetch blocker session info
        blocker_ids = list({r["blocker_id"] for r in blocked_rows})
        # Build parameterized IN clause
        placeholders = ",".join(["?"] * len(blocker_ids))
        cursor.execute(
            f"""
            SELECT
                s.session_id,
                s.login_name,
                s.host_name,
                s.program_name,
                DB_NAME(s.database_id) AS db_name,
                s.status,
                s.cpu_time, s.reads, s.writes, s.logical_reads, s.memory_usage,
                r.command, r.wait_type,
                r.wait_time AS wait_time_ms,
                r.blocking_session_id,
                s.last_request_start_time,
                SUBSTRING(ISNULL(CAST(t.text AS NVARCHAR(MAX)),''),1,500) AS sql_text
            FROM sys.dm_exec_sessions s
            LEFT JOIN sys.dm_exec_requests r ON r.session_id = s.session_id
            OUTER APPLY sys.dm_exec_sql_text(ISNULL(r.sql_handle, s.prev_error)) t
            WHERE s.session_id IN ({placeholders})
            """,
            blocker_ids,
        )
        blocker_map: dict = {}
        for r in rows_to_dicts(cursor):
            blocker_map[r["session_id"]] = SessionInfo(
                session_id=r["session_id"],
                login_name=r.get("login_name"),
                host_name=r.get("host_name"),
                program_name=r.get("program_name"),
                db_name=r.get("db_name"),
                status=r.get("status"),
                cpu_time=r.get("cpu_time"),
                reads=r.get("reads"),
                writes=r.get("writes"),
                logical_reads=r.get("logical_reads"),
                memory_usage=r.get("memory_usage"),
                command=r.get("command"),
                wait_type=r.get("wait_type"),
                wait_time_ms=r.get("wait_time_ms"),
                blocking_session_id=r.get("blocking_session_id"),
                last_request_start_time=r.get("last_request_start_time"),
                sql_text=r.get("sql_text"),
            )

        # Group blocked sessions by blocker
        chains_map: dict = {}
        for r in blocked_rows:
            bid = r["blocker_id"]
            if bid not in chains_map:
                chains_map[bid] = []
            chains_map[bid].append(
                BlockedSession(
                    session_id=r["blocked_id"],
                    login_name=r.get("blocked_login"),
                    host_name=r.get("blocked_host"),
                    db_name=r.get("blocked_db"),
                    wait_type=r.get("wait_type"),
                    wait_time_ms=r.get("wait_time_ms"),
                    sql_text=r.get("sql_text"),
                )
            )

        chains = []
        for blocker_id, blocked_list in chains_map.items():
            blocker_session = blocker_map.get(blocker_id)
            if blocker_session is None:
                blocker_session = SessionInfo(session_id=blocker_id)
            chains.append(
                BlockingChain(
                    blocker=blocker_session,
                    blocked=blocked_list,
                    wait_type=blocked_list[0].wait_type if blocked_list else None,
                    wait_duration_ms=max((b.wait_time_ms or 0) for b in blocked_list),
                )
            )

        return BlockingResponse(has_blocking=True, chains=chains)


def get_databases(params: ConnectionParams) -> List[DatabaseInfo]:
    with get_db_connection(params) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                d.name,
                d.state_desc                                          AS state,
                d.recovery_model_desc                                 AS recovery_model,
                CAST(SUM(CASE WHEN mf.type = 0 THEN mf.size END) * 8.0 / 1024 AS DECIMAL(18,2)) AS size_mb,
                CAST(SUM(CASE WHEN mf.type = 1 THEN mf.size END) * 8.0 / 1024 AS DECIMAL(18,2)) AS log_size_mb,
                d.compatibility_level,
                d.is_read_only,
                d.create_date
            FROM sys.databases d
            LEFT JOIN sys.master_files mf ON mf.database_id = d.database_id
            GROUP BY d.name, d.state_desc, d.recovery_model_desc,
                     d.compatibility_level, d.is_read_only, d.create_date
            ORDER BY d.name
            """
        )
        db_rows = rows_to_dicts(cursor)
        return [
            DatabaseInfo(
                name=r["name"],
                state=r.get("state"),
                recovery_model=r.get("recovery_model"),
                size_mb=float(r["size_mb"]) if r.get("size_mb") is not None else None,
                log_size_mb=float(r["log_size_mb"]) if r.get("log_size_mb") is not None else None,
                compatibility_level=r.get("compatibility_level"),
                is_read_only=r.get("is_read_only"),
                create_date=r.get("create_date"),
            )
            for r in db_rows
        ]


def get_server_configurations(params: ConnectionParams) -> ServerConfigurationSummary:
    """Retrieve SQL Server sp_configure settings and audit them against DBA best practices."""
    try:
        with get_db_connection(params) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT 
                    (SELECT CAST(physical_memory_kb AS FLOAT) / 1048576.0 FROM sys.dm_os_sys_info) AS ram_gb, 
                    (SELECT cpu_count FROM sys.dm_os_sys_info) AS cpu_cnt
                """
            )
            sys_info = cursor.fetchone()
            total_ram_gb = round(sys_info[0], 1) if sys_info and sys_info[0] else 16.0
            cpu_cores = int(sys_info[1]) if sys_info and sys_info[1] else 4
            recommended_max_mem_mb = max(2048, int((total_ram_gb - max(4.0, total_ram_gb * 0.12)) * 1024))
            recommended_maxdop = min(8, cpu_cores)

            cursor.execute(
                """
                SELECT
                    configuration_id,
                    name,
                    description,
                    CAST(value AS INT) AS value,
                    CAST(value_in_use AS INT) AS value_in_use,
                    is_dynamic,
                    is_advanced
                FROM sys.configurations
                WHERE name IN (
                    'max server memory (MB)',
                    'cost threshold for parallelism',
                    'max degree of parallelism',
                    'optimize for ad hoc workloads',
                    'backup compression default',
                    'remote admin connections',
                    'xp_cmdshell',
                    'clr enabled'
                )
                ORDER BY name
                """
            )
            rows = cursor.fetchall()

            items: List[ConfigurationItem] = []
            optimal_count = 0
            warning_count = 0
            critical_count = 0
            remediation_lines: List[str] = [
                "-- ================================================================",
                "-- Datapath - SQL Server Instance Best Practice Remediation Script",
                "-- NOT: Lütfen production ortamına uygulamadan önce gözden geçiriniz.",
                "-- ================================================================",
                "",
                "USE master;",
                "GO",
                "EXEC sp_configure 'show advanced options', 1;",
                "RECONFIGURE WITH OVERRIDE;",
                "GO",
                "",
            ]

            for r in rows:
                cfg_id = r[0]
                name = r[1]
                desc = r[2] or ""
                val = r[3]
                val_use = r[4]
                is_dyn = bool(r[5])
                is_adv = bool(r[6])

                status = "OPTIMAL"
                rec_val = None
                impact = "Mevcut ayar önerilen en iyi uygulamalarla uyumludur."
                rem_sql = None

                if name == "max server memory (MB)":
                    if val_use >= 2147483640:
                        status = "CRITICAL"
                        rec_val = f"{recommended_max_mem_mb} MB (Mevcut RAM: {total_ram_gb} GB)"
                        impact = "Varsayılan 2.1 TB değeri bırakılmıştır. SQL Server işletim sistemi için bellek ayırmayarak OS paging ve sunucu kilitlenmelerine sebep olabilir."
                        rem_sql = f"EXEC sp_configure 'max server memory (MB)', {recommended_max_mem_mb};\nRECONFIGURE WITH OVERRIDE;"
                        remediation_lines.append(f"-- 1. Max Server Memory: {recommended_max_mem_mb} MB tahsis\n{rem_sql}\nGO\n")
                        critical_count += 1
                    else:
                        rec_val = f"{recommended_max_mem_mb} MB"
                        optimal_count += 1

                elif name == "cost threshold for parallelism":
                    if val_use <= 5:
                        status = "WARNING"
                        rec_val = "50"
                        impact = "Varsayılan 5 değeri 1990'lı yıllardan kalmadır. Küçük OLTP sorguları dahi paralel yürütülerek CPU ve CXPACKET beklemesi üretir."
                        rem_sql = "EXEC sp_configure 'cost threshold for parallelism', 50;\nRECONFIGURE WITH OVERRIDE;"
                        remediation_lines.append(f"-- 2. Cost Threshold for Parallelism: 50\n{rem_sql}\nGO\n")
                        warning_count += 1
                    else:
                        rec_val = "30 - 50"
                        optimal_count += 1

                elif name == "max degree of parallelism":
                    if val_use == 0:
                        status = "WARNING"
                        rec_val = f"{recommended_maxdop} ({cpu_cores} Çekirdek için)"
                        impact = "MAXDOP 0 (sınırsız) olarak ayarlanmış. Tek bir sorgu tüm CPU çekirdeklerini rezerve ederek CXPACKET beklemesi üretebilir."
                        rem_sql = f"EXEC sp_configure 'max degree of parallelism', {recommended_maxdop};\nRECONFIGURE WITH OVERRIDE;"
                        remediation_lines.append(f"-- 3. MAXDOP: {recommended_maxdop}\n{rem_sql}\nGO\n")
                        warning_count += 1
                    else:
                        rec_val = str(recommended_maxdop)
                        optimal_count += 1

                elif name == "optimize for ad hoc workloads":
                    if val_use == 0:
                        status = "WARNING"
                        rec_val = "1"
                        impact = "Kapalı (0). Tek seferlik sorgular yürütme planı önbelleğini şişirerek (Plan Cache Bloat) değerli RAM alanını tüketmektedir."
                        rem_sql = "EXEC sp_configure 'optimize for ad hoc workloads', 1;\nRECONFIGURE WITH OVERRIDE;"
                        remediation_lines.append(f"-- 4. Optimize for Ad hoc Workloads: 1\n{rem_sql}\nGO\n")
                        warning_count += 1
                    else:
                        rec_val = "1"
                        optimal_count += 1

                elif name == "backup compression default":
                    if val_use == 0:
                        status = "INFO"
                        rec_val = "1"
                        impact = "Varsayılan yedekleme sıkıştırması kapalı. Yedekler diskte 3-4 kat daha fazla yer kaplar ve I/O süresini uzatır."
                        rem_sql = "EXEC sp_configure 'backup compression default', 1;\nRECONFIGURE WITH OVERRIDE;"
                        remediation_lines.append(f"-- 5. Backup Compression: 1\n{rem_sql}\nGO\n")
                        warning_count += 1
                    else:
                        rec_val = "1"
                        optimal_count += 1

                elif name == "remote admin connections":
                    if val_use == 0:
                        status = "WARNING"
                        rec_val = "1"
                        impact = "Dedicated Administrator Connection (DAC) kapalı. Sunucu %100 CPU veya bellek kilitlenmesi yaşadığında uzaktan DBA bağlantısı kurulamaz."
                        rem_sql = "EXEC sp_configure 'remote admin connections', 1;\nRECONFIGURE WITH OVERRIDE;"
                        remediation_lines.append(f"-- 6. Remote Admin Connections: 1\n{rem_sql}\nGO\n")
                        warning_count += 1
                    else:
                        rec_val = "1"
                        optimal_count += 1

                elif name == "xp_cmdshell":
                    if val_use == 1:
                        status = "WARNING"
                        rec_val = "0"
                        impact = "İşletim sistemi komut satırı yetkisi açık. Güvenlik yüzeyi genişletilmiştir."
                        rem_sql = "EXEC sp_configure 'xp_cmdshell', 0;\nRECONFIGURE WITH OVERRIDE;"
                        remediation_lines.append(f"-- 7. xp_cmdshell: 0 (Kapat)\n{rem_sql}\nGO\n")
                        warning_count += 1
                    else:
                        rec_val = "0"
                        optimal_count += 1

                elif name == "clr enabled":
                    rec_val = "0"
                    optimal_count += 1

                items.append(
                    ConfigurationItem(
                        configuration_id=cfg_id,
                        name=name,
                        description=desc,
                        value=val,
                        value_in_use=val_use,
                        recommended_value=rec_val,
                        is_dynamic=is_dyn,
                        is_advanced=is_adv,
                        status=status,
                        impact_description=impact,
                        remediation_sql=rem_sql,
                    )
                )

            total = len(items)
            score = int((optimal_count / total * 100)) if total > 0 else 100
            remediation_lines.append("PRINT 'Tüm yapılandırmalar başarıyla uygulandı.';\nGO\n")

            return ServerConfigurationSummary(
                compliance_score=score,
                total_configurations=total,
                optimal_count=optimal_count,
                warning_count=warning_count,
                critical_count=critical_count,
                items=items,
                remediation_script="\n".join(remediation_lines),
                is_demo=False,
            )
    except Exception as exc:
        logger.warning("Live server configurations unavailable (%s), returning demo data.", exc)
        from app.services.demo_data import DEMO_SERVER_CONFIGURATIONS
        return DEMO_SERVER_CONFIGURATIONS


