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
                DB_NAME(s.database_id)              AS db_name,
                s.status,
                s.cpu_time,
                s.reads,
                s.writes,
                s.logical_reads,
                s.memory_usage,
                r.command,
                r.wait_type,
                r.wait_time                         AS wait_time_ms,
                r.blocking_session_id,
                s.last_request_start_time,
                SUBSTRING(
                    ISNULL(CAST(t.text AS NVARCHAR(MAX)), ''), 1, 500
                )                                   AS sql_text
            FROM sys.dm_exec_sessions s
            LEFT JOIN sys.dm_exec_requests r
                   ON r.session_id = s.session_id
            OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t
            WHERE s.is_user_process = 1
              AND (? = 1 OR s.status != 'sleeping')
              AND ISNULL(r.wait_time, 0) >= ?
            ORDER BY ISNULL(r.wait_time, 0) DESC
            """,
            (1 if include_sleeping else 0, min_duration_ms),
        )
        rows = rows_to_dicts(cursor)
        return [
            SessionInfo(
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
            for r in rows
        ]


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

