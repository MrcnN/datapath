"""services/execution_plan_service.py — SQL Server ShowPlanXML parser & operator tree builder."""
from __future__ import annotations

import logging
import xml.etree.ElementTree as ET
from typing import List, Optional, Tuple

from app.db.connection import ConnectionParams, get_db_connection
from app.schemas.execution_plan import (
    MissingIndexRecommendation,
    ParsedExecutionPlan,
    PlanOperatorNode,
)

logger = logging.getLogger(__name__)


def parse_execution_plan(
    plan_xml: Optional[str] = None,
    plan_handle: Optional[str] = None,
    params: Optional[ConnectionParams] = None,
) -> ParsedExecutionPlan:
    """Parse raw ShowPlanXML or fetch plan XML from sys.dm_exec_query_plan via plan_handle."""
    raw_xml = plan_xml

    if not raw_xml and plan_handle and params:
        try:
            with get_db_connection(params) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT query_plan FROM sys.dm_exec_query_plan(CONVERT(varbinary(64), ?, 1));",
                    plan_handle,
                )
                row = cursor.fetchone()
                if row and row[0]:
                    raw_xml = str(row[0])
        except Exception as exc:
            logger.warning("Could not fetch query plan from plan_handle: %s", exc)

    if not raw_xml or not raw_xml.strip():
        # Clean empty fallback
        return _empty_plan_result("No execution plan XML provided or available.")

    try:
        # Strip XML namespaces for uniform querying
        clean_xml = _strip_namespaces(raw_xml)
        root = ET.fromstring(clean_xml)

        # 1. Statement metadata
        stmt = root.find(".//StmtSimple")
        if stmt is None:
            stmt = root.find(".//StmtCond") or root.find(".//StmtCursor")

        query_text = stmt.get("StatementText", "SQL Statement") if stmt is not None else "SQL Statement"
        statement_type = stmt.get("StatementType", "SELECT") if stmt is not None else "SELECT"
        total_cost = float(stmt.get("StatementSubTreeCost", "1.0")) if stmt is not None else 1.0
        opt_level = stmt.get("StatementOptmLevel", "FULL") if stmt is not None else "FULL"

        qp = root.find(".//QueryPlan")
        compile_cpu = float(qp.get("CompileCPU", "0.0")) if qp is not None else 0.0
        compile_mem = float(qp.get("CompileMemory", "0.0")) if qp is not None else 0.0

        # 2. Missing Index Recommendation
        missing_index = _parse_missing_index(root)

        # 3. Root Operator (RelOp)
        root_relop = root.find(".//RelOp")
        if root_relop is not None:
            root_node = _parse_relop_node(root_relop, total_cost)
        else:
            root_node = None

        # Count total warnings across all nodes
        warnings_count = _count_node_warnings(root_node) if root_node else 0

        return ParsedExecutionPlan(
            query_text=query_text.strip(),
            statement_type=statement_type,
            total_cost=round(total_cost, 4),
            optimization_level=opt_level,
            compile_cpu_ms=round(compile_cpu, 2),
            compile_memory_kb=round(compile_mem, 1),
            has_warnings=warnings_count > 0,
            warnings_count=warnings_count,
            missing_index=missing_index,
            root_operator=root_node,
            is_live=True,
        )

    except Exception as exc:
        logger.error("Failed to parse execution plan XML: %s", exc)
        return _empty_plan_result(f"XML ayrıştırma hatası: {str(exc)}")


def _strip_namespaces(xml_str: str) -> str:
    """Remove xmlns default declarations to make tag lookups straightforward."""
    import re
    # Remove default namespace: xmlns="http://..."
    cleaned = re.sub(r'\sxmlns="[^"]+"', '', xml_str, count=1)
    # Remove prefix namespaces: xmlns:p="http://..."
    cleaned = re.sub(r'\sxmlns:\w+="[^"]+"', '', cleaned)
    return cleaned


def _parse_relop_node(relop_elem: ET.Element, total_query_cost: float) -> PlanOperatorNode:
    """Recursively parse a RelOp element and its child RelOp elements into a tree."""
    node_id = int(relop_elem.get("NodeId", 0))
    phys_op = relop_elem.get("PhysicalOp", "Unknown Op")
    log_op = relop_elem.get("LogicalOp", phys_op)
    est_rows = float(relop_elem.get("EstimateRows", "1.0"))
    est_io = float(relop_elem.get("EstimateIO", "0.0"))
    est_cpu = float(relop_elem.get("EstimateCPU", "0.0"))
    sub_cost = float(relop_elem.get("EstimatedTotalSubtreeCost", "0.0"))

    # Cost percentage calculation
    safe_total = max(0.0001, total_query_cost)
    cost_pct = round((sub_cost / safe_total) * 100, 1)
    is_expensive = cost_pct >= 25.0

    # Warnings
    warnings = []
    warn_elem = relop_elem.find("Warnings")
    if warn_elem is not None:
        if warn_elem.get("SpillToTempDb"):
            warnings.append(f"TempDB Taşması (SpillToTempDb: {warn_elem.get('SpillToTempDb')})")
        if warn_elem.find("PlanAffectingConvert") is not None:
            warnings.append("Örtük Tür Dönüşümü (Implicit Type Conversion) - İndeks aramasını engelliyor olabilir.")
        if warn_elem.find("ColumnsWithNoStatistics") is not None:
            warnings.append("İstatistiksiz Kolonlar Mevcut - Yanlış kardinalite tahmini riski.")
        if warn_elem.get("NoJoinPredicate"):
            warnings.append("Birleştirme Koşulu Eksik (Kartezyen Çarpım Riski)")
        if not warnings and len(warn_elem) > 0:
            warnings.append("Yürütme Planı Uyarısı Tespit Edildi")

    # Object name (Table / Index accessed)
    obj_elem = relop_elem.find(".//Object")
    object_name = None
    if obj_elem is not None:
        tbl = obj_elem.get("Table")
        idx = obj_elem.get("Index")
        if tbl and idx:
            object_name = f"{tbl}.{idx}"
        elif tbl:
            object_name = tbl
        elif idx:
            object_name = idx

    # Predicate
    predicate = None
    pred_elem = relop_elem.find(".//Predicate")
    if pred_elem is not None:
        predicate = ET.tostring(pred_elem, encoding="unicode", method="text").strip()
    else:
        seek_pred = relop_elem.find(".//SeekPredicates")
        if seek_pred is not None:
            predicate = ET.tostring(seek_pred, encoding="unicode", method="text").strip()

    # Output List
    output_list = []
    out_elem = relop_elem.find("OutputList")
    if out_elem is not None:
        for col_ref in out_elem.findall("ColumnReference"):
            c_name = col_ref.get("Column")
            if c_name:
                output_list.append(c_name)

    # Actual Rows & Cardinality Skew
    actual_rows = None
    cardinality_skew = None
    runtime_elem = relop_elem.find(".//RunTimeInformation/RunTimeCountersPerThread")
    if runtime_elem is not None:
        try:
            actual_rows = float(runtime_elem.get("ActualRows", "0"))
            if est_rows > 0:
                skew_ratio = actual_rows / est_rows
                if skew_ratio > 5.0 or skew_ratio < 0.2:
                    cardinality_skew = f"{actual_rows:,.0f} gerçek vs {est_rows:,.0f} tahmini ({skew_ratio:.1f}x sapma)"
                    warnings.append(f"Kardinalite Tahmin Sapması: {cardinality_skew}")
        except Exception:
            pass

    # Recursive Children RelOp elements
    # Children RelOps are inside the immediate operation element (e.g. Hash/NestedLoops/Filter)
    children = []
    for child in relop_elem:
        if child.tag != "OutputList" and child.tag != "Warnings":
            for grand in child:
                if grand.tag == "RelOp":
                    children.append(_parse_relop_node(grand, total_query_cost))
                # Some operations nest RelOp deeper (e.g. Action/ComputeScalar)
                for deep in grand.findall(".//RelOp"):
                    if deep not in [c for c in grand if c.tag == "RelOp"]:
                        # avoid re-adding
                        pass

    return PlanOperatorNode(
        node_id=node_id,
        physical_op=phys_op,
        logical_op=log_op,
        estimated_cost=round(sub_cost, 4),
        estimated_cost_percent=min(100.0, cost_pct),
        estimated_cpu_cost=round(est_cpu, 5),
        estimated_io_cost=round(est_io, 5),
        estimated_rows=round(est_rows, 1),
        actual_rows=round(actual_rows, 1) if actual_rows is not None else None,
        cardinality_skew=cardinality_skew,
        is_expensive=is_expensive,
        warnings=warnings,
        predicate=predicate if predicate else None,
        object_name=object_name,
        output_list=output_list[:8],
        children=children,
    )


def _parse_missing_index(root: ET.Element) -> Optional[MissingIndexRecommendation]:
    """Extract MissingIndexes group and construct CREATE INDEX statement."""
    mi_group = root.find(".//MissingIndexGroup")
    if mi_group is None:
        return None

    impact = float(mi_group.get("Impact", "0.0"))
    mi_elem = mi_group.find("MissingIndex")
    if mi_elem is None:
        return None

    tbl = mi_elem.get("Table", "UnknownTable")
    eq_cols = []
    ineq_cols = []
    inc_cols = []

    for col_group in mi_elem.findall("ColumnGroup"):
        usage = col_group.get("Usage")
        cols = [c.get("Name", "") for c in col_group.findall("Column")]
        cols = [c for c in cols if c]
        if usage == "EQUALITY":
            eq_cols.extend(cols)
        elif usage == "INEQUALITY":
            ineq_cols.extend(cols)
        elif usage == "INCLUDE":
            inc_cols.extend(cols)

    key_cols = eq_cols + ineq_cols
    key_str = ", ".join(key_cols) if key_cols else "[Column]"
    inc_str = f" INCLUDE ({', '.join(inc_cols)})" if inc_cols else ""
    tbl_clean = tbl.replace("[", "").replace("]", "").replace(".", "_")
    first_col = key_cols[0].replace("[", "").replace("]", "") if key_cols else "Key"
    idx_name = f"IX_{tbl_clean}_{first_col}"

    stmt = f"CREATE NONCLUSTERED INDEX [{idx_name}] ON {tbl} ({key_str}){inc_str};"

    return MissingIndexRecommendation(
        impact_percent=round(impact, 1),
        table_name=tbl,
        equality_columns=eq_cols,
        inequality_columns=ineq_cols,
        included_columns=inc_cols,
        create_statement=stmt,
    )


def _count_node_warnings(node: PlanOperatorNode) -> int:
    cnt = len(node.warnings)
    for ch in node.children:
        cnt += _count_node_warnings(ch)
    return cnt


def _empty_plan_result(msg: str) -> ParsedExecutionPlan:
    return ParsedExecutionPlan(
        query_text=msg,
        statement_type="N/A",
        total_cost=0.0,
        optimization_level="N/A",
        compile_cpu_ms=0.0,
        compile_memory_kb=0.0,
        has_warnings=False,
        warnings_count=0,
        missing_index=None,
        root_operator=None,
        is_live=False,
    )
