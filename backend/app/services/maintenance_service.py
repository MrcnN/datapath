"""services/maintenance_service.py — Smart Index Maintenance & Statistics Planner."""
from __future__ import annotations

import logging
from typing import List, Optional
import pyodbc

from app.db.connection import ConnectionParams, get_db_connection, rows_to_dicts
from app.schemas.maintenance import MaintenanceActionItem, MaintenancePlanSummary

logger = logging.getLogger(__name__)


def generate_maintenance_plan(
    params: ConnectionParams,
    database: Optional[str] = None,
    min_pages: int = 1000,
    max_frag_reorg: float = 10.0,
    min_frag_rebuild: float = 30.0,
) -> MaintenancePlanSummary:
    """Generate an intelligent, selective index rebuild and reorganization plan based on DMV stats."""
    target_db = database or params.database or "master"
    items: List[MaintenanceActionItem] = []

    try:
        with get_db_connection(params) as conn:
            cursor = conn.cursor()
            if target_db:
                cursor.execute(f"USE [{target_db}];")

            # Check if Enterprise Edition or Developer Edition (supports ONLINE rebuild)
            is_enterprise = False
            try:
                cursor.execute("SELECT SERVERPROPERTY('EngineEdition');")
                r = cursor.fetchone()
                if r and int(r[0]) in (3, 5):  # 3 = Enterprise, 5 = Azure SQL / Hyperscale
                    is_enterprise = True
            except Exception:
                pass

            # Query index physical stats and stats properties
            query = """
            SELECT
                DB_NAME() AS database_name,
                s.name AS schema_name,
                t.name AS table_name,
                i.name AS index_name,
                i.type_desc AS index_type,
                ROUND(ips.avg_fragmentation_in_percent, 2) AS avg_fragmentation_percent,
                ips.page_count,
                ROUND(ips.page_count * 8.0 / 1024.0, 2) AS size_mb,
                ISNULL(sp.modification_counter, 0) AS modification_counter,
                ISNULL(sp.rows, 0) AS total_rows
            FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
            INNER JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
            INNER JOIN sys.tables t ON i.object_id = t.object_id
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
            OUTER APPLY sys.dm_db_stats_properties(i.object_id, i.index_id) sp
            WHERE i.name IS NOT NULL
              AND t.is_ms_shipped = 0
            ORDER BY ips.page_count DESC, ips.avg_fragmentation_in_percent DESC;
            """
            cursor.execute(query)
            rows = rows_to_dicts(cursor)

            for r in rows:
                sch = r.get("schema_name", "dbo")
                tbl = r.get("table_name", "")
                idx = r.get("index_name", "")
                itype = r.get("index_type", "NONCLUSTERED")
                frag = float(r.get("avg_fragmentation_percent") or 0.0)
                pages = int(r.get("page_count") or 0)
                size_mb = float(r.get("size_mb") or 0.0)
                mods = int(r.get("modification_counter") or 0)
                rows_cnt = int(r.get("total_rows") or 0)

                # Duration heuristic: ~1.5 sec per 100 MB for rebuild, 0.5 sec for reorg
                est_dur_rebuild = max(1.0, round((size_mb / 100.0) * 1.5, 1))
                est_dur_reorg = max(0.5, round((size_mb / 100.0) * 0.5, 1))

                # Rule 1: Small index (< min_pages pages, e.g. < 8MB)
                # Fragmented small indexes fit in memory cache; rebuilding wastes I/O and creates LDF bloat!
                if pages < min_pages:
                    items.append(
                        MaintenanceActionItem(
                            database_name=target_db,
                            schema_name=sch,
                            table_name=tbl,
                            index_name=idx,
                            index_type=itype,
                            avg_fragmentation_percent=frag,
                            page_count=pages,
                            size_mb=size_mb,
                            action_type="NO_ACTION",
                            urgency="NONE",
                            reason=f"Sayfa sayısı ({pages}) eşik değerden ({min_pages}) düşük. Bellek önbelleğine kolayca sığdığından gereksiz disk I/O ve işlem günlüğü şişmesini önlemek için dokunulmadı.",
                            estimated_duration_sec=0.0,
                            command_tsql=f"-- [{idx}] atlandı: Boyut çok küçük ({pages} sayfa < {min_pages}).",
                        )
                    )
                elif frag >= min_frag_rebuild:
                    # Rule 2: High fragmentation (>= 30%) -> REBUILD
                    action = "REBUILD_ONLINE" if is_enterprise else "REBUILD_OFFLINE"
                    online_clause = "WITH (ONLINE = ON, RESUMABLE = ON, SORT_IN_TEMPDB = ON)" if is_enterprise else "WITH (SORT_IN_TEMPDB = ON)"
                    cmd = f"ALTER INDEX [{idx}] ON [{sch}].[{tbl}] REBUILD {online_clause};"
                    items.append(
                        MaintenanceActionItem(
                            database_name=target_db,
                            schema_name=sch,
                            table_name=tbl,
                            index_name=idx,
                            index_type=itype,
                            avg_fragmentation_percent=frag,
                            page_count=pages,
                            size_mb=size_mb,
                            action_type=action,
                            urgency="HIGH",
                            reason=f"Parçalanma oranı %{frag} >= %{min_frag_rebuild}. Yüksek I/O gecikmelerini önlemek için yeniden oluşturma (REBUILD) gereklidir.",
                            estimated_duration_sec=est_dur_rebuild,
                            command_tsql=cmd,
                        )
                    )
                elif frag >= max_frag_reorg:
                    # Rule 3: Moderate fragmentation (10% - 30%) -> REORGANIZE
                    cmd = (
                        f"ALTER INDEX [{idx}] ON [{sch}].[{tbl}] REORGANIZE;\n"
                        f"UPDATE STATISTICS [{sch}].[{tbl}] [{idx}] WITH RESAMPLE;"
                    )
                    items.append(
                        MaintenanceActionItem(
                            database_name=target_db,
                            schema_name=sch,
                            table_name=tbl,
                            index_name=idx,
                            index_type=itype,
                            avg_fragmentation_percent=frag,
                            page_count=pages,
                            size_mb=size_mb,
                            action_type="REORGANIZE",
                            urgency="MEDIUM",
                            reason=f"Parçalanma oranı orta seviyede (%{frag}). Kilit oluşturmayan, minimal log üreten REORGANIZE ve ardından istatistik tazeleme önerilir.",
                            estimated_duration_sec=est_dur_reorg,
                            command_tsql=cmd,
                        )
                    )
                elif mods > 5000 or (rows_cnt > 0 and (mods / rows_cnt) > 0.10):
                    # Rule 4: Fragmentation healthy but statistics stale
                    cmd = f"UPDATE STATISTICS [{sch}].[{tbl}] [{idx}] WITH FULLSCAN;"
                    items.append(
                        MaintenanceActionItem(
                            database_name=target_db,
                            schema_name=sch,
                            table_name=tbl,
                            index_name=idx,
                            index_type=itype,
                            avg_fragmentation_percent=frag,
                            page_count=pages,
                            size_mb=size_mb,
                            action_type="UPDATE_STATS",
                            urgency="LOW",
                            reason=f"Fiziksel parçalanma düşük (%{frag}) ancak {mods:,} satır değişikliği nedeniyle sorgu iyileştirici istatistikleri eskimiş.",
                            estimated_duration_sec=max(0.5, round((size_mb / 200.0), 1)),
                            command_tsql=cmd,
                        )
                    )
                else:
                    # Rule 5: Completely healthy
                    items.append(
                        MaintenanceActionItem(
                            database_name=target_db,
                            schema_name=sch,
                            table_name=tbl,
                            index_name=idx,
                            index_type=itype,
                            avg_fragmentation_percent=frag,
                            page_count=pages,
                            size_mb=size_mb,
                            action_type="NO_ACTION",
                            urgency="NONE",
                            reason=f"İndeks sağlıklı (%{frag} parçalanma, güncel istatistikler).",
                            estimated_duration_sec=0.0,
                            command_tsql=f"-- [{idx}] sağlıklı (%{frag}). İşlem gerekmez.",
                        )
                    )

    except Exception as exc:
        logger.warning("Could not execute live index maintenance query: %s", exc)

    # Compute summaries
    rebuild_cnt = sum(1 for it in items if "REBUILD" in it.action_type)
    reorg_cnt = sum(1 for it in items if it.action_type == "REORGANIZE")
    stats_cnt = sum(1 for it in items if it.action_type == "UPDATE_STATS")
    no_act_cnt = sum(1 for it in items if it.action_type == "NO_ACTION")
    total_size = sum(it.size_mb for it in items if it.action_type != "NO_ACTION")
    est_total_mins = round(sum(it.estimated_duration_sec for it in items) / 60.0, 1)

    batch_script = _generate_batch_script(target_db, items)
    agent_job_tsql = _generate_agent_job_script(target_db, batch_script)

    return MaintenancePlanSummary(
        database_name=target_db,
        total_indexes_evaluated=len(items),
        rebuild_count=rebuild_cnt,
        reorganize_count=reorg_cnt,
        stats_update_count=stats_cnt,
        no_action_count=no_act_cnt,
        total_size_mb=round(total_size, 2),
        estimated_total_minutes=est_total_mins,
        generated_batch_script=batch_script,
        generated_agent_job_tsql=agent_job_tsql,
        items=items,
    )


def _generate_batch_script(database: str, items: List[MaintenanceActionItem]) -> str:
    active_items = [it for it in items if it.action_type != "NO_ACTION"]
    if not active_items:
        return f"-- [{database}] veritabanında bakım gerektiren indeks veya istatistik bulunamadı.\n-- Tüm nesneler sağlıklı."

    lines = [
        f"-- ==========================================================================",
        f"-- Traceforge Akıllı İndeks & İstatistik Bakım Betiği",
        f"-- Veritabanı: {database}",
        f"-- Hedeflenen Nesne Sayısı: {len(active_items)}",
        f"-- ==========================================================================",
        f"SET NOCOUNT ON;",
        f"SET LOCK_TIMEOUT 15000; -- 15 saniye kilit bekleme sınırı",
        f"USE [{database}];",
        f"PRINT '=== Akıllı İndeks Bakım Süreci Başlatıldı: ' + CONVERT(VARCHAR(24), GETDATE(), 120);",
        "",
    ]

    for idx, it in enumerate(active_items, 1):
        lines.append(f"-- [{idx}/{len(active_items)}] {it.table_name}.{it.index_name} ({it.action_type} - Parçalanma: %{it.avg_fragmentation_percent})")
        lines.append("BEGIN TRY")
        lines.append(f"    PRINT 'Bakım uygulanıyor: [{it.schema_name}].[{it.table_name}].[{it.index_name}] ({it.action_type})...';")
        lines.append(f"    {it.command_tsql}")
        lines.append(f"    PRINT 'Tamamlandı: [{it.index_name}]';")
        lines.append("END TRY")
        lines.append("BEGIN CATCH")
        lines.append(f"    PRINT 'HATA: [{it.index_name}] bakımında sorun oluştu: ' + ERROR_MESSAGE();")
        lines.append("END CATCH;")
        lines.append("")

    lines.append("PRINT '=== Akıllı İndeks Bakım Süreci Başarıyla Tamamlandı: ' + CONVERT(VARCHAR(24), GETDATE(), 120);")
    return "\n".join(lines)


def _generate_agent_job_script(database: str, batch_sql: str) -> str:
    escaped_sql = batch_sql.replace("'", "''")
    job_name = f"Traceforge_Smart_Maintenance_{database}"
    return f"""-- ==========================================================================
-- SQL Server Agent Job: {job_name}
-- Otomatik Haftalık İndeks İyileştirme ve İstatistik Tazeleme İşi
-- ==========================================================================
USE [msdb];
GO

DECLARE @jobId BINARY(16);
EXEC msdb.dbo.sp_add_job
    @job_name = N'{job_name}',
    @enabled = 1,
    @notify_level_eventlog = 2,
    @description = N'Traceforge Akıllı İndeks & İstatistik Bakım Planlayıcısı tarafından üretildi.',
    @category_name = N'Database Maintenance',
    @job_id = @jobId OUTPUT;

EXEC msdb.dbo.sp_add_jobstep
    @job_id = @jobId,
    @step_name = N'Smart Defrag Step',
    @step_id = 1,
    @cmdexec_success_code = 0,
    @on_success_action = 1,
    @on_fail_action = 2,
    @retry_attempts = 1,
    @retry_interval = 5,
    @subsystem = N'TSQL',
    @command = N'{escaped_sql}',
    @database_name = N'{database}';

-- Pazar günleri gece 02:00 çalıştırma çizelgesi
EXEC msdb.dbo.sp_add_jobschedule
    @job_id = @jobId,
    @name = N'{job_name}_Weekly',
    @enabled = 1,
    @freq_type = 8, -- Haftalık
    @freq_interval = 1, -- Pazar
    @freq_recurrence_factor = 1,
    @active_start_time = 020000;

EXEC msdb.dbo.sp_add_jobserver
    @job_id = @jobId,
    @server_name = N'(local)';
GO
"""
