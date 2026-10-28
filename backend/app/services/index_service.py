"""services/index_service.py — Missing indexes, unused indexes, and fragmentation analysis."""
from __future__ import annotations

import logging
from typing import List, Optional

from app.db.connection import ConnectionParams, get_db_connection, rows_to_dicts
from app.schemas.indexes import (
    IndexFragmentation,
    IndexSummary,
    MissingIndex,
    TableStatistic,
    UnusedIndex,
)
from app.services.demo_data import (
    DEMO_INDEX_FRAGMENTATION,
    DEMO_INDEX_SUMMARY,
    DEMO_MISSING_INDEXES,
    DEMO_TABLE_STATISTICS,
    DEMO_UNUSED_INDEXES,
)

logger = logging.getLogger(__name__)


def get_missing_indexes(
    params: ConnectionParams, database: Optional[str] = None
) -> List[MissingIndex]:
    """Retrieve top missing index recommendations from SQL Server DMVs."""
    try:
        with get_db_connection(params) as conn:
            cursor = conn.cursor()
            target_db = database or params.database or "master"
            
            # Switch database context if specified
            if target_db:
                cursor.execute(f"USE [{target_db}];")

            query = """
            SELECT TOP 50
                DB_NAME(d.database_id) AS database_name,
                ISNULL(s.name, 'dbo') AS schema_name,
                ISNULL(t.name, 'UnknownTable') AS table_name,
                ROUND(s_stat.avg_total_user_cost * s_stat.avg_user_impact * (s_stat.user_seeks + s_stat.user_scans), 2) AS impact_score,
                s_stat.user_seeks,
                s_stat.user_scans,
                ROUND(s_stat.avg_total_user_cost, 2) AS avg_total_user_cost,
                ROUND(s_stat.avg_user_impact, 2) AS avg_user_impact,
                d.equality_columns,
                d.inequality_columns,
                d.included_columns
            FROM sys.dm_db_missing_index_details d
            INNER JOIN sys.dm_db_missing_index_groups g ON d.index_handle = g.index_handle
            INNER JOIN sys.dm_db_missing_index_group_stats s_stat ON g.index_group_handle = s_stat.group_handle
            LEFT JOIN sys.tables t ON d.object_id = t.object_id
            LEFT JOIN sys.schemas s ON t.schema_id = s.schema_id
            WHERE d.database_id = DB_ID()
            ORDER BY impact_score DESC;
            """
            cursor.execute(query)
            rows = rows_to_dicts(cursor)

            if not rows:
                return []

            results = []
            for r in rows:
                tbl = r.get("table_name", "Table")
                eq = r.get("equality_columns") or ""
                ineq = r.get("inequality_columns") or ""
                inc = r.get("included_columns")
                
                # Format clean index name
                clean_cols = (eq or ineq).replace("[", "").replace("]", "").replace(", ", "_")
                suggested_name = f"IX_{tbl}_{clean_cols}"[:60]
                
                key_cols = [c for c in [eq, ineq] if c]
                key_cols_str = ", ".join(key_cols)
                inc_str = f" INCLUDE ({inc})" if inc else ""
                create_stmt = f"CREATE NONCLUSTERED INDEX [{suggested_name}] ON [{r.get('schema_name', 'dbo')}].[{tbl}] ({key_cols_str}){inc_str} WITH (ONLINE = ON);"

                results.append(
                    MissingIndex(
                        database_name=r.get("database_name") or target_db,
                        schema_name=r.get("schema_name", "dbo"),
                        table_name=tbl,
                        impact_score=float(r.get("impact_score") or 0.0),
                        user_seeks=int(r.get("user_seeks") or 0),
                        user_scans=int(r.get("user_scans") or 0),
                        avg_total_user_cost=float(r.get("avg_total_user_cost") or 0.0),
                        avg_user_impact=float(r.get("avg_user_impact") or 0.0),
                        equality_columns=r.get("equality_columns"),
                        inequality_columns=r.get("inequality_columns"),
                        included_columns=r.get("included_columns"),
                        suggested_index_name=suggested_name,
                        create_statement=create_stmt,
                    )
                )
            return results
    except Exception as exc:
        logger.warning("Could not fetch live missing indexes, falling back to demo data: %s", exc)
        return DEMO_MISSING_INDEXES


def get_unused_indexes(
    params: ConnectionParams, database: Optional[str] = None
) -> List[UnusedIndex]:
    """Retrieve indexes with heavy writes (updates) but zero reads (seeks/scans/lookups)."""
    try:
        with get_db_connection(params) as conn:
            cursor = conn.cursor()
            target_db = database or params.database or "master"
            if target_db:
                cursor.execute(f"USE [{target_db}];")

            query = """
            SELECT TOP 50
                DB_NAME() AS database_name,
                s.name AS schema_name,
                t.name AS table_name,
                i.name AS index_name,
                i.type_desc AS index_type,
                ROUND(SUM(ps.used_page_count) * 8.0 / 1024.0, 2) AS size_mb,
                ISNULL(us.user_seeks, 0) AS user_seeks,
                ISNULL(us.user_scans, 0) AS user_scans,
                ISNULL(us.user_lookups, 0) AS user_lookups,
                ISNULL(us.user_updates, 0) AS user_updates
            FROM sys.indexes i
            INNER JOIN sys.tables t ON i.object_id = t.object_id
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
            LEFT JOIN sys.dm_db_partition_stats ps ON i.object_id = ps.object_id AND i.index_id = ps.index_id
            LEFT JOIN sys.dm_db_index_usage_stats us ON i.object_id = us.object_id AND i.index_id = us.index_id AND us.database_id = DB_ID()
            WHERE i.type_desc = 'NONCLUSTERED'
              AND i.is_primary_key = 0
              AND i.is_unique_constraint = 0
              AND t.is_ms_shipped = 0
              AND ISNULL(us.user_seeks, 0) = 0
              AND ISNULL(us.user_scans, 0) = 0
              AND ISNULL(us.user_lookups, 0) = 0
              AND ISNULL(us.user_updates, 0) > 0
            GROUP BY s.name, t.name, i.name, i.type_desc, us.user_seeks, us.user_scans, us.user_lookups, us.user_updates
            ORDER BY us.user_updates DESC, size_mb DESC;
            """
            cursor.execute(query)
            rows = rows_to_dicts(cursor)

            if not rows:
                return []

            results = []
            for r in rows:
                sch = r.get("schema_name", "dbo")
                tbl = r.get("table_name", "")
                idx = r.get("index_name", "")
                reads = int(r.get("user_seeks", 0)) + int(r.get("user_scans", 0)) + int(r.get("user_lookups", 0))
                writes = int(r.get("user_updates", 0))
                
                results.append(
                    UnusedIndex(
                        database_name=r.get("database_name") or target_db,
                        schema_name=sch,
                        table_name=tbl,
                        index_name=idx,
                        index_type=r.get("index_type", "NONCLUSTERED"),
                        size_mb=float(r.get("size_mb") or 0.0),
                        user_seeks=int(r.get("user_seeks") or 0),
                        user_scans=int(r.get("user_scans") or 0),
                        user_lookups=int(r.get("user_lookups") or 0),
                        user_updates=writes,
                        read_writes_ratio=f"{reads} / {writes}",
                        drop_statement=f"DROP INDEX [{idx}] ON [{sch}].[{tbl}];",
                    )
                )
            return results
    except Exception as exc:
        logger.warning("Could not fetch live unused indexes, falling back to demo data: %s", exc)
        return DEMO_UNUSED_INDEXES


def get_index_fragmentation(
    params: ConnectionParams, database: Optional[str] = None
) -> List[IndexFragmentation]:
    """Retrieve index fragmentation metrics and rebuild/reorganize recommendations."""
    try:
        with get_db_connection(params) as conn:
            cursor = conn.cursor()
            target_db = database or params.database or "master"
            if target_db:
                cursor.execute(f"USE [{target_db}];")

            query = """
            SELECT TOP 50
                DB_NAME() AS database_name,
                s.name AS schema_name,
                t.name AS table_name,
                i.name AS index_name,
                i.type_desc AS index_type,
                ROUND(ips.avg_fragmentation_in_percent, 2) AS avg_fragmentation_percent,
                ips.page_count,
                ROUND(ips.page_count * 8.0 / 1024.0, 2) AS size_mb
            FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
            INNER JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
            INNER JOIN sys.tables t ON i.object_id = t.object_id
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
            WHERE ips.page_count > 10
              AND i.name IS NOT NULL
            ORDER BY avg_fragmentation_percent DESC;
            """
            cursor.execute(query)
            rows = rows_to_dicts(cursor)

            if not rows:
                return []

            results = []
            for r in rows:
                frag = float(r.get("avg_fragmentation_percent") or 0.0)
                sch = r.get("schema_name", "dbo")
                tbl = r.get("table_name", "")
                idx = r.get("index_name", "")

                if frag >= 30.0:
                    action = "REBUILD"
                    stmt = f"ALTER INDEX [{idx}] ON [{sch}].[{tbl}] REBUILD WITH (ONLINE = ON);"
                elif frag >= 10.0:
                    action = "REORGANIZE"
                    stmt = f"ALTER INDEX [{idx}] ON [{sch}].[{tbl}] REORGANIZE;"
                else:
                    action = "HEALTHY"
                    stmt = f"-- Index [{idx}] is healthy ({frag}% fragmentation). No action required."

                results.append(
                    IndexFragmentation(
                        database_name=r.get("database_name") or target_db,
                        schema_name=sch,
                        table_name=tbl,
                        index_name=idx,
                        index_type=r.get("index_type", "NONCLUSTERED"),
                        avg_fragmentation_percent=frag,
                        page_count=int(r.get("page_count") or 0),
                        size_mb=float(r.get("size_mb") or 0.0),
                        recommended_action=action,
                        maintenance_statement=stmt,
                    )
                )
            return results
    except Exception as exc:
        logger.warning("Could not fetch live index fragmentation, falling back to demo data: %s", exc)
        return DEMO_INDEX_FRAGMENTATION


def get_table_statistics(
    params: ConnectionParams, database: Optional[str] = None
) -> List[TableStatistic]:
    """Analyze table statistics staleness and modification counters via sys.dm_db_stats_properties."""
    try:
        with get_db_connection(params) as conn:
            cursor = conn.cursor()
            target_db = database or params.database or "master"
            if target_db:
                cursor.execute(f"USE [{target_db}];")

            query = """
            SELECT TOP 50
                DB_NAME() AS database_name,
                s.name AS schema_name,
                o.name AS table_name,
                st.name AS stats_name,
                CONVERT(VARCHAR(19), sp.last_updated, 120) AS last_updated,
                ISNULL(sp.rows, 0) AS rows_total,
                ISNULL(sp.rows_sampled, 0) AS rows_sampled,
                ISNULL(sp.modification_counter, 0) AS modification_counter,
                CAST(ROUND(CASE WHEN ISNULL(sp.rows, 0) > 0 
                    THEN (ISNULL(sp.modification_counter, 0) * 100.0) / sp.rows 
                    ELSE 0.0 END, 2) AS FLOAT) AS staleness_percent
            FROM sys.stats st
            CROSS APPLY sys.dm_db_stats_properties(st.object_id, st.stats_id) sp
            JOIN sys.objects o ON o.object_id = st.object_id
            JOIN sys.schemas s ON s.schema_id = o.schema_id
            WHERE o.type = 'U' AND o.is_ms_shipped = 0
            ORDER BY staleness_percent DESC, modification_counter DESC;
            """
            cursor.execute(query)
            rows = rows_to_dicts(cursor)

            results: List[TableStatistic] = []
            for r in rows:
                stale_pct = float(r.get("staleness_percent", 0.0) or 0.0)
                if stale_pct >= 20.0:
                    status_val = "STALE"
                elif stale_pct >= 10.0:
                    status_val = "WARNING"
                else:
                    status_val = "FRESH"

                schema = r.get("schema_name", "dbo")
                table = r.get("table_name", "")
                stat = r.get("stats_name", "")
                update_sql = f"UPDATE STATISTICS [{schema}].[{table}] [{stat}] WITH RESAMPLE;"

                results.append(
                    TableStatistic(
                        database_name=r.get("database_name", target_db),
                        schema_name=schema,
                        table_name=table,
                        stats_name=stat,
                        last_updated=str(r.get("last_updated", "")),
                        rows_total=int(r.get("rows_total", 0) or 0),
                        rows_sampled=int(r.get("rows_sampled", 0) or 0),
                        modification_counter=int(r.get("modification_counter", 0) or 0),
                        staleness_percent=stale_pct,
                        status=status_val,
                        update_statement=update_sql,
                    )
                )
            return results
    except Exception as exc:
        logger.warning("Could not fetch live table statistics, falling back to demo data: %s", exc)
        return DEMO_TABLE_STATISTICS


def get_index_summary(
    params: ConnectionParams, database: Optional[str] = None
) -> IndexSummary:
    """Calculate overall KPI summary for Index Intelligence dashboard."""
    missing = get_missing_indexes(params, database)
    unused = get_unused_indexes(params, database)
    fragmentation = get_index_fragmentation(params, database)
    stats = get_table_statistics(params, database)

    # Determine if fallback demo data was used
    is_demo = missing == DEMO_MISSING_INDEXES

    max_impact = max([m.impact_score for m in missing], default=0.0)
    wasted_mb = sum([u.size_mb for u in unused])
    fragmented_count = len([f for f in fragmentation if f.recommended_action in ("REBUILD", "REORGANIZE")])
    stale_count = len([s for s in stats if s.status in ("STALE", "WARNING")])

    return IndexSummary(
        total_missing_indexes=len(missing),
        max_impact_score=max_impact,
        total_unused_indexes=len(unused),
        total_wasted_mb=round(wasted_mb, 2),
        fragmented_indexes_count=fragmented_count,
        stale_statistics_count=stale_count,
        is_demo=is_demo,
    )
