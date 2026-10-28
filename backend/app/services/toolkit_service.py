"""services/toolkit_service.py — Hardcoded DBA script library (20+ scripts)."""
from __future__ import annotations

from typing import List, Optional

from app.schemas.toolkit import DBAScript, ScriptCategory

_SCRIPTS: List[DBAScript] = [
    # ── Sessions ────────────────────────────────────────────────────────────
    DBAScript(
        id="sessions-001",
        name="Active User Sessions",
        category="Sessions",
        description="List all active user sessions with their current SQL text and wait info.",
        risk_level="read_only",
        tags=["sessions", "active", "wait"],
        min_sql_version="2008",
        sql="""
SELECT
    s.session_id,
    s.login_name,
    s.host_name,
    s.program_name,
    DB_NAME(s.database_id)  AS database_name,
    s.status,
    s.cpu_time,
    s.logical_reads,
    r.command,
    r.wait_type,
    r.wait_time             AS wait_ms,
    r.blocking_session_id,
    SUBSTRING(ISNULL(CAST(t.text AS NVARCHAR(MAX)),''), 1, 500) AS sql_text
FROM sys.dm_exec_sessions s
LEFT JOIN sys.dm_exec_requests r ON r.session_id = s.session_id
OUTER APPLY sys.dm_exec_sql_text(ISNULL(r.sql_handle, s.prev_error)) t
WHERE s.is_user_process = 1
ORDER BY s.cpu_time DESC;
""".strip(),
    ),
    DBAScript(
        id="sessions-002",
        name="Long-Running Queries (>30s)",
        category="Sessions",
        description="Find queries running longer than 30 seconds.",
        risk_level="read_only",
        tags=["sessions", "long-running", "performance"],
        min_sql_version="2008",
        sql="""
SELECT
    r.session_id,
    r.start_time,
    DATEDIFF(SECOND, r.start_time, GETDATE()) AS elapsed_sec,
    r.status,
    r.command,
    r.wait_type,
    r.wait_time,
    r.blocking_session_id,
    DB_NAME(r.database_id)  AS database_name,
    SUBSTRING(CAST(t.text AS NVARCHAR(MAX)), 1, 500) AS sql_text,
    qp.query_plan
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
OUTER APPLY sys.dm_exec_query_plan(r.plan_handle) qp
WHERE DATEDIFF(SECOND, r.start_time, GETDATE()) > 30
ORDER BY elapsed_sec DESC;
""".strip(),
    ),
    DBAScript(
        id="sessions-003",
        name="Open Transactions",
        category="Sessions",
        description="Sessions with open transactions and their age.",
        risk_level="read_only",
        tags=["sessions", "transactions", "locks"],
        min_sql_version="2008",
        sql="""
SELECT
    s.session_id,
    s.login_name,
    s.host_name,
    s.open_transaction_count,
    DATEDIFF(MINUTE, s.last_request_start_time, GETDATE()) AS idle_min,
    DB_NAME(s.database_id) AS database_name,
    SUBSTRING(ISNULL(CAST(t.text AS NVARCHAR(MAX)),''), 1, 500) AS last_sql
FROM sys.dm_exec_sessions s
OUTER APPLY sys.dm_exec_sql_text(s.prev_error) t
WHERE s.open_transaction_count > 0
  AND s.is_user_process = 1
ORDER BY s.open_transaction_count DESC, idle_min DESC;
""".strip(),
    ),
    # ── Blocking ────────────────────────────────────────────────────────────
    DBAScript(
        id="blocking-001",
        name="Current Blocking Chains",
        category="Blocking",
        description="Identify all blocking chains with blocker and blocked session details.",
        risk_level="read_only",
        tags=["blocking", "locks", "performance"],
        min_sql_version="2008",
        sql="""
WITH blockers AS (
    SELECT DISTINCT blocking_session_id AS session_id FROM sys.dm_exec_requests
    WHERE blocking_session_id > 0
)
SELECT
    b.session_id        AS blocker_session_id,
    bs.login_name       AS blocker_login,
    bs.host_name        AS blocker_host,
    r.session_id        AS blocked_session_id,
    r.wait_type,
    r.wait_time         AS wait_ms,
    DB_NAME(r.database_id) AS database_name,
    SUBSTRING(CAST(t.text AS NVARCHAR(MAX)),1,500) AS blocked_sql
FROM blockers b
JOIN sys.dm_exec_sessions bs ON bs.session_id = b.session_id
JOIN sys.dm_exec_requests r ON r.blocking_session_id = b.session_id
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
ORDER BY r.wait_time DESC;
""".strip(),
    ),
    DBAScript(
        id="blocking-002",
        name="Lock Wait Statistics",
        category="Blocking",
        description="Cumulative lock wait stats by wait type since last restart.",
        risk_level="read_only",
        tags=["blocking", "waits", "statistics"],
        min_sql_version="2008",
        sql="""
SELECT TOP 20
    wait_type,
    waiting_tasks_count,
    wait_time_ms,
    max_wait_time_ms,
    signal_wait_time_ms,
    wait_time_ms - signal_wait_time_ms AS resource_wait_ms
FROM sys.dm_os_wait_stats
WHERE wait_type NOT IN (
    'SLEEP_TASK','BROKER_TO_FLUSH','BROKER_TASK_STOP','CLR_AUTO_EVENT',
    'DISPATCHER_QUEUE_SEMAPHORE','FT_IFTS_SCHEDULER_IDLE_WAIT',
    'HADR_WORK_QUEUE','HADR_FILESTREAM_IOMGR_IOCOMPLETION',
    'LAZYWRITER_SLEEP','LOGMGR_QUEUE','ONDEMAND_TASK_QUEUE',
    'REQUEST_FOR_DEADLOCK_SEARCH','RESOURCE_QUEUE','SERVER_IDLE_CHECK',
    'SLEEP_DBSTARTUP','SLEEP_DCOMSTARTUP','SLEEP_MASTERDBREADY',
    'SLEEP_MASTERMDREADY','SLEEP_MASTERUPGRADED','SLEEP_MSDBSTARTUP',
    'SLEEP_TEMPDBSTARTUP','SNI_HTTP_ACCEPT','SP_SERVER_DIAGNOSTICS_SLEEP',
    'SQLTRACE_BUFFER_FLUSH','SQLTRACE_INCREMENTAL_FLUSH_SLEEP',
    'WAIT_XTP_OFFLINE_CKPT_NEW_LOG','WAITFOR','XE_DISPATCHER_WAIT',
    'XE_TIMER_EVENT','BROKER_EVENTHANDLER','CHECKPOINT_QUEUE',
    'DBMIRROR_EVENTS_QUEUE','SQLTRACE_WAIT_ENTRIES'
)
AND waiting_tasks_count > 0
ORDER BY wait_time_ms DESC;
""".strip(),
    ),
    # ── Index Analysis ──────────────────────────────────────────────────────
    DBAScript(
        id="index-001",
        name="Missing Index Suggestions",
        category="Index Analysis",
        description="Top missing indexes ranked by potential improvement impact.",
        risk_level="read_only",
        tags=["indexes", "missing", "performance", "tuning"],
        min_sql_version="2008",
        notes="Reset on SQL Server restart. Validate before adding indexes.",
        sql="""
SELECT TOP 25
    ROUND(s.avg_total_user_cost * s.avg_user_impact * (s.user_seeks + s.user_scans), 0)
                                    AS improvement_measure,
    d.statement                     AS table_name,
    d.equality_columns,
    d.inequality_columns,
    d.included_columns,
    s.user_seeks,
    s.user_scans,
    s.last_user_seek,
    s.last_user_scan,
    s.avg_total_user_cost,
    s.avg_user_impact
FROM sys.dm_db_missing_index_group_stats s
JOIN sys.dm_db_missing_index_groups g     ON g.index_group_handle = s.group_handle
JOIN sys.dm_db_missing_index_details d    ON d.index_handle       = g.index_handle
ORDER BY improvement_measure DESC;
""".strip(),
    ),
    DBAScript(
        id="index-002",
        name="Unused Indexes",
        category="Index Analysis",
        description="Indexes that have never been used for seeks/scans but still consume write overhead.",
        risk_level="caution",
        tags=["indexes", "unused", "maintenance"],
        min_sql_version="2008",
        notes="Data resets on restart. Cross-check with Query Store before dropping.",
        sql="""
SELECT
    OBJECT_NAME(i.object_id)       AS table_name,
    i.name                         AS index_name,
    i.type_desc,
    i.is_unique,
    i.is_primary_key,
    s.user_seeks,
    s.user_scans,
    s.user_lookups,
    s.user_updates,
    s.last_user_seek,
    s.last_user_scan
FROM sys.indexes i
LEFT JOIN sys.dm_db_index_usage_stats s
    ON s.object_id = i.object_id AND s.index_id = i.index_id
    AND s.database_id = DB_ID()
WHERE OBJECTPROPERTY(i.object_id, 'IsUserTable') = 1
  AND i.type > 0
  AND i.is_primary_key = 0
  AND i.is_unique_constraint = 0
  AND (s.user_seeks IS NULL OR s.user_seeks = 0)
  AND (s.user_scans IS NULL OR s.user_scans = 0)
  AND (s.user_lookups IS NULL OR s.user_lookups = 0)
ORDER BY ISNULL(s.user_updates, 0) DESC;
""".strip(),
    ),
    DBAScript(
        id="index-003",
        name="Index Fragmentation",
        category="Index Analysis",
        description="Check fragmentation for indexes with > 1000 pages.",
        risk_level="read_only",
        tags=["indexes", "fragmentation", "maintenance"],
        min_sql_version="2008",
        notes="Can be slow on large databases. Consider sampling mode (SAMPLED).",
        sql="""
SELECT
    DB_NAME()                       AS database_name,
    OBJECT_NAME(ps.object_id)       AS table_name,
    i.name                          AS index_name,
    ps.index_type_desc,
    ps.avg_fragmentation_in_percent AS frag_pct,
    ps.page_count,
    CASE
        WHEN ps.avg_fragmentation_in_percent < 10  THEN 'OK'
        WHEN ps.avg_fragmentation_in_percent < 30  THEN 'REORGANIZE'
        ELSE 'REBUILD'
    END                             AS recommendation
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'SAMPLED') ps
JOIN sys.indexes i ON i.object_id = ps.object_id AND i.index_id = ps.index_id
WHERE ps.page_count > 1000
  AND i.type > 0
ORDER BY ps.avg_fragmentation_in_percent DESC;
""".strip(),
    ),
    DBAScript(
        id="index-004",
        name="Duplicate Indexes",
        category="Index Analysis",
        description="Find indexes with identical leading key columns on the same table.",
        risk_level="caution",
        tags=["indexes", "duplicates", "optimization"],
        min_sql_version="2012",
        sql="""
WITH idx_cols AS (
    SELECT
        i.object_id,
        i.index_id,
        i.name,
        STRING_AGG(c.name, ',') WITHIN GROUP (ORDER BY ic.key_ordinal) AS key_cols
    FROM sys.indexes i
    JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
    JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    WHERE i.type > 0 AND ic.is_included_column = 0
    GROUP BY i.object_id, i.index_id, i.name
)
SELECT
    OBJECT_NAME(a.object_id)  AS table_name,
    a.name                    AS index_a,
    b.name                    AS index_b,
    a.key_cols
FROM idx_cols a
JOIN idx_cols b ON b.object_id = a.object_id AND b.key_cols = a.key_cols AND b.index_id > a.index_id
ORDER BY table_name, a.key_cols;
""".strip(),
    ),
    # ── Database Files ──────────────────────────────────────────────────────
    DBAScript(
        id="files-001",
        name="Database File Sizes & Autogrowth",
        category="Database Files",
        description="Data and log file sizes, free space, and autogrowth settings.",
        risk_level="read_only",
        tags=["files", "autogrowth", "space", "storage"],
        min_sql_version="2008",
        sql="""
SELECT
    DB_NAME(database_id)        AS database_name,
    name                        AS logical_name,
    physical_name,
    type_desc,
    CAST(size * 8.0 / 1024 AS DECIMAL(10,2))   AS size_mb,
    CASE max_size
        WHEN -1 THEN 'Unlimited'
        WHEN  0 THEN 'No growth'
        ELSE CAST(CAST(max_size * 8.0 / 1024 AS DECIMAL(10,2)) AS VARCHAR) + ' MB'
    END                         AS max_size,
    CASE is_percent_growth
        WHEN 1 THEN CAST(growth AS VARCHAR) + '%'
        ELSE CAST(CAST(growth * 8.0 / 1024 AS DECIMAL(10,2)) AS VARCHAR) + ' MB'
    END                         AS autogrowth,
    is_percent_growth
FROM sys.master_files
ORDER BY database_name, type_desc;
""".strip(),
    ),
    DBAScript(
        id="files-002",
        name="TempDB File Contention",
        category="Database Files",
        description="Check TempDB file allocation contention via wait stats.",
        risk_level="read_only",
        tags=["tempdb", "contention", "waits"],
        min_sql_version="2008",
        sql="""
SELECT
    wait_type,
    waiting_tasks_count,
    wait_time_ms,
    max_wait_time_ms
FROM sys.dm_os_wait_stats
WHERE wait_type IN ('PAGELATCH_UP','PAGELATCH_EX','PAGELATCH_SH',
                    'PAGEIOLATCH_UP','PAGEIOLATCH_EX','PAGEIOLATCH_SH')
ORDER BY wait_time_ms DESC;
""".strip(),
    ),
    # ── Backup ──────────────────────────────────────────────────────────────
    DBAScript(
        id="backup-001",
        name="Last Backup per Database",
        category="Backup",
        description="Most recent full, differential and log backup per database.",
        risk_level="read_only",
        tags=["backup", "recovery", "monitoring"],
        min_sql_version="2008",
        sql="""
SELECT
    d.name                                              AS database_name,
    d.recovery_model_desc                               AS recovery_model,
    MAX(CASE WHEN bs.type = 'D' THEN bs.backup_finish_date END) AS last_full,
    MAX(CASE WHEN bs.type = 'I' THEN bs.backup_finish_date END) AS last_diff,
    MAX(CASE WHEN bs.type = 'L' THEN bs.backup_finish_date END) AS last_log,
    DATEDIFF(HOUR,
        MAX(CASE WHEN bs.type='D' THEN bs.backup_finish_date END),
        GETDATE())                                      AS full_age_hours
FROM sys.databases d
LEFT JOIN msdb.dbo.backupset bs ON bs.database_name = d.name
WHERE d.database_id > 4
GROUP BY d.name, d.recovery_model_desc
ORDER BY full_age_hours DESC;
""".strip(),
    ),
    DBAScript(
        id="backup-002",
        name="Backup Size Trend (30 days)",
        category="Backup",
        description="Daily backup sizes grouped by database and type for the last 30 days.",
        risk_level="read_only",
        tags=["backup", "size", "trend"],
        min_sql_version="2008",
        sql="""
SELECT
    database_name,
    type                                                    AS backup_type,
    CAST(backup_start_date AS DATE)                         AS backup_date,
    CAST(SUM(backup_size) / 1073741824.0 AS DECIMAL(10,3)) AS total_size_gb,
    CAST(SUM(ISNULL(compressed_backup_size,0)) / 1073741824.0 AS DECIMAL(10,3)) AS compressed_gb,
    COUNT(1)                                                AS backup_count
FROM msdb.dbo.backupset
WHERE backup_start_date >= DATEADD(DAY, -30, GETDATE())
GROUP BY database_name, type, CAST(backup_start_date AS DATE)
ORDER BY backup_date DESC, database_name;
""".strip(),
    ),
    # ── Query Store ─────────────────────────────────────────────────────────
    DBAScript(
        id="qs-001",
        name="Query Store Status All Databases",
        category="Query Store",
        description="Query Store enabled/disabled state for all user databases.",
        risk_level="read_only",
        tags=["query store", "monitoring", "configuration"],
        min_sql_version="2016",
        sql="""
SELECT
    name                        AS database_name,
    is_query_store_on           AS qs_enabled,
    state_desc,
    compatibility_level
FROM sys.databases
WHERE database_id > 4
ORDER BY name;
""".strip(),
    ),
    DBAScript(
        id="qs-002",
        name="Top CPU Queries (Query Store)",
        category="Query Store",
        description="Top 25 queries by average CPU from Query Store. Run in target database context.",
        risk_level="read_only",
        tags=["query store", "cpu", "performance", "tuning"],
        min_sql_version="2016",
        sql="""
SELECT TOP 25
    q.query_id,
    SUBSTRING(qt.query_sql_text, 1, 300)            AS sql_snippet,
    p.plan_id,
    rs.count_executions,
    CAST(rs.avg_cpu_time   / 1000.0 AS DECIMAL(12,2)) AS avg_cpu_ms,
    CAST(rs.avg_duration   / 1000.0 AS DECIMAL(12,2)) AS avg_duration_ms,
    rs.avg_logical_io_reads,
    rsi.start_time                                   AS interval_start
FROM sys.query_store_query q
JOIN sys.query_store_query_text qt ON qt.query_text_id = q.query_text_id
JOIN sys.query_store_plan p        ON p.query_id = q.query_id
JOIN sys.query_store_runtime_stats rs ON rs.plan_id = p.plan_id
JOIN sys.query_store_runtime_stats_interval rsi
    ON rsi.runtime_stats_interval_id = rs.runtime_stats_interval_id
WHERE rsi.start_time >= DATEADD(HOUR, -24, GETUTCDATE())
ORDER BY rs.avg_cpu_time DESC;
""".strip(),
    ),
    # ── Error Log ───────────────────────────────────────────────────────────
    DBAScript(
        id="errorlog-001",
        name="Recent Errors (Error Log)",
        category="Error Log",
        description="Read last 500 lines of the SQL Server error log.",
        risk_level="read_only",
        tags=["error log", "monitoring", "diagnostics"],
        min_sql_version="2008",
        sql="""
EXEC xp_readerrorlog 0, 1, N'error';
""".strip(),
        notes="Requires VIEW SERVER STATE or sysadmin.",
    ),
    DBAScript(
        id="errorlog-002",
        name="SQL Server Restart History",
        category="Error Log",
        description="Detect server restarts from error log startup messages.",
        risk_level="read_only",
        tags=["error log", "restart", "uptime"],
        min_sql_version="2008",
        sql="""
EXEC xp_readerrorlog 0, 1, N'SQL Server is starting';
EXEC xp_readerrorlog 1, 1, N'SQL Server is starting';
EXEC xp_readerrorlog 2, 1, N'SQL Server is starting';
""".strip(),
    ),
    # ── Configuration ───────────────────────────────────────────────────────
    DBAScript(
        id="config-001",
        name="Server Configuration Settings",
        category="Configuration",
        description="All SQL Server sp_configure values with current and run-value.",
        risk_level="read_only",
        tags=["configuration", "settings", "sp_configure"],
        min_sql_version="2008",
        sql="""
SELECT
    name,
    minimum,
    maximum,
    value_in_use    AS current_value,
    value           AS configured_value,
    description
FROM sys.configurations
ORDER BY name;
""".strip(),
    ),
    DBAScript(
        id="config-002",
        name="Database Compatibility Levels",
        category="Configuration",
        description="List all databases with their compatibility levels and SQL Server version mapping.",
        risk_level="read_only",
        tags=["configuration", "compatibility", "version"],
        min_sql_version="2008",
        sql="""
SELECT
    name                    AS database_name,
    compatibility_level,
    CASE compatibility_level
        WHEN 160 THEN 'SQL Server 2022'
        WHEN 150 THEN 'SQL Server 2019'
        WHEN 140 THEN 'SQL Server 2017'
        WHEN 130 THEN 'SQL Server 2016'
        WHEN 120 THEN 'SQL Server 2014'
        WHEN 110 THEN 'SQL Server 2012'
        WHEN 100 THEN 'SQL Server 2008/R2'
        ELSE 'Unknown'
    END                     AS sql_version_equiv,
    state_desc,
    recovery_model_desc
FROM sys.databases
WHERE database_id > 4
ORDER BY name;
""".strip(),
    ),
    DBAScript(
        id="config-003",
        name="Max Memory & CPU Settings",
        category="Configuration",
        description="Quick overview of memory and CPU configuration.",
        risk_level="read_only",
        tags=["configuration", "memory", "cpu"],
        min_sql_version="2008",
        sql="""
SELECT
    (SELECT value_in_use FROM sys.configurations WHERE name = 'max server memory (MB)') AS max_server_memory_mb,
    (SELECT value_in_use FROM sys.configurations WHERE name = 'min server memory (MB)') AS min_server_memory_mb,
    (SELECT value_in_use FROM sys.configurations WHERE name = 'max degree of parallelism') AS maxdop,
    (SELECT value_in_use FROM sys.configurations WHERE name = 'cost threshold for parallelism') AS ctp,
    (SELECT physical_memory_kb FROM sys.dm_os_sys_info) / 1024.0 AS total_physical_memory_mb,
    (SELECT cpu_count FROM sys.dm_os_sys_info) AS logical_cpu_count,
    (SELECT hyperthread_ratio FROM sys.dm_os_sys_info) AS hyperthread_ratio;
""".strip(),
    ),
    DBAScript(
        id="config-004",
        name="Trace Flags Enabled",
        category="Configuration",
        description="Currently enabled global and session trace flags.",
        risk_level="read_only",
        tags=["configuration", "trace flags", "diagnostics"],
        min_sql_version="2008",
        sql="""
DBCC TRACESTATUS(-1) WITH NO_INFOMSGS;
""".strip(),
    ),
]


def get_all_scripts(search: str = "", category: str = "") -> List[DBAScript]:
    results = _SCRIPTS
    if category:
        results = [s for s in results if s.category.lower() == category.lower()]
    if search:
        search_lower = search.lower()
        results = [
            s for s in results
            if search_lower in s.name.lower()
            or search_lower in s.description.lower()
            or any(search_lower in tag.lower() for tag in s.tags)
            or search_lower in s.sql.lower()
        ]
    return results


def get_categories() -> List[ScriptCategory]:
    from collections import Counter
    counts = Counter(s.category for s in _SCRIPTS)
    category_descs = {
        "Sessions": "View active sessions, long-running queries, and open transactions.",
        "Blocking": "Identify blocking chains and analyze wait statistics.",
        "Index Analysis": "Find missing, unused, fragmented, or duplicate indexes.",
        "Database Files": "Inspect file sizes, autogrowth settings, and TempDB contention.",
        "Backup": "Review backup history, sizes, and recovery readiness.",
        "Query Store": "Analyze Query Store status and top expensive queries.",
        "Error Log": "Read and search SQL Server error log entries.",
        "Configuration": "Review SQL Server configuration settings.",
    }
    return [
        ScriptCategory(name=cat, description=category_descs.get(cat, ""), script_count=cnt)
        for cat, cnt in sorted(counts.items())
    ]
