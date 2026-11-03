"""services/triage_service.py — 1-Click fast emergency incident root-cause triage engine."""
from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import List, Tuple
import pyodbc

from app.db.connection import get_connection
from app.schemas.triage import TriageFinding, TriageResponse

logger = logging.getLogger(__name__)


def run_emergency_triage() -> TriageResponse:
    start_time = time.perf_counter()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    findings: List[TriageFinding] = []
    server_name = "SQL Server"

    try:
        with get_connection() as conn:
            cursor = conn.cursor()

            # Server Name
            try:
                cursor.execute("SELECT @@SERVERNAME;")
                r = cursor.fetchone()
                if r and r[0]:
                    server_name = str(r[0])
            except Exception:
                pass

            # ── 1. Blocking & Root Blocker ──────────────────────────────────────────
            blocking_finding, blocking_sql = _check_blocking(cursor)
            if blocking_finding:
                findings.append(blocking_finding)

            # ── 2. Sleeping Open Transactions ───────────────────────────────────────
            tran_finding, tran_sql = _check_sleeping_open_trans(cursor)
            if tran_finding:
                findings.append(tran_finding)

            # ── 3. Memory Grants Pending (RESOURCE_SEMAPHORE) ──────────────────────
            mem_finding, mem_sql = _check_memory_grants(cursor)
            if mem_finding:
                findings.append(mem_finding)

            # ── 4. CPU Runaway Queries ──────────────────────────────────────────────
            cpu_finding, cpu_sql = _check_cpu_pressure(cursor)
            if cpu_finding:
                findings.append(cpu_finding)

            # ── 5. TempDB Allocation Contention ─────────────────────────────────────
            tempdb_finding, tempdb_sql = _check_tempdb_latch(cursor)
            if tempdb_finding:
                findings.append(tempdb_finding)

            # ── 6. Disk I/O Virtual File Stalls ─────────────────────────────────────
            io_finding, io_sql = _check_io_stalls(cursor)
            if io_finding:
                findings.append(io_finding)

            # ── 7. Suspect Pages (Hardware corruption) ──────────────────────────────
            integrity_finding, integrity_sql = _check_suspect_pages(cursor)
            if integrity_finding:
                findings.append(integrity_finding)

            # Calculate Verdict and prioritize primary bottleneck
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

            has_critical = any(f.severity == "CRITICAL" for f in findings)
            has_warning = any(f.severity == "WARNING" for f in findings)

            overall_status = "CRITICAL" if has_critical else ("WARNING" if has_warning else "HEALTHY")

            verdict_title, verdict_summary, primary_bottleneck, remediation_sql = _formulate_verdict(
                findings, blocking_sql, tran_sql, mem_sql, cpu_sql, tempdb_sql, io_sql, integrity_sql
            )

            return TriageResponse(
                overall_status=overall_status,
                verdict_title=verdict_title,
                verdict_summary=verdict_summary,
                primary_bottleneck=primary_bottleneck,
                remediation_sql=remediation_sql,
                findings=findings,
                server_name=server_name,
                analyzed_at=now_str,
                duration_ms=duration_ms,
                is_live=True,
            )

    except Exception as exc:
        logger.error("Emergency triage failed on live connection: %s", exc)
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return TriageResponse(
            overall_status="CRITICAL",
            verdict_title="Canlı Veritabanı Bağlantı Hatası",
            verdict_summary=f"Kriz triyajı canlı SQL Server bağlantısı kurulamadığı için tamamlanamadı: {str(exc)}",
            primary_bottleneck="DATABASE_CONNECTIVITY_FAILURE",
            remediation_sql="-- SQL Server servis durumunu ve ağ bağlantısını doğrulayın.",
            findings=[],
            server_name=server_name,
            analyzed_at=now_str,
            duration_ms=duration_ms,
            is_live=False,
        )


def _check_blocking(cursor: pyodbc.Cursor) -> Tuple[TriageFinding | None, str]:
    query = """
    SELECT
        r.session_id,
        r.blocking_session_id,
        r.wait_type,
        r.wait_time,
        s.login_name,
        s.host_name,
        DB_NAME(r.database_id) AS db_name
    FROM sys.dm_exec_requests r
    JOIN sys.dm_exec_sessions s ON s.session_id = r.session_id
    WHERE r.blocking_session_id <> 0;
    """
    cursor.execute(query)
    rows = cursor.fetchall()
    if not rows:
        return TriageFinding(
            category="BLOCKING",
            severity="HEALTHY",
            title="Kilitlenme Zinciri Yok",
            metric_value="0 Kilitli Oturum",
            evidence=["Aktif oturumlar arasında kilit kuyruğu tespit edilmedi."],
            affected_spids=[],
        ), ""

    blocked_spids = [int(r[0]) for r in rows]
    blocker_spids = list(set([int(r[1]) for r in rows]))

    remediation = f"""-- ⚠️ KÖK BLOKLAYICI DETAY VE İNCELEME REÇETESİ
-- Bloke eden kök oturum: SPID {blocker_spids[0]}
DBCC INPUTBUFFER ({blocker_spids[0]});

SELECT
    s.session_id,
    s.login_name,
    s.host_name,
    s.status,
    s.open_transaction_count,
    t.text AS current_sql
FROM sys.dm_exec_sessions s
LEFT JOIN sys.dm_exec_requests r ON r.session_id = s.session_id
OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE s.session_id = {blocker_spids[0]};

-- Gerekirse kontrollü sonlandırma (Review-Only):
-- KILL {blocker_spids[0]};
"""

    return TriageFinding(
        category="BLOCKING",
        severity="CRITICAL",
        title=f"Kritik Kilitlenme: {len(blocked_spids)} Oturum Kilitli",
        metric_value=f"{len(blocked_spids)} Oturum Bekliyor (Kök: SPID {blocker_spids[0]})",
        evidence=[
            f"Kök engelleyici SPID: {blocker_spids[0]}",
            f"Engellenen SPID'ler: {', '.join(map(str, blocked_spids[:8]))}",
            f"Kilit bekleme türü: {rows[0][2]} ({rows[0][3]} ms)",
        ],
        affected_spids=blocked_spids + blocker_spids,
    ), remediation


def _check_sleeping_open_trans(cursor: pyodbc.Cursor) -> Tuple[TriageFinding | None, str]:
    query = """
    SELECT
        s.session_id,
        s.login_name,
        s.host_name,
        s.program_name,
        s.open_transaction_count,
        DATEDIFF(MINUTE, s.last_request_end_time, GETDATE()) AS idle_minutes
    FROM sys.dm_exec_sessions s
    WHERE s.open_transaction_count > 0
      AND s.status = 'sleeping'
      AND s.is_user_process = 1;
    """
    cursor.execute(query)
    rows = cursor.fetchall()
    if not rows:
        return TriageFinding(
            category="TRANSACTIONS",
            severity="HEALTHY",
            title="Askıda Kalan İşlem Yok",
            metric_value="0 Sleeping Tran",
            evidence=["Açık uncommitted transaction bırakan uyuyan oturum bulunmuyor."],
            affected_spids=[],
        ), ""

    spids = [int(r[0]) for r in rows]
    worst = rows[0]
    idle_min = worst[5] or 0

    remediation = f"""-- ⚠️ SAHİPSİZ AÇIK İŞLEM İNCELEME
-- SPID {worst[0]} {idle_min} dakikadır uncommitted açık transaction tutuyor.
SELECT * FROM sys.dm_tran_active_transactions;
DBCC INPUTBUFFER ({worst[0]});

-- KILL {worst[0]}; -- İlgili uygulama oturumunu sonlandırmak için
"""

    return TriageFinding(
        category="TRANSACTIONS",
        severity="CRITICAL" if idle_min > 5 else "WARNING",
        title=f"Askıda Kalan Açık İşlem ({len(rows)} Oturum)",
        metric_value=f"SPID {worst[0]} ({idle_min} dk boşta)",
        evidence=[
            f"SPID {worst[0]} ({worst[1]} @ {worst[2]}) {idle_min} dakikadır boşta ancak open_transaction_count={worst[4]}.",
            "Bu durum Transaction Log kesilmesini (log_reuse_wait) engeller ve kilitlenmelere yol açar.",
        ],
        affected_spids=spids,
    ), remediation


def _check_memory_grants(cursor: pyodbc.Cursor) -> Tuple[TriageFinding | None, str]:
    query = """
    SELECT
        COUNT(*) AS waiting_queries,
        ISNULL(SUM(requested_memory_kb) / 1024, 0) AS requested_mb
    FROM sys.dm_exec_query_memory_grants
    WHERE grant_time IS NULL;
    """
    cursor.execute(query)
    row = cursor.fetchone()
    wait_count = int(row[0] or 0) if row else 0
    req_mb = int(row[1] or 0) if row else 0

    if wait_count == 0:
        return TriageFinding(
            category="MEMORY",
            severity="HEALTHY",
            title="Bellek Kuyruğu Temiz",
            metric_value="0 Bekleyen Hibe",
            evidence=["RESOURCE_SEMAPHORE sırasında bekleyen sorgu yok."],
            affected_spids=[],
        ), ""

    remediation = """-- ⚠️ RESOURCE_SEMAPHORE BELLEK BEKLEYEN SORGULARI İNCELEME
SELECT
    session_id,
    request_time,
    requested_memory_kb / 1024 AS req_mb,
    granted_memory_kb / 1024 AS granted_mb,
    wait_time_ms,
    wait_order
FROM sys.dm_exec_query_memory_grants
WHERE grant_time IS NULL
ORDER BY wait_order;
"""

    return TriageFinding(
        category="MEMORY",
        severity="CRITICAL",
        title=f"Kritik Bellek Kuyruğu: {wait_count} Sorgu Bekliyor",
        metric_value=f"{wait_count} Sorgu ({req_mb} MB RAM Talebi)",
        evidence=[
            f"Toplam {wait_count} adet sorgu çalışma belleği (RESOURCE_SEMAPHORE) için sırada bekletiliyor.",
            f"Talep edilen anlık bellek: {req_mb} MB.",
        ],
        affected_spids=[],
    ), remediation


def _check_cpu_pressure(cursor: pyodbc.Cursor) -> Tuple[TriageFinding | None, str]:
    query = """
    SELECT TOP 3
        r.session_id,
        r.cpu_time,
        r.total_elapsed_time,
        s.login_name,
        SUBSTRING(t.text, 1, 200) AS sql_snippet
    FROM sys.dm_exec_requests r
    JOIN sys.dm_exec_sessions s ON s.session_id = r.session_id
    OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t
    WHERE r.status = 'running'
      AND r.cpu_time > 15000
    ORDER BY r.cpu_time DESC;
    """
    cursor.execute(query)
    rows = cursor.fetchall()
    if not rows:
        return TriageFinding(
            category="CPU",
            severity="HEALTHY",
            title="İşlemci Kullanımı Normal",
            metric_value="Kaçak CPU Sorgusu Yok",
            evidence=["15 saniyeden uzun süredir kesintisiz CPU tüketen kaçak oturum yok."],
            affected_spids=[],
        ), ""

    spids = [int(r[0]) for r in rows]
    worst = rows[0]

    remediation = f"""-- ⚠️ YÜKSEK CPU TÜKETEN OTURUMU İNCELEME (SPID {worst[0]})
SELECT
    r.session_id,
    r.status,
    r.cpu_time,
    r.total_elapsed_time,
    t.text AS full_query_text,
    qp.query_plan
FROM sys.dm_exec_requests r
OUTER APPLY sys.dm_exec_sql_text(r.sql_handle) t
OUTER APPLY sys.dm_exec_query_plan(r.plan_handle) qp
WHERE r.session_id = {worst[0]};
"""

    return TriageFinding(
        category="CPU",
        severity="WARNING",
        title="Yüksek CPU Tüketen Sorgu",
        metric_value=f"SPID {worst[0]} (CPU: {worst[1]} ms)",
        evidence=[
            f"SPID {worst[0]} ({worst[3]}) {worst[1]} ms CPU tüketti.",
            f"Sorgu: {worst[4] or 'Metin yok'}",
        ],
        affected_spids=spids,
    ), remediation


def _check_tempdb_latch(cursor: pyodbc.Cursor) -> Tuple[TriageFinding | None, str]:
    query = """
    SELECT COUNT(*)
    FROM sys.dm_os_waiting_tasks
    WHERE wait_type LIKE 'PAGELATCH_%'
      AND resource_description LIKE '2:%';
    """
    cursor.execute(query)
    row = cursor.fetchone()
    count = int(row[0] or 0) if row else 0
    if count == 0:
        return TriageFinding(
            category="TEMPDB",
            severity="HEALTHY",
            title="TempDB Tahsis Çekişmesi Yok",
            metric_value="0 Latch Waiter",
            evidence=["PFS, GAM veya SGAM sayfalarında mandallanma kuyruğu yok."],
            affected_spids=[],
        ), ""

    return TriageFinding(
        category="TEMPDB",
        severity="WARNING",
        title="TempDB Sayfa Mandallanması (PAGELATCH)",
        metric_value=f"{count} Oturum Bekliyor",
        evidence=[f"TempDB tahsis sayfalarında {count} adet oturum eşzamanlı PAGELATCH bekliyor."],
        affected_spids=[],
    ), "-- TempDB dosya sayısını kontrol edin (Core başına 1 dosya) ve trace flag 1118'i devreye alın."


def _check_io_stalls(cursor: pyodbc.Cursor) -> Tuple[TriageFinding | None, str]:
    query = """
    SELECT TOP 1
        DB_NAME(database_id) AS db_name,
        CASE WHEN (num_of_reads + num_of_writes) = 0 THEN 0
             ELSE (io_stall_read_ms + io_stall_write_ms) / (num_of_reads + num_of_writes)
        END AS avg_stall_ms
    FROM sys.dm_io_virtual_file_stats(NULL, NULL)
    WHERE database_id > 4
    ORDER BY avg_stall_ms DESC;
    """
    cursor.execute(query)
    row = cursor.fetchone()
    if not row or (row[1] and float(row[1]) < 30):
        return TriageFinding(
            category="STORAGE_IO",
            severity="HEALTHY",
            title="Disk Gecikmesi Normal",
            metric_value="< 30 ms Stall",
            evidence=["Veritabanı dosyalarında anormal I/O darboğazı tespit edilmedi."],
            affected_spids=[],
        ), ""

    stall_ms = float(row[1])
    db_name = row[0]
    return TriageFinding(
        category="STORAGE_IO",
        severity="WARNING" if stall_ms < 100 else "CRITICAL",
        title=f"Yüksek Disk Gecikmesi: {db_name}",
        metric_value=f"{stall_ms:.1f} ms Stall",
        evidence=[f"'{db_name}' veritabanı dosyalarında ortalama {stall_ms:.1f} ms disk gecikmesi var."],
        affected_spids=[],
    ), "-- Disk alt sistemini ve veri/log dosyalarının fiziksel ayrımını denetleyin."


def _check_suspect_pages(cursor: pyodbc.Cursor) -> Tuple[TriageFinding | None, str]:
    query = "SELECT COUNT(*) FROM msdb.dbo.suspect_pages WHERE event_type IN (1, 2, 3);"
    cursor.execute(query)
    row = cursor.fetchone()
    count = int(row[0] or 0) if row else 0
    if count == 0:
        return TriageFinding(
            category="INTEGRITY",
            severity="HEALTHY",
            title="Fiziksel Veri Sayfaları Sağlıklı",
            metric_value="0 Bozuk Sayfa",
            evidence=["msdb.dbo.suspect_pages tablosunda bozuk 8KB sayfa kaydı yok."],
            affected_spids=[],
        ), ""

    return TriageFinding(
        category="INTEGRITY",
        severity="CRITICAL",
        title=f"KRİTİK DONANIM ARIZASI: {count} Bozuk Sayfa (Error 824)",
        metric_value=f"{count} Suspect Page",
        evidence=[f"msdb.dbo.suspect_pages tablosunda {count} adet fiziksel bozuk veri sayfası tespit edildi!"],
        affected_spids=[],
    ), "SELECT * FROM msdb.dbo.suspect_pages;\n-- DBCC CHECKDB çalıştırın ve online page restore gerçekleştirin."


def _formulate_verdict(
    findings: List[TriageFinding],
    blocking_sql: str,
    tran_sql: str,
    mem_sql: str,
    cpu_sql: str,
    tempdb_sql: str,
    io_sql: str,
    integrity_sql: str,
) -> Tuple[str, str, str, str]:
    # Priority 1: Blocking
    blocking = next((f for f in findings if f.category == "BLOCKING" and f.severity == "CRITICAL"), None)
    if blocking:
        return (
            "Kritik Kilitlenme ve Bloklama Zinciri",
            f"Sistemdeki yavaşlığın birincil kök nedeni: {blocking.metric_value}. Kök oturum kilitleri serbest bırakmadığı için diğer sorgular askıda kalmış.",
            "LOCK_BLOCKING_CHAIN",
            blocking_sql,
        )

    # Priority 2: Sleeping Open Tran
    tran = next((f for f in findings if f.category == "TRANSACTIONS" and f.severity == "CRITICAL"), None)
    if tran:
        return (
            "Askıda Kalan Sahipsiz İşlem (Sleeping Open Transaction)",
            f"Kök neden: {tran.title}. Oturum açık transaction ile uykuya geçmiş, kilitleri tutarak kilitlenmelere ve log şişmesine yol açıyor.",
            "SLEEPING_OPEN_TRANSACTION",
            tran_sql,
        )

    # Priority 3: Memory Grants
    mem = next((f for f in findings if f.category == "MEMORY" and f.severity == "CRITICAL"), None)
    if mem:
        return (
            "Kritik Çalışma Belleği Yetersizliği (RESOURCE_SEMAPHORE)",
            f"Kök neden: {mem.metric_value}. Büyük sort/hash join sorguları çalışma belleğini tüketmiş, yeni sorgular sırada kilitlenmiş.",
            "RESOURCE_SEMAPHORE_STARVATION",
            mem_sql,
        )

    # Priority 4: Suspect Pages
    integ = next((f for f in findings if f.category == "INTEGRITY" and f.severity == "CRITICAL"), None)
    if integ:
        return (
            "Fiziksel Disk Bozulması (Error 823/824)",
            f"Kök neden: {integ.title}. Donanım veya depolama kontrolcüsü 8KB veri sayfalarını bozmuş.",
            "CORRUPTED_SUSPECT_PAGES",
            integrity_sql,
        )

    # Priority 5: High CPU
    cpu = next((f for f in findings if f.category == "CPU" and f.severity == "WARNING"), None)
    if cpu:
        return (
            "Kaçak / Yüksek CPU Tüketen Sorgu",
            f"Kök neden: {cpu.metric_value}. Bir veya birden fazla sorgu işlemciyi yoğun şekilde meşgul ediyor.",
            "RUNAWAY_CPU_QUERY",
            cpu_sql,
        )

    # Everything healthy
    return (
        "Sistem Stabil ve Sağlıklı",
        "Eşzamanlı 7 alt sistem taramasında herhangi bir kilitlenme, kaçak CPU, bellek kuyruğu veya I/O darboğazı tespit edilmedi.",
        "NONE",
        "-- Sistem normal operasyonel parametrelerde çalışıyor. İnceleme için /instances veya /query-performance sayfalarını ziyaret edebilirsiniz.",
    )
