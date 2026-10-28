"""services/wait_stats_service.py — SQL Server Wait Statistics, CPU scheduling pressure, and bottleneck detection."""
from __future__ import annotations

import logging
from collections import defaultdict
from typing import List, Optional

from app.db.connection import ConnectionParams, get_db_connection, rows_to_dicts
from app.schemas.wait_stats import (
    CategoryWaitSummary,
    WaitStatEntry,
    WaitStatsSummary,
)
from app.services.demo_data import DEMO_WAIT_STATS_SUMMARY

logger = logging.getLogger(__name__)

# Standard harmless background wait types to exclude
IGNORABLE_WAITS = (
    'SLEEP_TASK', 'BROKER_TO_FLUSH', 'BROKER_TASK_STOP', 'CLR_AUTO_EVENT',
    'DISPATCHER_QUEUE_SEMAPHORE', 'FT_IFTS_SCHEDULER_IDLE_WAIT',
    'HADR_WORK_QUEUE', 'HADR_FILESTREAM_IOMGR_IOCOMPLETION',
    'LAZYWRITER_SLEEP', 'LOGMGR_QUEUE', 'ONDEMAND_TASK_QUEUE',
    'REQUEST_FOR_DEADLOCK_SEARCH', 'RESOURCE_QUEUE', 'SERVER_IDLE_CHECK',
    'SLEEP_DBSTARTUP', 'SLEEP_DCOMSTARTUP', 'SLEEP_MASTERDBREADY',
    'SLEEP_MASTERMDREADY', 'SLEEP_MASTERUPGRADED', 'SLEEP_MSDBSTARTUP',
    'SLEEP_TEMPDBSTARTUP', 'SNI_HTTP_ACCEPT', 'SP_SERVER_DIAGNOSTICS_SLEEP',
    'SQLTRACE_BUFFER_FLUSH', 'SQLTRACE_INCREMENTAL_FLUSH_SLEEP',
    'WAIT_XTP_OFFLINE_CKPT_NEW_LOG', 'WAITFOR', 'XE_DISPATCHER_WAIT',
    'XE_TIMER_EVENT', 'BROKER_EVENTHANDLER', 'CHECKPOINT_QUEUE',
    'DBMIRROR_EVENTS_QUEUE', 'SQLTRACE_WAIT_ENTRIES', 'DIRTY_PAGE_POLL',
    'PREEMPTIVE_OS_AUTHENTICATIONOPS', 'QDS_PERSIST_TASK_MAIN_LOOP_SLEEP',
    'QDS_CLEANUP_STALE_QUERIES_TASK_MAIN_LOOP_SLEEP'
)

WAIT_EXPLANATIONS = {
    "PAGEIOLATCH_SH": (
        "Veri sayfaları disk depolama biriminden RAM önbelleğine (Buffer Pool) okunurken oluşan bekleme.",
        "Buffer Pool RAM yetersizliği veya eksik indekslerden kaynaklanan aşırı Table Scan taramalarını inceleyin."
    ),
    "PAGEIOLATCH_EX": (
        "Veri sayfaları diske yazılırken oluşan I/O beklemesi.",
        "Disk depolama biriminizin yazma gecikmesini (write latency) ve I/O darboğazlarını denetleyin."
    ),
    "WRITELOG": (
        "İşlemler (Transaction) tamamlanırken Transaction Log (LDF) verisinin diske fiziksel olarak flush edilmesi beklemesi.",
        "Log diskinin IOPS kapasitesini, aşırı sık küçük transaction commit döngülerini veya log autogrowth gecikmelerini denetleyin."
    ),
    "CXPACKET": (
        "Paralel çalışan sorgu iş parçacıklarının birbirini beklemesi (senkronizasyon).",
        "Sistemdeki MAXDOP veya Cost Threshold for Parallelism (CTP) yapılandırma parametrelerini optimize edin."
    ),
    "CXCONSUMER": (
        "Paralel sorguda tüketici (consumer) thread'in üretici (producer) thread'leri beklemesi.",
        "Genellikle normal kabul edilir; CXPACKET ile birlikte yüksekse paralellik parametrelerini denetleyin."
    ),
    "SOS_SCHEDULER_YIELD": (
        "Çalışan bir iş parçacığının kendi isteğiyle CPU kuantum süresini bırakıp CPU scheduler kuyruğuna geçmesi.",
        "Yoğun CPU tüketen sorguların yürütme planlarını inceleyin; CPU baskısı belirtisi olabilir."
    ),
    "ASYNC_NETWORK_IO": (
        "SQL Server veriyi üretmiş ancak istemci uygulamanın sonuç kümesini (resultset) ağ üzerinden yavaş okuması.",
        "Uygulama katmanındaki satır satır işleme (row-by-row fetching) döngülerini ve istemci-veritabanı arasındaki ağ gecikmesini denetleyin."
    ),
    "LCK_M_X": (
        "Özel (Exclusive) kilit beklemesi. Başka bir oturum aynı kaynağı tuttuğu için işlem beklemeye alınmış.",
        "Uzun süren açık transaction'ları, blocking zincirlerini ve uygun izolasyon seviyelerini (RCSI) gözden geçirin."
    ),
    "LCK_M_S": (
        "Paylaşılan (Shared) kilit beklemesi. Başka bir işlem yazma kilidi tuttuğu için SELECT işlemi bekliyor.",
        "Engelleme zincirlerini (Blocking) ve Snapshot Isolation (RCSI) etkinleştirme seçeneğini inceleyin."
    ),
    "RESOURCE_SEMAPHORE": (
        "Sorgu yürütme için talep edilen çalışma belleği (Query Workspace Memory) tahsisatının beklenmesi.",
        "Büyük SORT ve HASH işlemlerini denetleyin; aşırı bellek isteyen sorguları optimize edin."
    ),
}


def _categorize_wait(wait_type: str) -> str:
    wt = wait_type.upper()
    if wt.startswith("PAGEIOLATCH") or wt in ("WRITELOG", "ASYNC_IO_COMPLETION", "IO_COMPLETION"):
        return "Disk I/O"
    if wt.startswith("CXPACKET") or wt.startswith("CXCONSUMER"):
        return "Parallelism"
    if wt.startswith("LCK_") or wt.startswith("PAGELATCH") or wt.startswith("LATCH"):
        return "Locks & Latches"
    if wt.startswith("SOS_SCHEDULER") or wt in ("THREADPOOL",):
        return "CPU"
    if wt == "ASYNC_NETWORK_IO":
        return "Network"
    if wt.startswith("RESOURCE_SEMAPHORE") or wt.startswith("CMEMTHREAD"):
        return "Memory"
    return "Diğer"


def get_wait_statistics(params: ConnectionParams) -> WaitStatsSummary:
    """Retrieve actionable wait statistics from SQL Server sys.dm_os_wait_stats."""
    try:
        with get_db_connection(params) as conn:
            cursor = conn.cursor()
            query = """
            SELECT TOP 50
                wait_type,
                waiting_tasks_count,
                wait_time_ms,
                max_wait_time_ms,
                signal_wait_time_ms,
                wait_time_ms - signal_wait_time_ms AS resource_wait_ms
            FROM sys.dm_os_wait_stats
            WHERE wait_type NOT IN (
                'SLEEP_TASK','BROKER_TO_FLUSH','BROKER_TASK_STOP','CLR_AUTO_EVENT',
                'DISPATCHER_QUEUE_SEMAPHORE','FT_IFTS_SCHEDULER_IDLE_WAIT',
                'HADR_WORK_QUEUE','HADR_FILESTREAM_IOMGR_IOCOMPLETION',
                'LAZYWRITER_SLEEP','LOGMGR_QUEUE','ONDEMAND_TASK_QUEUE',
                'REQUEST_FOR_DEADLOCK_SEARCH','RESOURCE_QUEUE','SERVER_IDLE_CHECK',
                'SLEEP_DBSTARTUP','SLEEP_DCOMSTARTUP','SLEEP_MASTERDBREADY',
                'SLEEP_MASTERMDREADY','SLEEP_MASTERUPGRADED','SLEEP_MSDBSTARTUP',
                'SLEEP_TEMPDBSTARTUP','SNI_HTTP_ACCEPT','SP_SERVER_DIAGNOSTICS_SLEEP',
                'SQLTRACE_BUFFER_FLUSH','SQLTRACE_INCREMENTAL_FLUSH_SLEEP',
                'WAIT_XTP_OFFLINE_CKPT_NEW_LOG','WAITFOR','XE_DISPATCHER_WAIT',
                'XE_TIMER_EVENT','BROKER_EVENTHANDLER','CHECKPOINT_QUEUE',
                'DBMIRROR_EVENTS_QUEUE','SQLTRACE_WAIT_ENTRIES','DIRTY_PAGE_POLL',
                'PREEMPTIVE_OS_AUTHENTICATIONOPS','QDS_PERSIST_TASK_MAIN_LOOP_SLEEP',
                'QDS_CLEANUP_STALE_QUERIES_TASK_MAIN_LOOP_SLEEP'
            )
            AND wait_time_ms > 0
            ORDER BY wait_time_ms DESC;
            """
            cursor.execute(query)
            rows = rows_to_dicts(cursor)

            if not rows:
                return DEMO_WAIT_STATS_SUMMARY

            total_wait_ms = sum(float(r.get("wait_time_ms") or 0) for r in rows)
            total_signal_ms = sum(float(r.get("signal_wait_time_ms") or 0) for r in rows)
            total_tasks = sum(int(r.get("waiting_tasks_count") or 0) for r in rows)

            if total_wait_ms == 0:
                return DEMO_WAIT_STATS_SUMMARY

            signal_ratio = round((total_signal_ms / total_wait_ms) * 100, 2)
            has_cpu_pressure = signal_ratio > 15.0

            category_sums = defaultdict(float)
            category_counts = defaultdict(int)
            stat_entries = []

            for r in rows:
                wt = r.get("wait_type", "UNKNOWN")
                w_ms = float(r.get("wait_time_ms") or 0)
                sig_ms = float(r.get("signal_wait_time_ms") or 0)
                res_ms = float(r.get("resource_wait_ms") or 0)
                tasks = int(r.get("waiting_tasks_count") or 0)
                max_ms = float(r.get("max_wait_time_ms") or 0)

                cat = _categorize_wait(wt)
                category_sums[cat] += w_ms
                category_counts[cat] += tasks

                pct_total = round((w_ms / total_wait_ms) * 100, 2) if total_wait_ms > 0 else 0.0
                sig_pct = round((sig_ms / w_ms) * 100, 2) if w_ms > 0 else 0.0

                desc, rec = WAIT_EXPLANATIONS.get(
                    wt,
                    (f"{wt} türü genel sunucu beklemesi.", "Detaylı analiz için yürütülen sorguları ve DMV loglarını inceleyin.")
                )

                stat_entries.append(
                    WaitStatEntry(
                        wait_type=wt,
                        category=cat,
                        waiting_tasks_count=tasks,
                        wait_time_ms=w_ms,
                        wait_time_sec=round(w_ms / 1000.0, 2),
                        max_wait_time_ms=max_ms,
                        signal_wait_time_ms=sig_ms,
                        signal_wait_percent=sig_pct,
                        resource_wait_ms=res_ms,
                        percentage_of_total=pct_total,
                        description=desc,
                        recommendation=rec,
                    )
                )

            cat_summaries = [
                CategoryWaitSummary(
                    category=c,
                    total_wait_ms=round(val, 2),
                    percentage=round((val / total_wait_ms) * 100, 2),
                    wait_count=category_counts[c],
                )
                for c, val in sorted(category_sums.items(), key=lambda x: x[1], reverse=True)
            ]

            top_cat = cat_summaries[0].category if cat_summaries else "Bilinmiyor"

            return WaitStatsSummary(
                total_wait_time_ms=round(total_wait_ms, 2),
                total_signal_wait_ms=round(total_signal_ms, 2),
                signal_wait_ratio_percent=signal_ratio,
                has_cpu_pressure=has_cpu_pressure,
                top_category=top_cat,
                total_waiting_tasks=total_tasks,
                categories=cat_summaries,
                wait_stats=stat_entries,
                is_demo=False,
            )
    except Exception as exc:
        logger.warning("Could not fetch live wait statistics, falling back to demo: %s", exc)
        return DEMO_WAIT_STATS_SUMMARY
