"""services/memory_grants_service.py — Memory Grant Starvation & Resource Semaphore Studio."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import List, Optional

from app.db.connection import get_connection, ConnectionParams, rows_to_dicts
from app.schemas.memory_grants import (
    ResourceSemaphoreStatus,
    LiveMemoryGrantItem,
    HistoricalMemoryWasterItem,
    MemoryGrantSummary,
    MemoryGrantResponse,
)

logger = logging.getLogger(__name__)


def get_memory_grants_analysis(params: ConnectionParams) -> MemoryGrantResponse:
    """Collects real-time query execution memory semaphores, active/queued memory grants,
    and historical memory grant wasters / spills from the plan cache.
    """
    server_name = params.server or "SQL-INSTANCE"
    semaphores: List[ResourceSemaphoreStatus] = []
    live_grants: List[LiveMemoryGrantItem] = []
    historical_wasters: List[HistoricalMemoryWasterItem] = []

    try:
        with get_connection(params) as conn:
            cursor = conn.cursor()

            # 0. Get Server Name
            try:
                cursor.execute("SELECT @@SERVERNAME;")
                row = cursor.fetchone()
                if row and row[0]:
                    server_name = str(row[0])
            except Exception:
                pass

            # 1. Resource Semaphores
            cursor.execute("""
            SELECT 
                resource_semaphore_id AS semaphore_id,
                ROUND(CAST(total_memory_kb AS FLOAT) / 1024.0, 2) AS total_memory_mb,
                ROUND(CAST(available_memory_kb AS FLOAT) / 1024.0, 2) AS available_memory_mb,
                ROUND(CAST(granted_memory_kb AS FLOAT) / 1024.0, 2) AS granted_memory_mb,
                ROUND(CAST(used_memory_kb AS FLOAT) / 1024.0, 2) AS used_memory_mb,
                grantee_count,
                waiter_count,
                ISNULL(timeout_error_count, 0) AS timeout_error_count,
                ISNULL(forced_grant_count, 0) AS forced_grant_count
            FROM sys.dm_exec_query_resource_semaphores;
            """)
            raw_semaphores = rows_to_dicts(cursor)
            for s in raw_semaphores:
                tot_mb = float(s.get("total_memory_mb") or 0.0)
                grt_mb = float(s.get("granted_memory_mb") or 0.0)
                util = round((grt_mb / max(0.001, tot_mb)) * 100.0, 1) if tot_mb > 0 else 0.0

                semaphores.append(
                    ResourceSemaphoreStatus(
                        semaphore_id=int(s.get("semaphore_id") or 0),
                        total_memory_mb=tot_mb,
                        available_memory_mb=float(s.get("available_memory_mb") or 0.0),
                        granted_memory_mb=grt_mb,
                        used_memory_mb=float(s.get("used_memory_mb") or 0.0),
                        grantee_count=int(s.get("grantee_count") or 0),
                        waiter_count=int(s.get("waiter_count") or 0),
                        timeout_error_count=int(s.get("timeout_error_count") or 0),
                        forced_grant_count=int(s.get("forced_grant_count") or 0),
                        utilization_pct=util,
                    )
                )

            # 2. Live Memory Grants (Active & Waiting)
            cursor.execute("""
            SELECT TOP 25
                mg.session_id,
                mg.request_id,
                mg.scheduler_id,
                mg.dop,
                ROUND(CAST(mg.requested_memory_kb AS FLOAT) / 1024.0, 2) AS requested_memory_mb,
                ROUND(CAST(ISNULL(mg.granted_memory_kb, 0) AS FLOAT) / 1024.0, 2) AS granted_memory_mb,
                ROUND(CAST(mg.required_memory_kb AS FLOAT) / 1024.0, 2) AS required_memory_mb,
                ROUND(CAST(ISNULL(mg.used_memory_kb, 0) AS FLOAT) / 1024.0, 2) AS used_memory_mb,
                ROUND(CAST(ISNULL(mg.max_used_memory_kb, 0) AS FLOAT) / 1024.0, 2) AS max_used_memory_mb,
                ROUND(CAST(ISNULL(mg.ideal_memory_kb, 0) AS FLOAT) / 1024.0, 2) AS ideal_memory_mb,
                ROUND(CAST(mg.query_cost AS FLOAT), 2) AS query_cost,
                mg.wait_time_ms,
                mg.wait_order,
                mg.is_next_candidate,
                ISNULL(st.text, '') AS query_text
            FROM sys.dm_exec_query_memory_grants mg
            OUTER APPLY sys.dm_exec_sql_text(mg.sql_handle) st
            ORDER BY mg.wait_time_ms DESC, mg.requested_memory_kb DESC;
            """)
            raw_live = rows_to_dicts(cursor)
            for lg in raw_live:
                wait_ms = int(lg.get("wait_time_ms") or 0)
                grt_mb = float(lg.get("granted_memory_mb") or 0.0)
                is_waiting = (wait_ms > 0 or grt_mb == 0.0)
                status_str = "WAITING (RESOURCE_SEMAPHORE)" if is_waiting else "GRANTED"

                q_text = str(lg.get("query_text") or "").strip()
                if is_waiting:
                    hint = f"Sorgu bellek kuyruğunda ({wait_ms} ms). OPTION (MAX_GRANT_PERCENT = 10) veya indeks destekli tarama ile bellek ihtiyacını düşürün."
                else:
                    hint = "Sorgu çalışma belleğini aldı; işlem tamamlanana kadar RAM rezervasyonu korunuyor."

                live_grants.append(
                    LiveMemoryGrantItem(
                        session_id=int(lg.get("session_id") or 0),
                        request_id=int(lg.get("request_id") or 0),
                        scheduler_id=int(lg.get("scheduler_id") or 0),
                        dop=int(lg.get("dop") or 1),
                        requested_memory_mb=float(lg.get("requested_memory_mb") or 0.0),
                        granted_memory_mb=grt_mb,
                        required_memory_mb=float(lg.get("required_memory_mb") or 0.0),
                        used_memory_mb=float(lg.get("used_memory_mb") or 0.0),
                        max_used_memory_mb=float(lg.get("max_used_memory_mb") or 0.0),
                        ideal_memory_mb=float(lg.get("ideal_memory_mb") or 0.0),
                        query_cost=float(lg.get("query_cost") or 0.0),
                        wait_time_ms=wait_ms,
                        wait_order=lg.get("wait_order"),
                        is_next_candidate=bool(lg.get("is_next_candidate")),
                        status=status_str,
                        query_text=q_text,
                        remediation_hint=hint,
                    )
                )

            # 3. Historical Memory Wasters and TempDB Spills (from plan cache)
            cursor.execute("""
            SELECT TOP 20
                qs.execution_count,
                ROUND(CAST(qs.max_grant_kb AS FLOAT) / 1024.0, 2) AS max_grant_mb,
                ROUND(CAST(qs.total_grant_kb AS FLOAT) / (qs.execution_count * 1024.0), 2) AS avg_grant_mb,
                ROUND(CAST(qs.max_used_grant_kb AS FLOAT) / 1024.0, 2) AS max_used_grant_mb,
                ROUND(CAST(qs.total_used_grant_kb AS FLOAT) / (qs.execution_count * 1024.0), 2) AS avg_used_grant_mb,
                CASE WHEN qs.max_grant_kb > 0 
                     THEN ROUND((1.0 - (CAST(qs.max_used_grant_kb AS FLOAT) / qs.max_grant_kb)) * 100.0, 1) 
                     ELSE 0.0 END AS wasted_grant_pct,
                qs.total_spills,
                SUBSTRING(st.text, (qs.statement_start_offset/2)+1, 
                    ((CASE qs.statement_end_offset WHEN -1 THEN DATALENGTH(st.text) ELSE qs.statement_end_offset END - qs.statement_start_offset)/2) + 1) AS statement_text
            FROM sys.dm_exec_query_stats qs
            CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
            WHERE qs.max_grant_kb > 0
            ORDER BY 
                (qs.max_grant_kb - qs.max_used_grant_kb) DESC,
                qs.total_spills DESC;
            """)
            raw_hist = rows_to_dicts(cursor)
            for h in raw_hist:
                max_grt = float(h.get("max_grant_mb") or 0.0)
                max_usd = float(h.get("max_used_grant_mb") or 0.0)
                wasted_pct = float(h.get("wasted_grant_pct") or 0.0)
                spills = int(h.get("total_spills") or 0)
                stmt_text = str(h.get("statement_text") or "").strip()

                if wasted_pct >= 70.0 and max_grt > 1.0:
                    verdict = (
                        f"Kritik Bellek İsrafı (%{wasted_pct:.1f}): Optimizer {max_grt} MB bellek talep edip tahsis etti, "
                        f"ancak sorgu yalnızca {max_usd} MB kullandı. Bu fark, kardinalite tahmininin (Cardinality Estimation) "
                        f"güncel olmayan istatistikler nedeniyle dönen satır sayısını aşırı yüksek tahmin etmesinden kaynaklanır."
                    )
                    remediation = (
                        "-- 1. İlgili tablonun istatistiklerini tam tarama ile tazeleyin:\n"
                        "UPDATE STATISTICS [Şema].[TabloAdı] WITH FULLSCAN;\n\n"
                        "-- 2. Veya aşırı bellek ayrılmasını önlemek için sorgu ipucu (Query Hint) ekleyin:\n"
                        "OPTION (MAX_GRANT_PERCENT = 10);"
                    )
                elif spills > 0:
                    verdict = (
                        f"TempDB Disk Taşması (Spill - {spills} olay): Sorguya ayrılan bellek ({max_grt} MB), "
                        f"ORDER BY veya HASH JOIN işlemlerini RAM'de tamamlamaya yetmedi ve disk üzerine taştı."
                    )
                    remediation = (
                        "-- 1. Taşmayı engellemek için minimum bellek yüzdesini artırın:\n"
                        "OPTION (MIN_GRANT_PERCENT = 5);\n\n"
                        "-- 2. ORDER BY sütunlarını kapsayan bir indeks ekleyerek bellek içi sıralamayı ortadan kaldırın."
                    )
                else:
                    verdict = "Dengeli Bellek Kullanımı: Ayrılan bellek miktarı ile fiilen kullanılan bellek tutarlı."
                    remediation = "-- Mevcut bellek tahsisi dengeli görünmektedir."

                historical_wasters.append(
                    HistoricalMemoryWasterItem(
                        execution_count=int(h.get("execution_count") or 1),
                        max_grant_mb=max_grt,
                        avg_grant_mb=float(h.get("avg_grant_mb") or 0.0),
                        max_used_grant_mb=max_usd,
                        avg_used_grant_mb=float(h.get("avg_used_grant_mb") or 0.0),
                        wasted_grant_pct=wasted_pct,
                        total_spills=spills,
                        query_text=stmt_text,
                        diagnostic_verdict=verdict,
                        remediation_tsql=remediation,
                    )
                )

    except Exception as e:
        logger.error("Error evaluating memory grants: %s", e)

    # Calculate summary aggregates
    total_workspace = sum(s.total_memory_mb for s in semaphores)
    avail_workspace = sum(s.available_memory_mb for s in semaphores)
    active_cnt = sum(s.grantee_count for s in semaphores)
    waiter_cnt = sum(s.waiter_count for s in semaphores)
    has_starvation = (waiter_cnt > 0) or any(s.timeout_error_count > 0 for s in semaphores)

    top_wasted = max((hw.max_grant_mb - hw.max_used_grant_mb for hw in historical_wasters), default=0.0)
    spilling_count = sum(1 for hw in historical_wasters if hw.total_spills > 0)

    summary = MemoryGrantSummary(
        server_name=server_name,
        total_workspace_memory_mb=round(total_workspace, 2),
        available_workspace_memory_mb=round(avail_workspace, 2),
        active_grants_count=active_cnt,
        queued_waiters_count=waiter_cnt,
        has_memory_starvation=has_starvation,
        top_wasted_grant_mb=round(max(0.0, top_wasted), 2),
        total_spilling_queries_count=spilling_count,
        evaluated_at=datetime.utcnow().isoformat(),
    )

    return MemoryGrantResponse(
        summary=summary,
        semaphores=semaphores,
        live_grants=live_grants,
        historical_wasters=historical_wasters,
    )
