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
)
from app.services.demo_data import DEMO_TEMPDB_MEMORY_SUMMARY

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
            is_demo=False,
        )

    except Exception as exc:
        logger.error("Failed to query TempDB and memory summary: %s", exc)
        return DEMO_TEMPDB_MEMORY_SUMMARY
