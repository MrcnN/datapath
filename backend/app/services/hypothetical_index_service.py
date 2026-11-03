"""services/hypothetical_index_service.py — SQL Server What-If Hypothetical Index Simulator."""
from __future__ import annotations

import logging
import time
import xml.etree.ElementTree as ET
from typing import Optional, Tuple
import pyodbc

from app.db.connection import ConnectionParams, get_db_connection
from app.schemas.hypothetical_index import (
    HypotheticalSimulationRequest,
    HypotheticalSimulationResult,
)

logger = logging.getLogger(__name__)


def simulate_hypothetical_index(
    params: ConnectionParams, req: HypotheticalSimulationRequest
) -> HypotheticalSimulationResult:
    """Simulate Query Optimizer plan cost with a zero-disk hypothetical index using WITH STATISTICS_ONLY = -1."""
    db = req.database.strip()
    table = req.table_name.strip()
    keys = [k.strip() for k in req.key_columns if k.strip()]
    includes = [inc.strip() for inc in req.include_columns if inc.strip()]
    query = req.test_query.strip()

    keys_str = ", ".join([f"[{k}]" if not k.startswith("[") else k for k in keys])
    inc_clause = f" INCLUDE ({', '.join([f'[{c}]' if not c.startswith('[') else c for c in includes])})" if includes else ""
    table_clean = table.replace("[", "").replace("]", "").replace(".", "_")
    sim_idx_name = f"IX_HYPO_{table_clean}_{int(time.time())}"
    real_create_sql = f"CREATE NONCLUSTERED INDEX [IX_{table_clean}_{keys[0].replace('[','').replace(']','')}] ON [{db}].[dbo].[{table.replace('[','').replace(']','')}] ({keys_str}){inc_clause} WITH (ONLINE = ON, SORT_IN_TEMPDB = ON);"

    try:
        with get_db_connection(params) as conn:
            cursor = conn.cursor()
            if db:
                cursor.execute(f"USE [{db}];")

            # 1. Measure Baseline Query Cost without hypothetical index
            baseline_cost, op_before = _get_plan_cost_and_op(cursor, query)

            # 2. Create Hypothetical Index (Zero disk pages allocated)
            hypo_sql = f"CREATE NONCLUSTERED INDEX [{sim_idx_name}] ON [{table.replace('[','').replace(']','')}] ({keys_str}){inc_clause} WITH STATISTICS_ONLY = -1;"
            try:
                cursor.execute(hypo_sql)
            except Exception as e:
                logger.warning("Could not create hypothetical index with STATISTICS_ONLY: %s", e)

            # 3. Measure Estimated Cost with hypothetical index present in metadata
            try:
                # In SQL Server, Query Optimizer can evaluate hypothetical index via AUTOPILOT or query plan
                simulated_cost, op_after = _get_plan_cost_and_op(cursor, query)
            finally:
                # 4. ALWAYS Drop the hypothetical index immediately
                try:
                    cursor.execute(f"DROP INDEX [{sim_idx_name}] ON [{table.replace('[','').replace(']','')}];")
                except Exception:
                    pass

            # Calculate cost reduction
            if baseline_cost > 0 and simulated_cost < baseline_cost:
                reduction_pct = round(((baseline_cost - simulated_cost) / baseline_cost) * 100, 1)
                used_by_optimizer = True
                verdict = f"BAŞARILI: Sorgu maliyeti %{reduction_pct} oranında düştü. Sorgu iyileştirici önerilen sanal indeksi tercih etti ({op_before} -> {op_after})."
            elif simulated_cost == baseline_cost:
                reduction_pct = 0.0
                used_by_optimizer = False
                verdict = "NÖTR: Sorgu iyileştirici bu indeksi kullanmadı veya maliyette fark yaratmadı. Filtre kolon sırasını (Leading Key) veya INCLUDE kolonlarını gözden geçirin."
            else:
                reduction_pct = 0.0
                used_by_optimizer = False
                verdict = "DEĞİŞİKLİK YOK: Önerilen indeks yürütme planında birincil erişim yolu olarak seçilmedi."

            return HypotheticalSimulationResult(
                database=db,
                table_name=table,
                simulated_index_name=sim_idx_name,
                baseline_cost=round(baseline_cost, 4),
                simulated_cost=round(simulated_cost, 4),
                cost_reduction_pct=reduction_pct,
                index_used_by_optimizer=used_by_optimizer,
                operator_before=op_before,
                operator_after=op_after,
                verdict=verdict,
                real_create_index_tsql=real_create_sql,
                is_live=True,
            )

    except Exception as exc:
        logger.error("Hypothetical index simulation failed: %s", exc)
        return HypotheticalSimulationResult(
            database=db,
            table_name=table,
            simulated_index_name=sim_idx_name,
            baseline_cost=0.0,
            simulated_cost=0.0,
            cost_reduction_pct=0.0,
            index_used_by_optimizer=False,
            operator_before="N/A",
            operator_after="N/A",
            verdict=f"Simülasyon bağlantı veya izin nedeniyle çalıştırılamadı: {str(exc)}",
            real_create_index_tsql=real_create_sql,
            is_live=False,
        )


def _get_plan_cost_and_op(cursor: pyodbc.Cursor, query: str) -> Tuple[float, str]:
    """Execute query with SET SHOWPLAN_XML ON to extract SubTreeCost and root access operator."""
    cost = 1.0
    operator = "Table Scan"
    try:
        cursor.execute("SET SHOWPLAN_XML ON;")
        cursor.execute(query)
        rows = cursor.fetchall()
        cursor.execute("SET SHOWPLAN_XML OFF;")

        if rows and rows[0] and rows[0][0]:
            xml_text = str(rows[0][0])
            root = ET.fromstring(xml_text)
            # Find StmtSimple
            for elem in root.iter():
                if "StmtSimple" in elem.tag:
                    cost = float(elem.get("StatementSubTreeCost", "1.0"))
                if "RelOp" in elem.tag:
                    phys_op = elem.get("PhysicalOp", "")
                    if any(op in phys_op for op in ("Seek", "Scan", "Lookup")):
                        operator = phys_op
                        break
    except Exception as exc:
        logger.debug("Could not parse SHOWPLAN_XML: %s", exc)
        try:
            cursor.execute("SET SHOWPLAN_XML OFF;")
        except Exception:
            pass

    return cost, operator
