"""services/schema_diff_service.py — Compare two SQL Server database schemas."""
from __future__ import annotations

import logging
from typing import Dict, List, Optional, Tuple

import pyodbc

from app.db.connection import ConnectionParams, get_db_connection, rows_to_dicts
from app.schemas.schema_diff import (
    DiffDetail,
    DiffSummary,
    SchemaDiffEntry,
    SchemaDiffRequest,
    SchemaDiffResponse,
)

logger = logging.getLogger(__name__)


def _fetch_columns(cursor: pyodbc.Cursor, db_name: str) -> Dict[str, list]:
    """Return {table_name: [col_info_dict, ...]} for a database."""
    cursor.execute(
        f"""
        SELECT
            c.TABLE_SCHEMA + '.' + c.TABLE_NAME   AS table_fqn,
            c.COLUMN_NAME,
            c.DATA_TYPE,
            c.CHARACTER_MAXIMUM_LENGTH,
            c.NUMERIC_PRECISION,
            c.NUMERIC_SCALE,
            c.IS_NULLABLE,
            c.COLUMN_DEFAULT,
            c.ORDINAL_POSITION
        FROM [{db_name}].INFORMATION_SCHEMA.COLUMNS c
        JOIN [{db_name}].INFORMATION_SCHEMA.TABLES t
            ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
        WHERE t.TABLE_TYPE = 'BASE TABLE'
        ORDER BY table_fqn, c.ORDINAL_POSITION
        """
    )
    result: Dict[str, list] = {}
    for r in rows_to_dicts(cursor):
        tbl = r["table_fqn"]
        result.setdefault(tbl, []).append(r)
    return result


def _fetch_views(cursor: pyodbc.Cursor, db_name: str) -> Dict[str, str]:
    """Return {view_fqn: view_definition}."""
    cursor.execute(
        f"""
        SELECT
            s.name + '.' + o.name  AS view_fqn,
            sm.definition
        FROM [{db_name}].sys.objects o
        JOIN [{db_name}].sys.schemas s ON s.schema_id = o.schema_id
        JOIN [{db_name}].sys.sql_modules sm ON sm.object_id = o.object_id
        WHERE o.type = 'V'
        ORDER BY view_fqn
        """
    )
    return {r["view_fqn"]: r.get("definition", "") or "" for r in rows_to_dicts(cursor)}


def _fetch_procedures(cursor: pyodbc.Cursor, db_name: str) -> Dict[str, str]:
    cursor.execute(
        f"""
        SELECT
            s.name + '.' + o.name  AS proc_fqn,
            sm.definition
        FROM [{db_name}].sys.objects o
        JOIN [{db_name}].sys.schemas s ON s.schema_id = o.schema_id
        JOIN [{db_name}].sys.sql_modules sm ON sm.object_id = o.object_id
        WHERE o.type IN ('P', 'PC')
        ORDER BY proc_fqn
        """
    )
    return {r["proc_fqn"]: r.get("definition", "") or "" for r in rows_to_dicts(cursor)}


def _fetch_indexes(cursor: pyodbc.Cursor, db_name: str) -> Dict[str, dict]:
    """Return {schema.table.index_name: index_info}."""
    cursor.execute(
        f"""
        SELECT
            s.name + '.' + t.name + '.' + i.name   AS index_fqn,
            i.type_desc,
            i.is_unique,
            i.is_primary_key,
            i.filter_definition,
            STRING_AGG(c.name, ',') WITHIN GROUP (ORDER BY ic.key_ordinal) AS key_columns
        FROM [{db_name}].sys.indexes i
        JOIN [{db_name}].sys.objects t ON t.object_id = i.object_id
        JOIN [{db_name}].sys.schemas s ON s.schema_id = t.schema_id
        JOIN [{db_name}].sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        JOIN [{db_name}].sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE t.type = 'U' AND i.type > 0 AND ic.is_included_column = 0
        GROUP BY s.name, t.name, i.name, i.type_desc, i.is_unique, i.is_primary_key, i.filter_definition
        ORDER BY index_fqn
        """
    )
    return {r["index_fqn"]: r for r in rows_to_dicts(cursor)}


def _col_signature(col: dict) -> str:
    """Build a comparable string from column metadata."""
    return (
        f"{col['DATA_TYPE']}"
        f"({col.get('CHARACTER_MAXIMUM_LENGTH') or col.get('NUMERIC_PRECISION') or ''},"
        f"{col.get('NUMERIC_SCALE') or ''})"
        f" NULL={col.get('IS_NULLABLE')} DEF={col.get('COLUMN_DEFAULT')}"
    )


def compare_schemas(params: ConnectionParams, req: SchemaDiffRequest) -> SchemaDiffResponse:
    src = req.source_db
    tgt = req.target_db
    differences: List[SchemaDiffEntry] = []
    summary = DiffSummary()

    with get_db_connection(params) as conn:
        cursor = conn.cursor()

        # --- Tables & Columns ---
        if req.include_tables:
            src_cols = _fetch_columns(cursor, src)
            tgt_cols = _fetch_columns(cursor, tgt)

            src_tables = set(src_cols.keys())
            tgt_tables = set(tgt_cols.keys())

            for tbl in sorted(src_tables - tgt_tables):
                differences.append(SchemaDiffEntry(object_type="TABLE", object_name=tbl, change_type="removed"))
                summary.tables_removed += 1

            for tbl in sorted(tgt_tables - src_tables):
                differences.append(SchemaDiffEntry(object_type="TABLE", object_name=tbl, change_type="added"))
                summary.tables_added += 1

            for tbl in sorted(src_tables & tgt_tables):
                src_col_map = {c["COLUMN_NAME"]: c for c in src_cols[tbl]}
                tgt_col_map = {c["COLUMN_NAME"]: c for c in tgt_cols[tbl]}
                col_diffs: List[DiffDetail] = []

                for col_name in sorted(set(src_col_map) - set(tgt_col_map)):
                    col_diffs.append(DiffDetail(field=f"column:{col_name}", source_value="exists", target_value=None))
                    summary.columns_changed += 1

                for col_name in sorted(set(tgt_col_map) - set(src_col_map)):
                    col_diffs.append(DiffDetail(field=f"column:{col_name}", source_value=None, target_value="exists"))
                    summary.columns_changed += 1

                for col_name in sorted(set(src_col_map) & set(tgt_col_map)):
                    s_sig = _col_signature(src_col_map[col_name])
                    t_sig = _col_signature(tgt_col_map[col_name])
                    if s_sig != t_sig:
                        col_diffs.append(
                            DiffDetail(field=f"column:{col_name}", source_value=s_sig, target_value=t_sig)
                        )
                        summary.columns_changed += 1

                if col_diffs:
                    differences.append(
                        SchemaDiffEntry(object_type="TABLE", object_name=tbl, change_type="modified", details=col_diffs)
                    )
                    summary.tables_modified += 1

        # --- Views ---
        if req.include_views:
            src_views = _fetch_views(cursor, src)
            tgt_views = _fetch_views(cursor, tgt)

            for v in sorted(set(src_views) - set(tgt_views)):
                differences.append(
                    SchemaDiffEntry(object_type="VIEW", object_name=v, change_type="removed", source_definition=src_views[v])
                )
                summary.views_removed += 1

            for v in sorted(set(tgt_views) - set(src_views)):
                differences.append(
                    SchemaDiffEntry(object_type="VIEW", object_name=v, change_type="added", target_definition=tgt_views[v])
                )
                summary.views_added += 1

            for v in sorted(set(src_views) & set(tgt_views)):
                if src_views[v] != tgt_views[v]:
                    differences.append(
                        SchemaDiffEntry(
                            object_type="VIEW",
                            object_name=v,
                            change_type="modified",
                            source_definition=src_views[v],
                            target_definition=tgt_views[v],
                        )
                    )
                    summary.views_modified += 1

        # --- Stored Procedures ---
        if req.include_procedures:
            src_procs = _fetch_procedures(cursor, src)
            tgt_procs = _fetch_procedures(cursor, tgt)

            for p in sorted(set(src_procs) - set(tgt_procs)):
                differences.append(
                    SchemaDiffEntry(object_type="PROCEDURE", object_name=p, change_type="removed", source_definition=src_procs[p])
                )
                summary.procedures_removed += 1

            for p in sorted(set(tgt_procs) - set(src_procs)):
                differences.append(
                    SchemaDiffEntry(object_type="PROCEDURE", object_name=p, change_type="added", target_definition=tgt_procs[p])
                )
                summary.procedures_added += 1

            for p in sorted(set(src_procs) & set(tgt_procs)):
                if src_procs[p] != tgt_procs[p]:
                    differences.append(
                        SchemaDiffEntry(
                            object_type="PROCEDURE",
                            object_name=p,
                            change_type="modified",
                            source_definition=src_procs[p],
                            target_definition=tgt_procs[p],
                        )
                    )
                    summary.procedures_modified += 1

        # --- Indexes ---
        if req.include_indexes:
            src_idx = _fetch_indexes(cursor, src)
            tgt_idx = _fetch_indexes(cursor, tgt)

            for idx in sorted(set(src_idx) - set(tgt_idx)):
                differences.append(SchemaDiffEntry(object_type="INDEX", object_name=idx, change_type="removed"))
                summary.indexes_changed += 1

            for idx in sorted(set(tgt_idx) - set(src_idx)):
                differences.append(SchemaDiffEntry(object_type="INDEX", object_name=idx, change_type="added"))
                summary.indexes_changed += 1

            for idx in sorted(set(src_idx) & set(tgt_idx)):
                s = src_idx[idx]
                t = tgt_idx[idx]
                idx_diffs: List[DiffDetail] = []
                for field in ("type_desc", "is_unique", "is_primary_key", "key_columns", "filter_definition"):
                    if s.get(field) != t.get(field):
                        idx_diffs.append(DiffDetail(field=field, source_value=s.get(field), target_value=t.get(field)))
                if idx_diffs:
                    differences.append(
                        SchemaDiffEntry(object_type="INDEX", object_name=idx, change_type="modified", details=idx_diffs)
                    )
                    summary.indexes_changed += 1

    # Build migration script (informational only — never executed)
    script_lines = [
        f"-- Traceforge Schema Diff: [{src}] → [{tgt}]",
        f"-- Generated: {__import__('datetime').datetime.utcnow().isoformat()}Z",
        "-- WARNING: Review carefully before executing. This script is NOT automatically applied.",
        "",
    ]
    for diff in differences:
        script_lines.append(f"-- {diff.change_type.upper()} {diff.object_type}: {diff.object_name}")
        if diff.change_type == "added" and diff.target_definition:
            script_lines.append(diff.target_definition)
            script_lines.append("GO")
        elif diff.change_type == "removed":
            otype = diff.object_type
            if otype == "TABLE":
                script_lines.append(f"-- DROP TABLE {diff.object_name};  -- Verify before executing!")
            elif otype == "VIEW":
                script_lines.append(f"DROP VIEW {diff.object_name};")
                script_lines.append("GO")
            elif otype == "PROCEDURE":
                script_lines.append(f"DROP PROCEDURE {diff.object_name};")
                script_lines.append("GO")
            elif otype == "INDEX":
                parts = diff.object_name.split(".")
                script_lines.append(f"-- DROP INDEX [{parts[-1]}] ON [{'.'.join(parts[:-1])}];")
        script_lines.append("")

    return SchemaDiffResponse(
        summary=summary,
        differences=differences,
        generated_script="\n".join(script_lines),
    )


def list_databases(params: ConnectionParams) -> List[str]:
    """Return list of online user databases for schema comparison selection."""
    with get_db_connection(params) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT name FROM sys.databases
            WHERE state_desc = 'ONLINE' AND database_id > 4
            ORDER BY name
            """
        )
        return [row[0] for row in cursor.fetchall()]
