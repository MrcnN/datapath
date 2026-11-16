"""services/plan_poisoning_service.py — Parameter Sniffing & Surgical Plan Eviction Service."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Optional
import pyodbc

from app.db.connection import ConnectionParams, get_db_connection, rows_to_dicts
from app.schemas.plan_poisoning import (
    SniffedParamDetail,
    PoisonedQueryItem,
    PlanPoisoningSummary,
    PlanPoisoningResponse,
)

logger = logging.getLogger(__name__)


def get_plan_poisoning_analysis(
    params: ConnectionParams,
    database_name: Optional[str] = None,
    min_variance_ratio: float = 5.0,
) -> PlanPoisoningResponse:
    """Detect queries suffering from parameter sniffing (high plan execution variance)
    and generate surgical plan eviction (DBCC FREEPROCCACHE plan_handle) scripts.
    """
    items: List[PoisonedQueryItem] = []
    major_ver = 14
    psp_enabled = False

    try:
        with get_db_connection(params) as conn:
            cursor = conn.cursor()

            # 1. Detect SQL Server Version & PSP Optimization (SQL 2022+)
            try:
                cursor.execute("SELECT CAST(SERVERPROPERTY('ProductMajorVersion') AS INT);")
                r = cursor.fetchone()
                if r and r[0]:
                    major_ver = int(r[0])
            except Exception:
                pass

            if major_ver >= 16:  # SQL Server 2022
                try:
                    cursor.execute("""
                    SELECT value 
                    FROM sys.database_scoped_configurations 
                    WHERE name = 'PARAMETER_SENSITIVE_PLAN_OPTIMIZATION';
                    """)
                    row = cursor.fetchone()
                    if row and row[0] in (1, '1'):
                        psp_enabled = True
                except Exception:
                    pass

            # 2. Query execution statistics for queries with extreme duration or CPU variance
            query = """
            SELECT TOP 35
                CONVERT(VARCHAR(128), qs.plan_handle, 1) AS plan_handle_hex,
                CONVERT(VARCHAR(128), qs.sql_handle, 1) AS sql_handle_hex,
                CONVERT(VARCHAR(64), qs.query_hash, 1) AS query_hash_hex,
                CONVERT(VARCHAR(64), qs.query_plan_hash, 1) AS query_plan_hash_hex,
                qs.execution_count,
                ROUND(qs.min_elapsed_time / 1000.0, 2) AS min_elapsed_ms,
                ROUND((qs.total_elapsed_time / NULLIF(qs.execution_count, 0)) / 1000.0, 2) AS avg_elapsed_ms,
                ROUND(qs.max_elapsed_time / 1000.0, 2) AS max_elapsed_ms,
                ROUND(qs.min_worker_time / 1000.0, 2) AS min_cpu_ms,
                ROUND((qs.total_worker_time / NULLIF(qs.execution_count, 0)) / 1000.0, 2) AS avg_cpu_ms,
                ROUND(qs.max_worker_time / 1000.0, 2) AS max_cpu_ms,
                qs.min_logical_reads,
                qs.max_logical_reads,
                CASE 
                    WHEN qs.min_elapsed_time > 0 
                    THEN ROUND(CAST(qs.max_elapsed_time AS FLOAT) / CAST(qs.min_elapsed_time AS FLOAT), 1)
                    ELSE ROUND(CAST(qs.max_elapsed_time AS FLOAT) / 1000.0, 1)
                END AS variance_ratio,
                CASE 
                    WHEN qs.min_worker_time > 0 
                    THEN ROUND(CAST(qs.max_worker_time AS FLOAT) / CAST(qs.min_worker_time AS FLOAT), 1)
                    ELSE ROUND(CAST(qs.max_worker_time AS FLOAT) / 1000.0, 1)
                END AS cpu_variance_ratio,
                ISNULL(DB_NAME(st.dbid), DB_NAME()) AS database_name,
                OBJECT_NAME(st.objectid, st.dbid) AS object_name,
                SUBSTRING(
                    st.text, 
                    (qs.statement_start_offset / 2) + 1,
                    ((CASE qs.statement_end_offset 
                        WHEN -1 THEN DATALENGTH(st.text) 
                        ELSE qs.statement_end_offset 
                      END - qs.statement_start_offset) / 2) + 1
                ) AS statement_text
            FROM sys.dm_exec_query_stats qs
            CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
            WHERE qs.execution_count >= 3
              AND (qs.max_elapsed_time / NULLIF(qs.min_elapsed_time, 0)) >= ?
              AND qs.max_elapsed_time > 50000 -- en az 50 ms maksimum süre
              AND st.text NOT LIKE '%sys.dm_%'
              AND st.text NOT LIKE '%sysjobs%'
            ORDER BY variance_ratio DESC, qs.max_elapsed_time DESC;
            """

            cursor.execute(query, (min_variance_ratio,))
            rows = rows_to_dicts(cursor)

            for r in rows:
                plan_hex = r.get("plan_handle_hex") or "0x"
                sql_hex = r.get("sql_handle_hex") or "0x"
                q_hash = r.get("query_hash_hex") or "0x"
                qp_hash = r.get("query_plan_hash_hex")
                exec_cnt = int(r.get("execution_count") or 0)
                var_ratio = float(r.get("variance_ratio") or 1.0)
                cpu_var_ratio = float(r.get("cpu_variance_ratio") or 1.0)
                min_el = float(r.get("min_elapsed_ms") or 0.0)
                avg_el = float(r.get("avg_elapsed_ms") or 0.0)
                max_el = float(r.get("max_elapsed_ms") or 0.0)
                min_cpu = float(r.get("min_cpu_ms") or 0.0)
                avg_cpu = float(r.get("avg_cpu_ms") or 0.0)
                max_cpu = float(r.get("max_cpu_ms") or 0.0)
                min_reads = int(r.get("min_logical_reads") or 0)
                max_reads = int(r.get("max_logical_reads") or 0)
                db_name = r.get("database_name") or "master"
                obj_name = r.get("object_name")
                raw_text = r.get("statement_text") or ""
                stmt_text = " ".join(raw_text.split())

                if database_name and db_name.lower() != database_name.lower():
                    continue

                # Severity calculation based on variance ratio and max elapsed time
                if var_ratio >= 100.0 or (var_ratio >= 30.0 and max_el >= 5000.0):
                    severity = "CRITICAL"
                    diagnosis = (
                        f"Ağır Parametre Koklama (Sniffing) Uyuşmazlığı: En hızlı çalışma {min_el:.1f} ms iken "
                        f"en yavaş çalışma {max_el:.1f} ms ({var_ratio:.0f} kat fark). Önbellekteki plan tipik olmayan bir parametreye kilitlenmiş."
                    )
                elif var_ratio >= 25.0 or (var_ratio >= 10.0 and max_el >= 2000.0):
                    severity = "HIGH"
                    diagnosis = (
                        f"Yüksek Yürütme Sapması: Maksimum CPU tüketimi minimumun {cpu_var_ratio:.0f} katı. "
                        f"Okuma sayısı {min_reads:,} ile {max_reads:,} sayfa arasında dalgalanıyor."
                    )
                elif var_ratio >= 8.0:
                    severity = "MEDIUM"
                    diagnosis = (
                        f"Orta Dereceli Plan Kararsızlığı: {exec_cnt} çalıştırma boyunca {var_ratio:.1f} kat süre dalgalanması tespit edildi."
                    )
                else:
                    severity = "LOW"
                    diagnosis = "Düşük dereceli dalgalanma; geçici önbellek etkisi olabilir."

                # Surgical Eviction T-SQL (DBCC FREEPROCCACHE specific handle)
                surgical_tsql = (
                    f"-- ====================================================================\n"
                    f"-- NOKTASAL (SURGICAL) PLAN TAHLİYESİ — DATAPATH\n"
                    f"-- Sunucu genelindeki planları silmez; yalnızca bu zehirlenmiş planı boşaltır.\n"
                    f"-- ====================================================================\n"
                    f"DBCC FREEPROCCACHE ({plan_hex});\n"
                    f"PRINT 'Zehirlenmiş yürütme planı önbellekten cerrahi olarak tahliye edildi: {plan_hex}';"
                )

                # Database Scoped Config Clear T-SQL (SQL 2016+)
                db_scoped_tsql = (
                    f"USE [{db_name}];\n"
                    f"ALTER DATABASE SCOPED CONFIGURATION CLEAR PROCEDURE_CACHE {plan_hex};\n"
                    f"PRINT 'Veritabanı bazlı prosedür önbelleği temizlendi: {plan_hex}';"
                )

                # sp_recompile T-SQL if object_name is known
                if obj_name:
                    recompile_tsql = (
                        f"USE [{db_name}];\n"
                        f"EXEC sp_recompile N'{obj_name}';\n"
                        f"PRINT 'Prosedür/fonksiyon sonraki çalıştırmada yeniden derlenmek üzere işaretlendi: {obj_name}';"
                    )
                else:
                    recompile_tsql = "-- Dinamik SQL sorgusu olduğundan doğrudan sp_recompile çağrılamaz; noktasal DBCC FREEPROCCACHE kullanınız."

                # Permanent query hint suggestions
                permanent_hint_tsql = (
                    f"-- Kalıcı Çözüm Seçenekleri:\n"
                    f"-- Seçenek A (Tüm parametreler için her defasında taze plan):\n"
                    f"-- {stmt_text[:160]} ... OPTION (RECOMPILE);\n\n"
                    f"-- Seçenek B (Ortalama dağılıma göre derleme - Parameter Sniffing Koruması):\n"
                    f"-- {stmt_text[:160]} ... OPTION (OPTIMIZE FOR UNKNOWN);\n"
                )

                items.append(PoisonedQueryItem(
                    plan_handle=plan_hex,
                    sql_handle=sql_hex,
                    query_hash=q_hash,
                    query_plan_hash=qp_hash,
                    statement_text=stmt_text,
                    object_name=obj_name,
                    database_name=db_name,
                    execution_count=exec_cnt,
                    variance_ratio=var_ratio,
                    cpu_variance_ratio=cpu_var_ratio,
                    min_elapsed_ms=min_el,
                    avg_elapsed_ms=avg_el,
                    max_elapsed_ms=max_el,
                    min_cpu_ms=min_cpu,
                    avg_cpu_ms=avg_cpu,
                    max_cpu_ms=max_cpu,
                    min_logical_reads=min_reads,
                    max_logical_reads=max_reads,
                    compiled_params=[],
                    severity=severity,
                    diagnosis=diagnosis,
                    surgical_eviction_tsql=surgical_tsql,
                    database_scoped_clear_tsql=db_scoped_tsql,
                    sp_recompile_tsql=recompile_tsql,
                    permanent_hint_tsql=permanent_hint_tsql,
                ))

    except Exception as exc:
        logger.error("Error analyzing plan poisoning: %s", exc)

    critical_cnt = sum(1 for i in items if i.severity == "CRITICAL")
    high_cnt = sum(1 for i in items if i.severity == "HIGH")
    avg_ratio = round(sum(i.variance_ratio for i in items) / len(items), 1) if items else 0.0
    highest_ratio = max((i.variance_ratio for i in items), default=0.0)

    summary = PlanPoisoningSummary(
        total_suspect_queries=len(items),
        critical_count=critical_cnt,
        high_count=high_cnt,
        avg_variance_ratio=avg_ratio,
        highest_variance_ratio=highest_ratio,
        psp_optimization_enabled=psp_enabled,
        sql_major_version=major_ver,
        evaluated_at=datetime.now(timezone.utc).isoformat(),
    )

    return PlanPoisoningResponse(summary=summary, items=items)
