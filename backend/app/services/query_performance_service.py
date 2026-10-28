"""services/query_performance_service.py — Query Store queries."""
from __future__ import annotations

import logging
from typing import List

import pyodbc

from app.core.exceptions import FeatureUnavailableError
from app.db.connection import ConnectionParams, get_db_connection, rows_to_dicts
from app.schemas.query_performance import (
    ExpensiveQuery,
    QueryStoreDatabaseInfo,
    QueryStoreOverview,
    RegressionResult,
)

logger = logging.getLogger(__name__)

_QS_STATE_MAP = {0: "Off", 1: "Read Write", 2: "Read Only", 3: "Error", 4: "Custom"}
_QS_CAPTURE_MAP = {1: "All", 2: "Auto", 3: "None", 4: "Custom"}


def get_query_store_overview(params: ConnectionParams) -> QueryStoreOverview:
    with get_db_connection(params) as conn:
        cursor = conn.cursor()
        # Which databases have Query Store?
        cursor.execute(
            """
            SELECT name, is_query_store_on
            FROM sys.databases
            WHERE is_query_store_on = 1
              AND state_desc = 'ONLINE'
              AND database_id > 4
            ORDER BY name
            """
        )
        qs_dbs = [
            QueryStoreDatabaseInfo(name=r[0], state="enabled")
            for r in cursor.fetchall()
        ]

        if not qs_dbs:
            return QueryStoreOverview(enabled=False, databases_with_qs=[])

        # Get QS config from first enabled db
        first_db = qs_dbs[0].name
        try:
            cursor.execute(
                f"""
                SELECT
                    actual_state,
                    actual_state_desc,
                    readonly_reason,
                    current_storage_size_mb,
                    max_storage_size_mb,
                    query_capture_mode,
                    query_capture_mode_desc,
                    max_plans_per_query
                FROM [{first_db}].sys.database_query_store_options
                """
            )
            row = rows_to_dicts(cursor)
            if row:
                r = row[0]
                return QueryStoreOverview(
                    enabled=True,
                    actual_state=r.get("actual_state_desc"),
                    readonly_reason=r.get("readonly_reason") if r.get("readonly_reason") else None,
                    current_storage_size_mb=float(r["current_storage_size_mb"]) if r.get("current_storage_size_mb") is not None else None,
                    max_storage_size_mb=float(r["max_storage_size_mb"]) if r.get("max_storage_size_mb") is not None else None,
                    query_capture_mode=r.get("query_capture_mode_desc"),
                    max_plans_per_query=r.get("max_plans_per_query"),
                    databases_with_qs=qs_dbs,
                )
        except pyodbc.Error as exc:
            logger.warning("Could not read QS options from '%s': %s", first_db, exc.args)

        return QueryStoreOverview(enabled=True, databases_with_qs=qs_dbs)


def get_expensive_queries(
    params: ConnectionParams,
    db_name: str,
    metric: str = "cpu_time",
    top_n: int = 25,
    time_range_hours: int = 24,
) -> List[ExpensiveQuery]:
    _metric_col_map = {
        "cpu_time": "avg_cpu_time",
        "duration": "avg_duration",
        "execution_count": "count_executions",
        "logical_reads": "avg_logical_io_reads",
    }
    order_col = _metric_col_map.get(metric, "avg_cpu_time")

    with get_db_connection(params) as conn:
        cursor = conn.cursor()

        # Verify QS is enabled in target DB
        cursor.execute(
            "SELECT is_query_store_on FROM sys.databases WHERE name = ?",
            (db_name,),
        )
        row = cursor.fetchone()
        if not row:
            raise FeatureUnavailableError(f"Database '{db_name}' not found.")
        if not row[0]:
            raise FeatureUnavailableError(f"Query Store is not enabled on database '{db_name}'.")

        cursor.execute(
            f"""
            SELECT TOP (?)
                q.query_id,
                CONVERT(VARCHAR(64), q.query_hash, 2)   AS query_hash,
                SUBSTRING(qt.query_sql_text, 1, 500)    AS query_text_snippet,
                p.plan_id,
                CAST(rs.avg_cpu_time / 1000.0 AS DECIMAL(18,3))           AS avg_cpu_ms,
                CAST(rs.avg_duration / 1000.0 AS DECIMAL(18,3))           AS avg_duration_ms,
                CAST(rs.avg_logical_io_reads AS DECIMAL(18,2))            AS avg_logical_reads,
                rs.count_executions                                        AS execution_count,
                CAST(rs.avg_cpu_time * rs.count_executions / 1000.0 AS DECIMAL(18,3)) AS total_cpu_ms,
                CONVERT(VARCHAR(33), rsi.start_time, 126)                  AS first_seen,
                CONVERT(VARCHAR(33), rsi.end_time, 126)                    AS last_seen
            FROM [{db_name}].sys.query_store_query q
            JOIN [{db_name}].sys.query_store_query_text qt
                ON qt.query_text_id = q.query_text_id
            JOIN [{db_name}].sys.query_store_plan p
                ON p.query_id = q.query_id
            JOIN [{db_name}].sys.query_store_runtime_stats rs
                ON rs.plan_id = p.plan_id
            JOIN [{db_name}].sys.query_store_runtime_stats_interval rsi
                ON rsi.runtime_stats_interval_id = rs.runtime_stats_interval_id
            WHERE rsi.start_time >= DATEADD(HOUR, -?, GETUTCDATE())
            ORDER BY rs.{order_col} DESC
            """,
            (top_n, time_range_hours),
        )
        rows = rows_to_dicts(cursor)
        return [
            ExpensiveQuery(
                query_id=r.get("query_id"),
                query_hash=r.get("query_hash"),
                query_text_snippet=r.get("query_text_snippet"),
                plan_id=r.get("plan_id"),
                avg_cpu_ms=float(r["avg_cpu_ms"]) if r.get("avg_cpu_ms") is not None else None,
                avg_duration_ms=float(r["avg_duration_ms"]) if r.get("avg_duration_ms") is not None else None,
                avg_logical_reads=float(r["avg_logical_reads"]) if r.get("avg_logical_reads") is not None else None,
                execution_count=r.get("execution_count"),
                total_cpu_ms=float(r["total_cpu_ms"]) if r.get("total_cpu_ms") is not None else None,
                first_seen=r.get("first_seen"),
                last_seen=r.get("last_seen"),
                is_regressed=False,
            )
            for r in rows
        ]


def get_regressions(
    params: ConnectionParams,
    db_name: str,
    window_hours: int = 24,
) -> List[RegressionResult]:
    """Compare last N hours vs previous N hours for regression detection."""
    with get_db_connection(params) as conn:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT is_query_store_on FROM sys.databases WHERE name = ?",
            (db_name,),
        )
        row = cursor.fetchone()
        if not row or not row[0]:
            raise FeatureUnavailableError(f"Query Store is not enabled on database '{db_name}'.")

        cursor.execute(
            f"""
            WITH recent AS (
                SELECT
                    q.query_id,
                    SUBSTRING(qt.query_sql_text, 1, 300) AS query_text_snippet,
                    AVG(rs.avg_cpu_time) / 1000.0        AS avg_cpu_ms,
                    AVG(rs.avg_duration) / 1000.0        AS avg_duration_ms,
                    SUM(rs.count_executions)             AS exec_count
                FROM [{db_name}].sys.query_store_query q
                JOIN [{db_name}].sys.query_store_query_text qt ON qt.query_text_id = q.query_text_id
                JOIN [{db_name}].sys.query_store_plan p ON p.query_id = q.query_id
                JOIN [{db_name}].sys.query_store_runtime_stats rs ON rs.plan_id = p.plan_id
                JOIN [{db_name}].sys.query_store_runtime_stats_interval rsi
                    ON rsi.runtime_stats_interval_id = rs.runtime_stats_interval_id
                WHERE rsi.start_time >= DATEADD(HOUR, -?, GETUTCDATE())
                GROUP BY q.query_id, qt.query_sql_text
            ),
            previous AS (
                SELECT
                    q.query_id,
                    AVG(rs.avg_cpu_time) / 1000.0   AS avg_cpu_ms,
                    AVG(rs.avg_duration) / 1000.0   AS avg_duration_ms,
                    SUM(rs.count_executions)         AS exec_count
                FROM [{db_name}].sys.query_store_query q
                JOIN [{db_name}].sys.query_store_plan p ON p.query_id = q.query_id
                JOIN [{db_name}].sys.query_store_runtime_stats rs ON rs.plan_id = p.plan_id
                JOIN [{db_name}].sys.query_store_runtime_stats_interval rsi
                    ON rsi.runtime_stats_interval_id = rs.runtime_stats_interval_id
                WHERE rsi.start_time >= DATEADD(HOUR, -?, GETUTCDATE())
                  AND rsi.start_time < DATEADD(HOUR, -?, GETUTCDATE())
                GROUP BY q.query_id
            )
            SELECT
                r.query_id,
                r.query_text_snippet,
                p.avg_cpu_ms             AS old_avg_cpu_ms,
                r.avg_cpu_ms             AS new_avg_cpu_ms,
                CASE WHEN p.avg_cpu_ms > 0
                     THEN (r.avg_cpu_ms - p.avg_cpu_ms) / p.avg_cpu_ms * 100.0
                     ELSE NULL END        AS cpu_delta_pct,
                p.avg_duration_ms        AS old_avg_duration_ms,
                r.avg_duration_ms        AS new_avg_duration_ms,
                CASE WHEN p.avg_duration_ms > 0
                     THEN (r.avg_duration_ms - p.avg_duration_ms) / p.avg_duration_ms * 100.0
                     ELSE NULL END        AS duration_delta_pct,
                p.exec_count             AS old_execution_count,
                r.exec_count             AS new_execution_count
            FROM recent r
            JOIN previous p ON p.query_id = r.query_id
            WHERE (r.avg_cpu_ms - p.avg_cpu_ms) / NULLIF(p.avg_cpu_ms, 0) * 100.0 > 20
               OR (r.avg_duration_ms - p.avg_duration_ms) / NULLIF(p.avg_duration_ms, 0) * 100.0 > 20
            ORDER BY cpu_delta_pct DESC
            """,
            (window_hours, window_hours * 2, window_hours),
        )
        rows = rows_to_dicts(cursor)
        return [
            RegressionResult(
                query_id=r.get("query_id"),
                query_text_snippet=r.get("query_text_snippet"),
                old_avg_cpu_ms=float(r["old_avg_cpu_ms"]) if r.get("old_avg_cpu_ms") is not None else None,
                new_avg_cpu_ms=float(r["new_avg_cpu_ms"]) if r.get("new_avg_cpu_ms") is not None else None,
                cpu_delta_pct=float(r["cpu_delta_pct"]) if r.get("cpu_delta_pct") is not None else None,
                old_avg_duration_ms=float(r["old_avg_duration_ms"]) if r.get("old_avg_duration_ms") is not None else None,
                new_avg_duration_ms=float(r["new_avg_duration_ms"]) if r.get("new_avg_duration_ms") is not None else None,
                duration_delta_pct=float(r["duration_delta_pct"]) if r.get("duration_delta_pct") is not None else None,
                old_execution_count=r.get("old_execution_count"),
                new_execution_count=r.get("new_execution_count"),
            )
            for r in rows
        ]
