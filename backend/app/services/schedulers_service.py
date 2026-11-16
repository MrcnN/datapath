"""services/schedulers_service.py — CPU SOS Schedulers & Worker Thread Pool Service."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List
import pyodbc

from app.db.connection import ConnectionParams, get_db_connection, rows_to_dicts
from app.schemas.schedulers import (
    SchedulerCoreItem,
    NumaNodeItem,
    ThreadPoolSummary,
    SchedulersResponse,
)

logger = logging.getLogger(__name__)


def get_schedulers_analysis(params: ConnectionParams) -> SchedulersResponse:
    """Analyze SQL Server CPU SOS Schedulers, Worker Thread Pool utilization,
    and NUMA node workload distribution from live DMVs.
    """
    schedulers: List[SchedulerCoreItem] = []
    numa_nodes: List[NumaNodeItem] = []

    cpu_count = 4
    socket_count = 1
    max_workers = 512
    visible_online = 4

    try:
        with get_db_connection(params) as conn:
            cursor = conn.cursor()

            # 1. System Info (CPUs, Workers, Sockets)
            try:
                cursor.execute("""
                SELECT 
                    cpu_count, 
                    hyperthread_ratio, 
                    socket_count, 
                    max_workers_count, 
                    scheduler_count
                FROM sys.dm_os_sys_info;
                """)
                row = cursor.fetchone()
                if row:
                    cpu_count = int(row[0] or 4)
                    socket_count = int(row[2] or 1)
                    max_workers = int(row[3] or 512)
            except Exception as e:
                logger.warning("Could not query sys.dm_os_sys_info: %s", e)

            # 2. Schedulers (Visible Online)
            try:
                cursor.execute("""
                SELECT 
                    scheduler_id,
                    cpu_id,
                    parent_node_id AS numa_node_id,
                    status,
                    is_idle,
                    current_tasks_count,
                    runnable_tasks_count,
                    current_workers_count,
                    active_workers_count,
                    work_queue_count,
                    pending_disk_io_count,
                    yield_count,
                    load_factor
                FROM sys.dm_os_schedulers
                WHERE status = 'VISIBLE ONLINE'
                ORDER BY scheduler_id ASC;
                """)
                s_rows = rows_to_dicts(cursor)
                for r in s_rows:
                    sid = int(r.get("scheduler_id") or 0)
                    cid = int(r.get("cpu_id") or 0)
                    nid = int(r.get("numa_node_id") or 0)
                    stat = str(r.get("status") or "VISIBLE ONLINE")
                    idle = bool(r.get("is_idle", 0))
                    c_tasks = int(r.get("current_tasks_count") or 0)
                    r_tasks = int(r.get("runnable_tasks_count") or 0)
                    c_workers = int(r.get("current_workers_count") or 0)
                    a_workers = int(r.get("active_workers_count") or 0)
                    w_queue = int(r.get("work_queue_count") or 0)
                    p_io = int(r.get("pending_disk_io_count") or 0)
                    y_cnt = int(r.get("yield_count") or 0)
                    l_fac = int(r.get("load_factor") or 0)

                    # Health of individual scheduler core
                    if w_queue > 0 or r_tasks >= 3:
                        core_health = "CRITICAL"
                    elif r_tasks >= 1 or p_io > 50:
                        core_health = "WARNING"
                    else:
                        core_health = "HEALTHY"

                    schedulers.append(SchedulerCoreItem(
                        scheduler_id=sid,
                        cpu_id=cid,
                        numa_node_id=nid,
                        status=stat,
                        is_idle=idle,
                        current_tasks_count=c_tasks,
                        runnable_tasks_count=r_tasks,
                        current_workers_count=c_workers,
                        active_workers_count=a_workers,
                        work_queue_count=w_queue,
                        pending_disk_io_count=p_io,
                        yield_count=y_cnt,
                        load_factor=l_fac,
                        health_status=core_health,
                    ))
            except Exception as e:
                logger.error("Error querying sys.dm_os_schedulers: %s", e)

            # 3. NUMA Nodes
            try:
                cursor.execute("""
                SELECT 
                    node_id,
                    node_state_desc AS node_state,
                    memory_node_id,
                    cpu_count,
                    online_scheduler_count,
                    active_worker_count,
                    avg_load_factor
                FROM sys.dm_os_nodes
                WHERE node_state_desc <> 'ONLINE DAC'
                ORDER BY node_id ASC;
                """)
                n_rows = rows_to_dicts(cursor)
                for nr in n_rows:
                    numa_nodes.append(NumaNodeItem(
                        node_id=int(nr.get("node_id") or 0),
                        node_state=str(nr.get("node_state") or "ONLINE"),
                        memory_node_id=int(nr.get("memory_node_id") or 0),
                        cpu_count=int(nr.get("cpu_count") or 0),
                        online_scheduler_count=int(nr.get("online_scheduler_count") or 0),
                        active_worker_count=int(nr.get("active_worker_count") or 0),
                        avg_load_factor=float(nr.get("avg_load_factor") or 0.0),
                    ))
            except Exception as e:
                logger.warning("Error querying sys.dm_os_nodes: %s", e)

    except Exception as exc:
        logger.error("Failed to collect scheduler telemetry: %s", exc)

    # Compute Summary
    visible_online = len(schedulers)
    tot_active_workers = sum(s.active_workers_count for s in schedulers)
    worker_util_pct = round((tot_active_workers / max(1, max_workers)) * 100.0, 1)
    tot_work_queue = sum(s.work_queue_count for s in schedulers)
    tot_runnable = sum(s.runnable_tasks_count for s in schedulers)
    avg_runnable = round(tot_runnable / max(1, visible_online), 2)
    tot_pending_io = sum(s.pending_disk_io_count for s in schedulers)

    has_starvation = tot_work_queue > 0 or worker_util_pct >= 90.0
    has_cpu_queue = avg_runnable >= 1.0

    if has_starvation or any(s.health_status == "CRITICAL" for s in schedulers):
        overall_health = "CRITICAL"
        verdict = (
            f"Kritik İş Parçacığı / CPU Tıkanması: {tot_work_queue} görev iş parçacığı sırası (work_queue) bekliyor! "
            f"İş parçacığı havuzu doluluk oranı %{worker_util_pct}. THREADPOOL beklemesi ve bağlantı reddi riski mevcut."
        )
    elif has_cpu_queue or any(s.health_status == "WARNING" for s in schedulers):
        overall_health = "WARNING"
        verdict = (
            f"Orta Düzey CPU Kuyruklanması: Çekirdek başına ortalama {avg_runnable} runnable görev hazır bekliyor. "
            f"Sorgular SOS_SCHEDULER_YIELD beklemesinde CPU devretmek zorunda kalıyor."
        )
    else:
        overall_health = "HEALTHY"
        verdict = (
            f"Zamanlayıcı ve İş Parçacığı Havuzu Dengeli: {visible_online} adet çevrimiçi çekirdekte kuyrukta bekleyen görev yok (0). "
            f"Worker havuzu doluluk oranı %{worker_util_pct} seviyesinde stabil."
        )

    summary = ThreadPoolSummary(
        max_workers_count=max_workers,
        total_active_workers=tot_active_workers,
        worker_utilization_pct=worker_util_pct,
        total_work_queue_count=tot_work_queue,
        total_runnable_tasks=tot_runnable,
        avg_runnable_per_scheduler=avg_runnable,
        total_pending_disk_io=tot_pending_io,
        visible_online_schedulers=visible_online,
        logical_cpu_count=cpu_count,
        socket_count=socket_count,
        numa_nodes_count=len(numa_nodes) or 1,
        has_threadpool_starvation=has_starvation,
        has_cpu_queue_pressure=has_cpu_queue,
        overall_health=overall_health,
        verdict=verdict,
        evaluated_at=datetime.now(timezone.utc).isoformat(),
    )

    # Remediation Runbook T-SQL
    remediation_runbook = f"""/*
================================================================================
 DATAPATH — CPU SOS ZAMANLAYICILARI VE İŞ PARÇACIĞI HAVUZU İYİLEŞTİRME REÇETESİ
 Değerlendirme Tarihi: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}
 Mevcut Durum: {overall_health} | Worker Doluluk: %{worker_util_pct} ({tot_active_workers}/{max_workers})
================================================================================
*/

-- 1. Canlı İş Parçacığı ve Bekleyen Kuyruk Durumunu İnceleyin
SELECT 
    scheduler_id,
    cpu_id,
    parent_node_id AS numa_node,
    status,
    is_idle,
    current_tasks_count,
    runnable_tasks_count,
    active_workers_count,
    work_queue_count,
    pending_disk_io_count
FROM sys.dm_os_schedulers
WHERE status = 'VISIBLE ONLINE'
ORDER BY work_queue_count DESC, runnable_tasks_count DESC;

-- 2. Max Worker Threads Yapılandırmasını Doğrulayın (0 = Otomatik Hesaplama)
EXEC sp_configure 'show advanced options', 1;
RECONFIGURE WITH OVERRIDE;
EXEC sp_configure 'max worker threads';

-- Öneri: max worker threads değerini manuel şişirmek yerine (örn. 2048)
-- kök nedeni (bloke edici uzun işlemler, paralel sorgu patlaması) çözünüz.

-- 3. Paralellik Maliyet Eşiği ve MAXDOP Ayarı (Varsayılan 5 çok düşüktür!)
-- Çok çekirdekli sistemlerde 'cost threshold for parallelism' en az 25-50 olmalıdır.
EXEC sp_configure 'cost threshold for parallelism', 50;
-- MAXDOP değeri fiziksel NUMA çekirdek sayısını aşmamalıdır (Önerilen: 4 veya 8):
EXEC sp_configure 'max degree of parallelism', {min(8, max(2, cpu_count // max(1, socket_count)))};
RECONFIGURE WITH OVERRIDE;

-- 4. Aktif Olarak THREADPOOL veya SOS_SCHEDULER_YIELD Bekleyen Oturumları İnceleyin
SELECT 
    session_id,
    wait_type,
    wait_time,
    wait_resource,
    blocking_session_id
FROM sys.dm_os_waiting_tasks
WHERE wait_type IN ('THREADPOOL', 'SOS_SCHEDULER_YIELD', 'CXPACKET', 'CXCONSUMER')
ORDER BY wait_time DESC;
"""

    return SchedulersResponse(
        summary=summary,
        schedulers=schedulers,
        numa_nodes=numa_nodes,
        remediation_runbook=remediation_runbook,
    )
