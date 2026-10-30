"""services/tempdb_memory_service.py — TempDB space allocation, GAM/SGAM contention, PLE and Buffer Pool / Memory Clerks."""
from __future__ import annotations

import logging
from typing import List, Optional

from app.db.connection import ConnectionParams, get_db_connection, rows_to_dicts
from app.schemas.tempdb_memory import (
    MemoryClerk,
    TempDBFile,
    TempDBMemorySummary,
    TempDBSpaceBreakdown,
    BufferPoolDatabaseUsage,
    BufferPoolTopObject,
    PlanCacheBloatAnalysis,
    QueryMemoryGrantDetail,
    MemoryGrantsSummary,
    TempDBContentionWaiter,
    TempDBSessionSpaceUsage,
    TempDBContentionSummary,
)
from app.services.demo_data import (
    DEMO_TEMPDB_MEMORY_SUMMARY,
    DEMO_MEMORY_GRANTS_SUMMARY,
    DEMO_TEMPDB_CONTENTION_SUMMARY,
)

logger = logging.getLogger(__name__)

CLERK_FRIENDLY_NAMES = {
    "MEMORYCLERK_SQLBUFFERPOOL": "Buffer Pool (Veri Sayfaları Önbelleği)",
    "CACHESTORE_SQLCP": "SQL Plan Cache (Dinamik / Ad-hoc Sorgular)",
    "CACHESTORE_OBJCP": "Object Plan Cache (SP, View, Tetikleyiciler)",
    "CACHESTORE_PHDR": "Bound Trees & Parse Trees",
    "MEMORYCLERK_SQLSTORENG": "Storage Engine (Depolama Motoru)",
    "MEMORYCLERK_SQLCLR": "SQL CLR Runtime (Entegre Kod Motoru)",
    "MEMORYCLERK_SQLSERVICEBROKER": "Service Broker Kuyruk Belleği",
    "MEMORYCLERK_SOSNODE": "SOS Memory Node (İş Parçacığı & Görev Alanı)",
    "MEMORYCLERK_SQLOPTIMIZER": "Sorgu İyileştirici (Query Optimizer)",
    "MEMORYCLERK_SQLGENERAL": "Genel SQL Server İşlemleri",
    "MEMORYCLERK_SQLCONNECTIONPOOL": "İstemci Bağlantı Havuzu",
    "MEMORYCLERK_XE": "Extended Events (XEvent Motoru)",
}


def get_tempdb_memory_summary(params: Optional[ConnectionParams] = None) -> TempDBMemorySummary:
    """Analyze TempDB allocation, contention, Page Life Expectancy (PLE), and memory consumption."""
    conn = get_db_connection(params)
    if not conn:
        logger.info("TempDBMemoryService: No connection, returning demo data.")
        return DEMO_TEMPDB_MEMORY_SUMMARY

    try:
        cursor = conn.cursor()

        # 1. TempDB space distribution from tempdb.sys.dm_db_file_space_usage
        space_query = """
        SELECT 
            CAST(ROUND(SUM(unallocated_extent_page_count) * 8.0 / 1024.0, 2) AS FLOAT) AS unallocated_mb,
            CAST(ROUND(SUM(version_store_reserved_page_count) * 8.0 / 1024.0, 2) AS FLOAT) AS version_store_mb,
            CAST(ROUND(SUM(user_object_reserved_page_count) * 8.0 / 1024.0, 2) AS FLOAT) AS user_objects_mb,
            CAST(ROUND(SUM(internal_object_reserved_page_count) * 8.0 / 1024.0, 2) AS FLOAT) AS internal_objects_mb,
            CAST(ROUND(SUM(total_page_count) * 8.0 / 1024.0, 2) AS FLOAT) AS total_mb
        FROM tempdb.sys.dm_db_file_space_usage;
        """
        cursor.execute(space_query)
        space_rows = rows_to_dicts(cursor)
        srow = space_rows[0] if space_rows else {}

        tot_mb = float(srow.get("total_mb", 0.0) or 0.0)
        unalloc_mb = float(srow.get("unallocated_mb", 0.0) or 0.0)
        vstore_mb = float(srow.get("version_store_mb", 0.0) or 0.0)
        user_mb = float(srow.get("user_objects_mb", 0.0) or 0.0)
        int_mb = float(srow.get("internal_objects_mb", 0.0) or 0.0)

        user_pct = round((user_mb / tot_mb * 100.0), 2) if tot_mb > 0 else 0.0
        int_pct = round((int_mb / tot_mb * 100.0), 2) if tot_mb > 0 else 0.0
        vstore_pct = round((vstore_mb / tot_mb * 100.0), 2) if tot_mb > 0 else 0.0
        unalloc_pct = round((unalloc_mb / tot_mb * 100.0), 2) if tot_mb > 0 else 0.0

        space_breakdown = TempDBSpaceBreakdown(
            user_objects_mb=user_mb,
            internal_objects_mb=int_mb,
            version_store_mb=vstore_mb,
            unallocated_space_mb=unalloc_mb,
            total_size_mb=tot_mb,
            user_objects_pct=user_pct,
            internal_objects_pct=int_pct,
            version_store_pct=vstore_pct,
            unallocated_pct=unalloc_pct,
        )

        # 2. TempDB data files
        files_query = """
        SELECT 
            file_id,
            name,
            physical_name,
            CAST(ROUND(size * 8.0 / 1024.0, 2) AS FLOAT) AS size_mb,
            growth,
            is_percent_growth
        FROM sys.master_files
        WHERE database_id = 2 AND type_desc = 'ROWS'
        ORDER BY file_id;
        """
        cursor.execute(files_query)
        t_rows = rows_to_dicts(cursor)

        tempdb_files: List[TempDBFile] = []
        sizes = []
        for tr in t_rows:
            sz = float(tr.get("size_mb", 0.0) or 0.0)
            sizes.append(sz)
            is_pct = bool(tr.get("is_percent_growth", 0))
            raw_growth = tr.get("growth", 0) or 0
            growth_str = f"{raw_growth}%" if is_pct else f"{round(raw_growth * 8.0 / 1024.0, 0):.0f} MB"

            tempdb_files.append(
                TempDBFile(
                    file_id=int(tr.get("file_id", 0)),
                    name=tr.get("name", ""),
                    physical_name=tr.get("physical_name", ""),
                    size_mb=sz,
                    free_mb=round(sz * (unalloc_pct / 100.0), 2),
                    free_percent=unalloc_pct,
                    growth=growth_str,
                    is_percent_growth=is_pct,
                )
            )

        file_count = len(tempdb_files)
        # Check if sizes are roughly equal (within 5% difference)
        sizing_equal = True
        if sizes and max(sizes) > 0:
            sizing_equal = (max(sizes) - min(sizes)) / max(sizes) <= 0.05

        # 3. CPU Core Count
        cpu_cores = 8
        try:
            cursor.execute("SELECT cpu_count FROM sys.dm_os_sys_info;")
            cpu_row = cursor.fetchone()
            if cpu_row:
                cpu_cores = int(cpu_row[0])
        except Exception:
            pass

        # Recommendation logic
        if cpu_cores <= 8:
            target_files = cpu_cores
        else:
            target_files = 8

        if file_count >= target_files and sizing_equal:
            fc_status = "OPTIMAL"
            fc_rec = f"{file_count} adet eşit boyutlu TempDB veri dosyası mevcut. {cpu_cores} çekirdekli sistem yapılandırması ile tam uyumludur."
        elif not sizing_equal:
            fc_status = "WARNING"
            fc_rec = f"TempDB veri dosyalarının boyutları eşit değil! SQL Server proportional fill algoritmasının doğru çalışması için tüm TempDB dosyalarının boyutları eşitlenmelidir."
        else:
            fc_status = "WARNING"
            fc_rec = f"{cpu_cores} çekirdekli sistemde {file_count} adet TempDB dosyası var. Tahsis çekişmesini (PFS/GAM) önlemek için önerilen dosya sayısı {target_files}'dir."

        # 4. TempDB Allocation Contention (PAGELATCH on GAM/SGAM/PFS)
        contention_query = """
        SELECT COUNT(*) AS contention_count
        FROM sys.dm_os_waiting_tasks wt
        WHERE wt.wait_type LIKE 'PAGELATCH_%'
          AND wt.wait_resource LIKE '2:%';
        """
        cursor.execute(contention_query)
        crow = cursor.fetchone()
        contention_count = int(crow[0]) if crow else 0
        has_contention = contention_count > 0

        if has_contention:
            contention_desc = f"Dikkat: TempDB üzerinde {contention_count} adet PAGELATCH tahsis beklemesi (PFS/GAM/SGAM) tespit edildi! Geçici tablo kullanımı ve dosya sayılarını inceleyin."
        else:
            contention_desc = "TempDB tahsis sayfalarında (PFS, GAM, SGAM) PAGELATCH beklemesi tespit edilmedi. Tahsis performansı mükemmel durumda."

        # 5. Buffer Pool & Memory Performance Counters (PLE, Hit Ratio, Memory)
        ple_query = """
        SELECT 
            RTRIM(counter_name) AS counter_name,
            cntr_value
        FROM sys.dm_os_performance_counters
        WHERE (object_name LIKE '%:Buffer Manager%' AND counter_name IN ('Page life expectancy', 'Buffer cache hit ratio', 'Buffer cache hit ratio base'))
           OR (object_name LIKE '%:Memory Manager%' AND counter_name IN ('Total Server Memory (KB)', 'Target Server Memory (KB)'));
        """
        cursor.execute(ple_query)
        cntr_rows = rows_to_dicts(cursor)
        counters = {r.get("counter_name"): r.get("cntr_value") for r in cntr_rows}

        ple = int(counters.get("Page life expectancy", 300))
        ratio_val = counters.get("Buffer cache hit ratio", 100)
        ratio_base = counters.get("Buffer cache hit ratio base", 100)
        hit_ratio = round((float(ratio_val) / float(ratio_base) * 100.0), 2) if ratio_base and float(ratio_base) > 0 else 99.8

        total_mem_mb = round(float(counters.get("Total Server Memory (KB)", 0)) / 1024.0, 2)
        target_mem_mb = round(float(counters.get("Target Server Memory (KB)", 0)) / 1024.0, 2)
        mem_util_pct = round((total_mem_mb / target_mem_mb * 100.0), 2) if target_mem_mb > 0 else 95.0

        if ple >= 300:
            ple_status = "HEALTHY"
            ple_rec = f"Page Life Expectancy (PLE) {ple} saniye. Standart kritik eşik olan 300 saniyenin üzerindedir; Buffer Pool bellek döngüsü sağlıklıdır."
        elif ple >= 150:
            ple_status = "WARNING"
            ple_rec = f"Page Life Expectancy (PLE) {ple} saniye seviyesinde. Veri sayfaları Buffer Pool'da kısa süre kalıyor; bellek baskısı veya eksik indeks kaynaklı yoğun Table Scan olabilir."
        else:
            ple_status = "CRITICAL"
            ple_rec = f"Kritik: Page Life Expectancy (PLE) {ple} saniyeye düştü! Şiddetli Buffer Pool bellek baskısı yaşanıyor. RAM artırımı veya sorgu optimizasyonu gereklidir."

        # 6. Memory Clerks
        clerks_query = """
        SELECT TOP 10
            type AS clerk_type,
            CAST(ROUND(SUM(pages_kb) / 1024.0, 2) AS FLOAT) AS size_mb
        FROM sys.dm_os_memory_clerks
        GROUP BY type
        HAVING SUM(pages_kb) > 0
        ORDER BY size_mb DESC;
        """
        cursor.execute(clerks_query)
        clerk_rows = rows_to_dicts(cursor)

        sum_clerk_mb = sum(float(c.get("size_mb", 0.0) or 0.0) for c in clerk_rows) or 1.0
        memory_clerks: List[MemoryClerk] = []
        for cr in clerk_rows:
            ctype = cr.get("clerk_type", "")
            sz = float(cr.get("size_mb", 0.0) or 0.0)
            fname = CLERK_FRIENDLY_NAMES.get(ctype, ctype)
            pct = round((sz / sum_clerk_mb * 100.0), 2)
            memory_clerks.append(
                MemoryClerk(
                    clerk_type=ctype,
                    friendly_name=fname,
                    size_mb=sz,
                    percentage_of_total=pct,
                )
            )

        # 7. Buffer Pool Database Distribution (sys.dm_os_buffer_descriptors)
        buffer_pool_dbs: List[BufferPoolDatabaseUsage] = []
        try:
            bp_query = """
            SELECT 
                ISNULL(DB_NAME(database_id), 'Kaynak / Diğer') AS database_name,
                CAST(ROUND(COUNT(*) * 8.0 / 1024.0, 2) AS FLOAT) AS buffer_pool_mb,
                CAST(ROUND(SUM(CASE WHEN is_modified = 1 THEN 1 ELSE 0 END) * 8.0 / 1024.0, 2) AS FLOAT) AS dirty_pages_mb,
                CAST(ROUND(SUM(CASE WHEN is_modified = 0 THEN 1 ELSE 0 END) * 8.0 / 1024.0, 2) AS FLOAT) AS clean_pages_mb,
                COUNT(*) AS total_pages_count
            FROM sys.dm_os_buffer_descriptors
            GROUP BY database_id
            ORDER BY total_pages_count DESC;
            """
            cursor.execute(bp_query)
            bp_rows = rows_to_dicts(cursor)
            tot_bp_mb = sum(float(r.get("buffer_pool_mb") or 0.0) for r in bp_rows) or 1.0
            for r in bp_rows:
                mb = float(r.get("buffer_pool_mb") or 0.0)
                pct = round((mb / tot_bp_mb * 100.0), 2)
                buffer_pool_dbs.append(
                    BufferPoolDatabaseUsage(
                        database_name=str(r.get("database_name") or "Diğer"),
                        buffer_pool_mb=mb,
                        percentage_of_buffer_pool=pct,
                        dirty_pages_mb=float(r.get("dirty_pages_mb") or 0.0),
                        clean_pages_mb=float(r.get("clean_pages_mb") or 0.0),
                        total_pages_count=int(r.get("total_pages_count") or 0),
                    )
                )
        except Exception as bp_err:
            logger.warning("Could not query sys.dm_os_buffer_descriptors: %s", bp_err)
            buffer_pool_dbs = DEMO_TEMPDB_MEMORY_SUMMARY.buffer_pool_db_distribution

        # 8. Buffer Pool Top In-Memory Cached Objects
        buffer_pool_objects: List[BufferPoolTopObject] = []
        try:
            obj_query = """
            SELECT TOP 10
                DB_NAME() AS database_name,
                s.name AS schema_name,
                o.name AS table_name,
                ISNULL(i.name, 'HEAP') AS index_name,
                ISNULL(i.type_desc, 'HEAP') AS index_type,
                CAST(ROUND(COUNT(bd.page_id) * 8.0 / 1024.0, 2) AS FLOAT) AS buffer_mb,
                COUNT(bd.page_id) AS page_count
            FROM sys.dm_os_buffer_descriptors bd
            JOIN sys.allocation_units au ON bd.allocation_unit_id = au.allocation_unit_id
            JOIN sys.partitions p ON au.container_id = p.hobt_id
            JOIN sys.objects o ON p.object_id = o.object_id
            JOIN sys.schemas s ON o.schema_id = s.schema_id
            LEFT JOIN sys.indexes i ON p.object_id = i.object_id AND p.index_id = i.index_id
            WHERE bd.database_id = DB_ID() AND o.is_ms_shipped = 0
            GROUP BY s.name, o.name, i.name, i.type_desc
            ORDER BY page_count DESC;
            """
            cursor.execute(obj_query)
            obj_rows = rows_to_dicts(cursor)
            for obr in obj_rows:
                buffer_pool_objects.append(
                    BufferPoolTopObject(
                        database_name=str(obr.get("database_name") or ""),
                        schema_name=str(obr.get("schema_name") or "dbo"),
                        table_name=str(obr.get("table_name") or ""),
                        index_name=str(obr.get("index_name")) if obr.get("index_name") else None,
                        index_type=str(obr.get("index_type") or "CLUSTERED"),
                        buffer_mb=float(obr.get("buffer_mb") or 0.0),
                        page_count=int(obr.get("page_count") or 0),
                    )
                )
        except Exception as obj_err:
            logger.warning("Could not query top buffer pool objects: %s", obj_err)
            buffer_pool_objects = DEMO_TEMPDB_MEMORY_SUMMARY.buffer_pool_top_objects

        # 9. Ad-Hoc Plan Cache Bloat Analysis (sys.dm_exec_cached_plans)
        plan_cache_bloat: Optional[PlanCacheBloatAnalysis] = None
        try:
            bloat_query = """
            SELECT 
                COUNT(*) AS total_cached_plans,
                ISNULL(SUM(CASE WHEN usecounts = 1 AND objtype = 'Adhoc' THEN 1 ELSE 0 END), 0) AS single_use_adhoc_plans,
                CAST(ROUND(ISNULL(SUM(size_in_bytes), 0) / 1048576.0, 2) AS FLOAT) AS total_cache_mb,
                CAST(ROUND(ISNULL(SUM(CASE WHEN usecounts = 1 AND objtype = 'Adhoc' THEN size_in_bytes ELSE 0 END), 0) / 1048576.0, 2) AS FLOAT) AS wasted_adhoc_mb
            FROM sys.dm_exec_cached_plans;
            """
            cursor.execute(bloat_query)
            bl_row = rows_to_dicts(cursor)[0]

            tot_plans = int(bl_row.get("total_cached_plans") or 0)
            single_plans = int(bl_row.get("single_use_adhoc_plans") or 0)
            single_pct = round((single_plans / tot_plans * 100.0), 2) if tot_plans > 0 else 0.0

            tot_cache_mb = float(bl_row.get("total_cache_mb") or 0.0)
            wasted_mb = float(bl_row.get("wasted_adhoc_mb") or 0.0)
            wasted_pct = round((wasted_mb / tot_cache_mb * 100.0), 2) if tot_cache_mb > 0 else 0.0

            # Check optimize for ad hoc workloads
            adhoc_opt = False
            try:
                cursor.execute("SELECT CAST(value_in_use AS INT) FROM sys.configurations WHERE name = 'optimize for ad hoc workloads';")
                cfg_row = cursor.fetchone()
                if cfg_row:
                    adhoc_opt = bool(cfg_row[0])
            except Exception:
                pass

            if wasted_pct >= 30.0 or single_pct >= 50.0:
                bloat_status = "CRITICAL"
                rec_msg = f"Plan Cache bellek alanının %{wasted_pct}'si ({wasted_mb:.1f} MB) yalnızca bir kez yürütülmüş tek seferlik ad-hoc sorgular tarafından işgal edilmektedir! Parametresiz SQL sorguları değerli sunucu RAM'ini tüketmektedir. 'optimize for ad hoc workloads' ayarı aktif edilmelidir."
            elif wasted_pct >= 15.0 or single_pct >= 30.0:
                bloat_status = "WARNING"
                rec_msg = f"Plan Cache üzerinde {wasted_mb:.1f} MB (%{wasted_pct}) tek kullanımlık plan tespit edildi. 'optimize for ad hoc workloads' ayarının açılması tavsiye edilir."
            else:
                bloat_status = "HEALTHY"
                rec_msg = "Plan Cache dağılımı sağlıklı; tek seferlik planlar makul bir eşiktedir."

            remed_sql = (
                "EXEC sp_configure 'show advanced options', 1;\n"
                "RECONFIGURE;\n"
                "GO\n"
                "EXEC sp_configure 'optimize for ad hoc workloads', 1;\n"
                "RECONFIGURE;\n"
                "GO\n"
                "-- İsteğe bağlı: Bellekteki şişmiş tek kullanımlık ad-hoc planları temizlemek için:\n"
                "-- DBCC FREESYSTEMCACHE('SQL Plans');\n"
                "-- GO"
            )

            plan_cache_bloat = PlanCacheBloatAnalysis(
                total_cached_plans_count=tot_plans,
                single_use_plans_count=single_plans,
                single_use_plans_percent=single_pct,
                total_cache_size_mb=tot_cache_mb,
                wasted_adhoc_mb=wasted_mb,
                wasted_memory_percent=wasted_pct,
                status=bloat_status,
                optimize_for_adhoc_enabled=adhoc_opt,
                recommendation=rec_msg,
                remediation_script=remed_sql,
            )
        except Exception as bl_err:
            logger.warning("Could not query plan cache bloat: %s", bl_err)
            plan_cache_bloat = DEMO_TEMPDB_MEMORY_SUMMARY.plan_cache_bloat

        cursor.close()
        conn.close()

        return TempDBMemorySummary(
            space_breakdown=space_breakdown,
            tempdb_files=tempdb_files,
            file_count=file_count,
            cpu_cores=cpu_cores,
            sizing_equal=sizing_equal,
            file_count_status=fc_status,
            file_count_recommendation=fc_rec,
            allocation_contention_detected=has_contention,
            contention_description=contention_desc,
            page_life_expectancy_sec=ple,
            ple_status=ple_status,
            ple_recommendation=ple_rec,
            buffer_cache_hit_ratio=hit_ratio,
            total_server_memory_mb=total_mem_mb,
            target_server_memory_mb=target_mem_mb,
            memory_utilization_pct=mem_util_pct,
            top_memory_clerks=memory_clerks,
            buffer_pool_db_distribution=buffer_pool_dbs,
            buffer_pool_top_objects=buffer_pool_objects,
            plan_cache_bloat=plan_cache_bloat,
            is_demo=False,
        )

    except Exception as exc:
        logger.error("Failed to query TempDB and memory summary: %s", exc)
        return DEMO_TEMPDB_MEMORY_SUMMARY


def get_memory_grants_summary(params: Optional[ConnectionParams] = None) -> MemoryGrantsSummary:
    """Retrieve active and waiting query memory grants (sys.dm_exec_query_memory_grants)

    and detect RESOURCE_SEMAPHORE wait pressure and memory over-grant waste."""
    conn = get_db_connection(params)
    if not conn:
        logger.info("TempDBMemoryService: No connection, returning demo memory grants.")
        return DEMO_MEMORY_GRANTS_SUMMARY

    try:
        cursor = conn.cursor()
        query = """
        SELECT 
            mg.session_id,
            mg.request_id,
            mg.scheduler_id,
            mg.dop,
            CONVERT(VARCHAR(19), mg.request_time, 120) AS request_time,
            CONVERT(VARCHAR(19), mg.grant_time, 120) AS grant_time,
            CAST(ROUND(mg.requested_memory_kb / 1024.0, 2) AS FLOAT) AS requested_memory_mb,
            CAST(ROUND(mg.granted_memory_kb / 1024.0, 2) AS FLOAT) AS granted_memory_mb,
            CAST(ROUND(mg.required_memory_kb / 1024.0, 2) AS FLOAT) AS required_memory_mb,
            CAST(ROUND(mg.used_memory_kb / 1024.0, 2) AS FLOAT) AS used_memory_mb,
            CAST(ROUND(mg.max_used_memory_kb / 1024.0, 2) AS FLOAT) AS max_used_memory_mb,
            CAST(ROUND(mg.ideal_memory_kb / 1024.0, 2) AS FLOAT) AS ideal_memory_mb,
            CASE WHEN mg.grant_time IS NULL THEN 1 ELSE 0 END AS is_waiting,
            ISNULL(DATEDIFF(MILLISECOND, mg.request_time, ISNULL(mg.grant_time, GETDATE())), 0) AS wait_time_ms,
            ISNULL(mg.resource_semaphore_id, 0) AS resource_semaphore_id,
            ISNULL(SUBSTRING(t.text, (r.statement_start_offset/2)+1, 
                ((CASE r.statement_end_offset WHEN -1 THEN DATALENGTH(t.text) ELSE r.statement_end_offset END - r.statement_start_offset)/2) + 1), t.text) AS query_text
        FROM sys.dm_exec_query_memory_grants mg
        LEFT JOIN sys.dm_exec_requests r ON mg.session_id = r.session_id AND mg.request_id = r.request_id
        OUTER APPLY sys.dm_exec_sql_text(ISNULL(r.sql_handle, mg.plan_handle)) t
        ORDER BY is_waiting DESC, mg.requested_memory_kb DESC;
        """
        cursor.execute(query)
        rows = rows_to_dicts(cursor)
        cursor.close()
        conn.close()

        grants: List[QueryMemoryGrantDetail] = []
        waiting_count = 0
        max_wait_ms = 0

        for r in rows:
            is_wait = bool(r.get("is_waiting", 0))
            w_ms = int(r.get("wait_time_ms", 0) or 0)
            if is_wait:
                waiting_count += 1
                if w_ms > max_wait_ms:
                    max_wait_ms = w_ms

            req_mb = float(r.get("requested_memory_mb", 0.0) or 0.0)
            grant_mb = float(r.get("granted_memory_mb", 0.0) or 0.0)
            max_used_mb = float(r.get("max_used_memory_mb", 0.0) or 0.0)

            waste_pct = 0.0
            if grant_mb > 0:
                waste_pct = max(0.0, round(((grant_mb - max_used_mb) / grant_mb) * 100, 1))

            grants.append(
                QueryMemoryGrantDetail(
                    session_id=int(r.get("session_id", 0)),
                    request_id=int(r.get("request_id", 0)),
                    scheduler_id=int(r.get("scheduler_id", 0)),
                    dop=int(r.get("dop", 1)),
                    request_time=str(r.get("request_time", "")),
                    grant_time=str(r.get("grant_time", "")) or None,
                    requested_memory_mb=req_mb,
                    granted_memory_mb=grant_mb,
                    required_memory_mb=float(r.get("required_memory_mb", 0.0) or 0.0),
                    used_memory_mb=float(r.get("used_memory_mb", 0.0) or 0.0),
                    max_used_memory_mb=max_used_mb,
                    ideal_memory_mb=float(r.get("ideal_memory_mb", 0.0) or 0.0),
                    is_waiting=is_wait,
                    wait_time_ms=w_ms,
                    resource_semaphore_id=int(r.get("resource_semaphore_id", 0)),
                    query_text=str(r.get("query_text", "")).strip() or "-- Metin DMV önbelleğinde bulunamadı",
                    waste_ratio_percent=waste_pct,
                )
            )

        pressure = "HEALTHY"
        if waiting_count > 0 and max_wait_ms > 5000:
            pressure = "CRITICAL_STARVATION"
        elif waiting_count > 0:
            pressure = "PRESSURE_DETECTED"

        return MemoryGrantsSummary(
            total_grant_count=len(grants),
            waiting_grant_count=waiting_count,
            total_granted_mb=round(sum(g.granted_memory_mb for g in grants), 2),
            total_requested_mb=round(sum(g.requested_memory_mb for g in grants), 2),
            semaphore_pressure=pressure,
            grants=grants,
            is_demo=False,
        )
    except Exception as exc:
        logger.error("Failed to query memory grants: %s", exc)
        return DEMO_MEMORY_GRANTS_SUMMARY


def get_tempdb_contention_summary(params: Optional[ConnectionParams] = None) -> TempDBContentionSummary:
    """Detect active PAGELATCH waits on TempDB PFS/GAM/SGAM pages and track session space consumption."""
    conn = get_db_connection(params)
    if not conn:
        logger.info("TempDBMemoryService: No connection, returning demo contention data.")
        return DEMO_TEMPDB_CONTENTION_SUMMARY

    try:
        cursor = conn.cursor()

        # 1. Query active waiting tasks for TempDB (database_id = 2) allocation latches
        latch_query = """
        SELECT 
            wt.session_id,
            wt.wait_type,
            wt.wait_duration_ms,
            wt.resource_description,
            wt.blocking_session_id
        FROM sys.dm_os_waiting_tasks wt
        WHERE wt.wait_type IN ('PAGELATCH_UP', 'PAGELATCH_SH', 'PAGELATCH_EX')
          AND wt.resource_description LIKE '2:%'
        ORDER BY wt.wait_duration_ms DESC;
        """
        cursor.execute(latch_query)
        latch_rows = rows_to_dicts(cursor)

        waiters: List[TempDBContentionWaiter] = []
        pfs_count = 0
        gam_count = 0
        sgam_count = 0

        for lr in latch_rows:
            res = str(lr.get("resource_description", ""))
            # Format is db_id:file_id:page_id e.g. 2:1:1
            parts = res.split(":")
            page_id = 0
            if len(parts) >= 3:
                try:
                    page_id = int(parts[2])
                except ValueError:
                    page_id = 0

            # Determine page type
            if page_id == 1 or (page_id > 0 and page_id % 8088 == 0):
                ptype = "PFS"
                pfs_count += 1
                desc = "PFS (Page Free Space) Sayfa Mandallanması: 8 KB sayfaların doluluk oranı çekişmesi."
            elif page_id == 2 or (page_id > 0 and page_id % 511232 == 0):
                ptype = "GAM"
                gam_count += 1
                desc = "GAM (Global Allocation Map) Tahsis Çekişmesi: Extent tahsis haritasında kuyruk."
            elif page_id == 3 or (page_id > 0 and page_id % 511232 == 1):
                ptype = "SGAM"
                sgam_count += 1
                desc = "SGAM (Shared Global Allocation Map) Çekişmesi: Karışık (mixed) extent tahsis darboğazı."
            else:
                ptype = "DATA_PAGE"
                desc = "TempDB Veri Sayfası Mandallanması."

            waiters.append(
                TempDBContentionWaiter(
                    session_id=int(lr.get("session_id", 0)),
                    wait_type=str(lr.get("wait_type", "")),
                    wait_duration_ms=int(lr.get("wait_duration_ms", 0) or 0),
                    wait_resource=res,
                    page_type=ptype,
                    blocking_session_id=int(lr["blocking_session_id"]) if lr.get("blocking_session_id") else None,
                    status_desc=desc,
                )
            )

        # 2. Top TempDB session space consumers (sys.dm_db_session_space_usage & sys.dm_exec_sessions)
        space_query = """
        SELECT TOP 15
            ssu.session_id,
            s.login_name,
            s.program_name,
            s.host_name,
            s.status AS session_status,
            s.open_transaction_count,
            CAST(ROUND(ssu.user_objects_alloc_page_count * 8.0 / 1024.0, 2) AS FLOAT) AS user_alloc_mb,
            CAST(ROUND(ssu.user_objects_dealloc_page_count * 8.0 / 1024.0, 2) AS FLOAT) AS user_dealloc_mb,
            CAST(ROUND(ssu.internal_objects_alloc_page_count * 8.0 / 1024.0, 2) AS FLOAT) AS internal_alloc_mb,
            CAST(ROUND(ssu.internal_objects_dealloc_page_count * 8.0 / 1024.0, 2) AS FLOAT) AS internal_dealloc_mb
        FROM sys.dm_db_session_space_usage ssu
        JOIN sys.dm_exec_sessions s ON ssu.session_id = s.session_id
        WHERE ssu.session_id > 50
          AND (ssu.user_objects_alloc_page_count > 0 OR ssu.internal_objects_alloc_page_count > 0)
        ORDER BY (ssu.user_objects_alloc_page_count - ssu.user_objects_dealloc_page_count + 
                  ssu.internal_objects_alloc_page_count - ssu.internal_objects_dealloc_page_count) DESC;
        """
        cursor.execute(space_query)
        s_rows = rows_to_dicts(cursor)

        space_consumers: List[TempDBSessionSpaceUsage] = []
        for sr in s_rows:
            spid = int(sr.get("session_id", 0))
            u_alloc = float(sr.get("user_alloc_mb", 0.0) or 0.0)
            u_dealloc = float(sr.get("user_dealloc_mb", 0.0) or 0.0)
            i_alloc = float(sr.get("internal_alloc_mb", 0.0) or 0.0)
            i_dealloc = float(sr.get("internal_dealloc_mb", 0.0) or 0.0)

            u_net = max(0.0, round(u_alloc - u_dealloc, 2))
            i_net = max(0.0, round(i_alloc - i_dealloc, 2))

            status_str = str(sr.get("session_status", "")).lower()
            open_tran = int(sr.get("open_transaction_count", 0) or 0)
            is_sleeping_open = (status_str == "sleeping" and open_tran > 0)

            remed_sql = (
                f"-- SPID {spid} TempDB Alan ve Sorgu İnceleme:\n"
                f"SELECT s.session_id, s.login_name, s.status, t.text\n"
                f"FROM sys.dm_exec_sessions s\n"
                f"LEFT JOIN sys.dm_exec_connections c ON s.session_id = c.session_id\n"
                f"OUTER APPLY sys.dm_exec_sql_text(c.most_recent_sql_handle) t\n"
                f"WHERE s.session_id = {spid};\n"
            )
            if is_sleeping_open or u_net > 500.0:
                remed_sql += f"-- Dikkat: Oturum açık işlemde uyuyor veya aşırı alan tutuyor. Gerekirse:\n-- KILL {spid};"

            space_consumers.append(
                TempDBSessionSpaceUsage(
                    session_id=spid,
                    login_name=str(sr.get("login_name", "")),
                    program_name=str(sr.get("program_name", "")),
                    host_name=str(sr.get("host_name", "")),
                    user_objects_alloc_mb=u_alloc,
                    user_objects_dealloc_mb=u_dealloc,
                    user_net_mb=u_net,
                    internal_objects_alloc_mb=i_alloc,
                    internal_objects_dealloc_mb=i_dealloc,
                    internal_net_mb=i_net,
                    is_sleeping_open_tran=is_sleeping_open,
                    remediation_sql=remed_sql,
                )
            )

        tot_waiters = len(waiters)
        has_cont = tot_waiters > 0
        severity = "HEALTHY"
        if pfs_count > 0 or sgam_count > 0 or gam_count > 0:
            severity = "CRITICAL" if tot_waiters > 5 else "WARNING"

        rec_action = (
            "TempDB tahsis sayfalarında aktif mandallanma bulunmuyor."
            if not has_cont else
            f"TempDB üzerinde {tot_waiters} aktif mandal beklemesi (PFS: {pfs_count}, SGAM: {sgam_count}, GAM: {gam_count}) tespit edildi. Eşit boyutlu veri dosyaları ve AUTOGROW_ALL_FILES yapılandırmasını kontrol edin."
        )

        remed_t_sql = (
            "-- TempDB Çoklu Veri Dosyası ve Eşit Boyutlandırma Kontrolü:\n"
            "ALTER DATABASE tempdb MODIFY FILEGROUP [PRIMARY] AUTOGROW_ALL_FILES;\n"
            "-- Her veri dosyasının aynı boyuta ve sabit artışa (örn. 1024 MB) sahip olduğundan emin olun."
        )

        return TempDBContentionSummary(
            has_contention=has_cont,
            contention_severity=severity,
            pfs_wait_count=pfs_count,
            gam_wait_count=gam_count,
            sgam_wait_count=sgam_count,
            total_active_waiters=tot_waiters,
            recommended_action=rec_action,
            remediation_sql=remed_t_sql,
            waiters=waiters,
            top_space_consumers=space_consumers,
            is_demo=False,
        )
    except Exception as exc:
        logger.error("Failed to query tempdb contention summary: %s", exc)
        return DEMO_TEMPDB_CONTENTION_SUMMARY


