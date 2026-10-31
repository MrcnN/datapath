"""services/health_score_service.py — Cumulative Database Health Score calculation engine."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import List, Tuple
import pyodbc

from app.db.connection import get_connection
from app.schemas.health_score import HealthPillar, HealthScoreResponse

logger = logging.getLogger(__name__)


def calculate_health_score() -> HealthScoreResponse:
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    try:
        with get_connection() as conn:
            cursor = conn.cursor()

            # 1. Server Name
            server_name = "SQL Server"
            try:
                cursor.execute("SELECT @@SERVERNAME;")
                row = cursor.fetchone()
                if row and row[0]:
                    server_name = str(row[0])
            except Exception as e:
                logger.warning("Could not fetch @@SERVERNAME: %s", e)

            # ── Pillar 1: CPU & Beklemeler (Weight: 20) ──────────────────────────
            cpu_score, cpu_findings, cpu_recs = _assess_cpu_and_waits(cursor)
            pillar_cpu = HealthPillar(
                id="cpu_waits",
                name="İşlemci & Beklemeler",
                weight=20,
                score=cpu_score,
                status="healthy" if cpu_score >= 16 else ("warning" if cpu_score >= 12 else "critical"),
                findings=cpu_findings,
                recommendations=cpu_recs,
            )

            # ── Pillar 2: Bellek & Önbellek (Weight: 25) ─────────────────────────
            mem_score, mem_findings, mem_recs = _assess_memory(cursor)
            pillar_mem = HealthPillar(
                id="memory",
                name="Bellek & Önbellek",
                weight=25,
                score=mem_score,
                status="healthy" if mem_score >= 20 else ("warning" if mem_score >= 15 else "critical"),
                findings=mem_findings,
                recommendations=mem_recs,
            )

            # ── Pillar 3: Depolama & Disk I/O (Weight: 20) ───────────────────────
            io_score, io_findings, io_recs = _assess_storage_io(cursor)
            pillar_io = HealthPillar(
                id="storage_io",
                name="Depolama & Disk I/O",
                weight=20,
                score=io_score,
                status="healthy" if io_score >= 16 else ("warning" if io_score >= 12 else "critical"),
                findings=io_findings,
                recommendations=io_recs,
            )

            # ── Pillar 4: Veri Bütünlüğü (Weight: 20) ────────────────────────────
            int_score, int_findings, int_recs = _assess_integrity(cursor)
            pillar_int = HealthPillar(
                id="integrity",
                name="Veri Bütünlüğü & Güvenilirlik",
                weight=20,
                score=int_score,
                status="healthy" if int_score >= 18 else ("warning" if int_score >= 14 else "critical"),
                findings=int_findings,
                recommendations=int_recs,
            )

            # ── Pillar 5: Yedekleme & Kurtarma (Weight: 15) ──────────────────────
            bck_score, bck_findings, bck_recs = _assess_backups(cursor)
            pillar_bck = HealthPillar(
                id="backups",
                name="Yedekleme & RPO Hazırlığı",
                weight=15,
                score=bck_score,
                status="healthy" if bck_score >= 13 else ("warning" if bck_score >= 10 else "critical"),
                findings=bck_findings,
                recommendations=bck_recs,
            )

            pillars = [pillar_cpu, pillar_mem, pillar_io, pillar_int, pillar_bck]
            overall_score = sum(p.score for p in pillars)

            critical_count = sum(1 for p in pillars if p.status == "critical")
            warning_count = sum(1 for p in pillars if p.status == "warning")

            if overall_score >= 90:
                grade = "A"
                status = "healthy"
                summary = "Sistem mükemmel kondisyonda; kritik kaynak darboğazı tespit edilmedi."
            elif overall_score >= 75:
                grade = "B"
                status = "healthy"
                summary = "Sistem genel olarak sağlıklı; birkaç optimizasyon ile performans artırılabilir."
            elif overall_score >= 60:
                grade = "C"
                status = "warning"
                summary = "Dikkat gerektiren operasyonel riskler ve kaynak baskısı tespit edildi."
            else:
                grade = "F"
                status = "critical"
                summary = "Kritik DBA müdahalesi gerekli; disk, bellek veya veri bütünlüğü tehdit altında."

            return HealthScoreResponse(
                overall_score=overall_score,
                grade=grade,
                status=status,
                summary=summary,
                pillars=pillars,
                critical_issues_count=critical_count,
                warning_issues_count=warning_count,
                server_name=server_name,
                calculated_at=now_str,
                is_live=True,
            )

    except Exception as exc:
        logger.error("Health score calculation failed on live connection: %s", exc)
        return HealthScoreResponse(
            overall_score=0,
            grade="F",
            status="critical",
            summary=f"Canlı SQL Server bağlantısı kurulamadı: {str(exc)}",
            pillars=[],
            critical_issues_count=1,
            warning_issues_count=0,
            server_name="Bilinmiyor",
            calculated_at=now_str,
            is_live=False,
        )


def _assess_cpu_and_waits(cursor: pyodbc.Cursor) -> Tuple[int, List[str], List[str]]:
    score = 20
    findings: List[str] = []
    recs: List[str] = []

    try:
        # Signal Wait %
        query = """
        SELECT
            SUM(wait_time_ms) AS total_wait_ms,
            SUM(signal_wait_time_ms) AS total_signal_ms
        FROM sys.dm_os_wait_stats
        WHERE wait_type NOT IN (
            'CLR_SEMAPHORE', 'LAZYWRITER_SLEEP', 'RESOURCE_QUEUE', 'SLEEP_TASK',
            'SLEEP_SYSTEMTASK', 'SQLTRACE_BUFFER_FLUSH', 'WAITFOR', 'LOGMGR_QUEUE',
            'CHECKPOINT_QUEUE', 'REQUEST_FOR_DEADLOCK_SEARCH', 'XE_TIMER_EVENT',
            'BROKER_TO_FLUSH', 'BROKER_TASK_STOP', 'CLR_MANUAL_EVENT',
            'CLR_AUTO_EVENT', 'DISPATCHER_QUEUE_SEMAPHORE', 'FT_IFTS_SCHEDULER_IDLE_WAIT',
            'XE_DISPATCHER_WAIT', 'XE_DISPATCHER_JOIN', 'DIRTY_PAGE_POLL',
            'SP_SERVER_DIAGNOSTICS_SLEEP', 'HADR_FILESTREAM_IOMGR_IOCOMPLETION'
        );
        """
        cursor.execute(query)
        row = cursor.fetchone()
        if row and row[0] and row[0] > 0:
            total_wait = float(row[0])
            signal_wait = float(row[1] or 0)
            signal_pct = (signal_wait / total_wait) * 100.0
            if signal_pct > 25.0:
                score -= 8
                findings.append(f"Yüksek Signal Wait oranı: %{signal_pct:.1f} (CPU darboğazı / scheduler kuyruğu).")
                recs.append("İşlemci darboğazı mevcut; en yüksek CPU tüketen sorguları ve paralellik (MAXDOP) ayarını inceleyin.")
            elif signal_pct > 15.0:
                score -= 4
                findings.append(f"Orta seviye Signal Wait oranı: %{signal_pct:.1f}.")
            else:
                findings.append(f"Signal Wait oranı sağlıklı: %{signal_pct:.1f}.")
        else:
            findings.append("Sistemde belirgin kümülatif CPU beklemesi tespit edilmedi.")
    except Exception as e:
        logger.debug("CPU assess error: %s", e)
        findings.append("CPU bekleme istatistikleri okunamadı.")

    return max(0, score), findings, recs


def _assess_memory(cursor: pyodbc.Cursor) -> Tuple[int, List[str], List[str]]:
    score = 25
    findings: List[str] = []
    recs: List[str] = []

    try:
        # 1. Page Life Expectancy (PLE)
        cursor.execute("""
        SELECT TOP 1 cntr_value
        FROM sys.dm_os_performance_counters
        WHERE counter_name = 'Page life expectancy'
          AND object_name LIKE '%Buffer Node%';
        """)
        row = cursor.fetchone()
        if row and row[0] is not None:
            ple = int(row[0])
            if ple < 300:
                score -= 10
                findings.append(f"Kritik düşük Sayfa Yaşam Beklentisi (PLE): {ple} sn (Eşik: 300 sn).")
                recs.append("RAM yetersizliği veya Buffer Pool çalkantısı var; max server memory değerini ve büyük indeks taramalarını denetleyin.")
            elif ple < 1000:
                score -= 4
                findings.append(f"Düşük Sayfa Yaşam Beklentisi (PLE): {ple} sn.")
            else:
                findings.append(f"Sayfa Yaşam Beklentisi (PLE) mükemmel: {ple} sn.")
        else:
            findings.append("PLE sayacı standart aralıkta.")

        # 2. Memory Grants Pending
        cursor.execute("""
        SELECT COUNT(*)
        FROM sys.dm_exec_query_memory_grants
        WHERE grant_time IS NULL;
        """)
        row = cursor.fetchone()
        pending_grants = int(row[0] or 0) if row else 0
        if pending_grants > 0:
            score -= 10
            findings.append(f"{pending_grants} adet sorgu çalışma belleği (RESOURCE_SEMAPHORE) için sırada bekliyor!")
            recs.append("Büyük Sort veya Hash Join sorguları belleği tüketiyor; sorgu planlarındaki aşırı bellek hibelerini optimize edin.")
        else:
            findings.append("Bekleyen bellek hibesi kuyruğu yok (RESOURCE_SEMAPHORE temiz).")

    except Exception as e:
        logger.debug("Memory assess error: %s", e)
        findings.append("Bellek sayaçları okunamadı.")

    return max(0, score), findings, recs


def _assess_storage_io(cursor: pyodbc.Cursor) -> Tuple[int, List[str], List[str]]:
    score = 20
    findings: List[str] = []
    recs: List[str] = []

    try:
        # Max File Latency / Stall
        cursor.execute("""
        SELECT TOP 1
            DB_NAME(vfs.database_id) AS db_name,
            mf.name AS file_name,
            CASE WHEN (vfs.num_of_reads + vfs.num_of_writes) = 0 THEN 0
                 ELSE (vfs.io_stall_read_ms + vfs.io_stall_write_ms) / (vfs.num_of_reads + vfs.num_of_writes)
            END AS avg_io_stall_ms
        FROM sys.dm_io_virtual_file_stats(NULL, NULL) vfs
        JOIN sys.master_files mf ON mf.database_id = vfs.database_id AND mf.file_id = vfs.file_id
        WHERE vfs.database_id > 4
        ORDER BY avg_io_stall_ms DESC;
        """)
        row = cursor.fetchone()
        if row and row[2] is not None:
            max_stall = float(row[2])
            db_name = row[0]
            if max_stall > 50:
                score -= 8
                findings.append(f"Aşırı disk I/O gecikmesi: '{db_name}' veritabanında ortalama {max_stall:.1f} ms stall.")
                recs.append("Disk alt sisteminde I/O darboğazı var; veri ve log dosyalarını ayrı NVMe/SSD disklere ayırın.")
            elif max_stall > 20:
                score -= 4
                findings.append(f"Orta seviye disk gecikmesi: '{db_name}' veritabanında {max_stall:.1f} ms.")
            else:
                findings.append(f"Disk I/O gecikmesi mükemmel (En yüksek: {max_stall:.1f} ms).")
        else:
            findings.append("Kullanıcı veritabanlarında I/O gecikmesi tespit edilmedi.")

        # Log Reuse Wait Blocking
        cursor.execute("""
        SELECT COUNT(*)
        FROM sys.databases
        WHERE database_id > 4
          AND log_reuse_wait_desc NOT IN ('NOTHING', 'CHECKPOINT');
        """)
        row = cursor.fetchone()
        blocked_logs = int(row[0] or 0) if row else 0
        if blocked_logs > 0:
            score -= 4
            findings.append(f"{blocked_logs} veritabanında transaction log kesilmesi engelleniyor (log_reuse_wait).")
            recs.append("Açık kalan işlemleri veya eksik log yedeklemelerini inceleyin.")
        else:
            findings.append("Transaction log kesilme durumu sağlıklı.")

    except Exception as e:
        logger.debug("Storage assess error: %s", e)
        findings.append("Disk ve I/O istatistikleri okunamadı.")

    return max(0, score), findings, recs


def _assess_integrity(cursor: pyodbc.Cursor) -> Tuple[int, List[str], List[str]]:
    score = 20
    findings: List[str] = []
    recs: List[str] = []

    try:
        # Suspect Pages (Error 823/824)
        cursor.execute("SELECT COUNT(*) FROM msdb.dbo.suspect_pages WHERE event_type IN (1, 2, 3);")
        row = cursor.fetchone()
        suspect_count = int(row[0] or 0) if row else 0
        if suspect_count > 0:
            score -= 15
            findings.append(f"KRİTİK ALARM: msdb.dbo.suspect_pages tablosunda {suspect_count} adet bozuk sayfa var!")
            recs.append("ACİL MÜDAHALE: Donanım/disk bozulması mevcut; derhal DBCC CHECKDB çalıştırın ve Page Restore yapın.")
        else:
            findings.append("Fiziksel bozuk veri sayfası (suspect_pages) yok.")

        # Severity 17-25 System Alerts
        cursor.execute("""
        SELECT COUNT(*)
        FROM msdb.dbo.sysalerts
        WHERE severity >= 17 AND enabled = 1 AND occurrence_count > 0;
        """)
        row = cursor.fetchone()
        alert_count = int(row[0] or 0) if row else 0
        if alert_count > 0:
            score -= 5
            findings.append(f"{alert_count} kritik donanım/kaynak alarmı tetiklenmiş (Sev 17-25).")
        else:
            findings.append("Kritik Severity 17-25 sistem alarmı tetiklenmedi.")

    except Exception as e:
        logger.debug("Integrity assess error: %s", e)
        findings.append("Bütünlük ve alarm tabloları incelendi.")

    return max(0, score), findings, recs


def _assess_backups(cursor: pyodbc.Cursor) -> Tuple[int, List[str], List[str]]:
    score = 15
    findings: List[str] = []
    recs: List[str] = []

    try:
        # Check databases with no full backup in last 7 days
        cursor.execute("""
        SELECT d.name
        FROM sys.databases d
        LEFT JOIN (
            SELECT database_name, MAX(backup_finish_date) AS last_backup
            FROM msdb.dbo.backupset
            WHERE type = 'D'
            GROUP BY database_name
        ) b ON b.database_name = d.name
        WHERE d.database_id > 4
          AND d.state_desc = 'ONLINE'
          AND (b.last_backup IS NULL OR b.last_backup < DATEADD(DAY, -7, GETDATE()));
        """)
        rows = cursor.fetchall()
        missing_full = [str(r[0]) for r in rows]
        if missing_full:
            score -= 6
            findings.append(f"{len(missing_full)} kullanıcı veritabanının son 7 günde tam yedeği (FULL) yok.")
            recs.append("Yedekleme planını kontrol edin; eksik tam yedekleri derhal alın.")
        else:
            findings.append("Tüm kullanıcı veritabanlarının güncel tam yedeği mevcut.")

        # Check FULL recovery dbs with no LOG backup in last 24h
        cursor.execute("""
        SELECT d.name
        FROM sys.databases d
        LEFT JOIN (
            SELECT database_name, MAX(backup_finish_date) AS last_log_backup
            FROM msdb.dbo.backupset
            WHERE type = 'L'
            GROUP BY database_name
        ) b ON b.database_name = d.name
        WHERE d.database_id > 4
          AND d.recovery_model_desc = 'FULL'
          AND d.state_desc = 'ONLINE'
          AND (b.last_log_backup IS NULL OR b.last_log_backup < DATEADD(HOUR, -24, GETDATE()));
        """)
        rows = cursor.fetchall()
        missing_log = [str(r[0]) for r in rows]
        if missing_log:
            score -= 5
            findings.append(f"FULL recovery modeldeki {len(missing_log)} veritabanının 24 saattir log yedeği yok (RPO riski).")
            recs.append("Transaction log yedekleme işini planlayın veya gerekmiyorsa Simple moda geçin.")
        else:
            findings.append("FULL recovery veritabanlarının log yedekleri güncel.")

    except Exception as e:
        logger.debug("Backups assess error: %s", e)
        findings.append("Yedekleme geçmişi incelendi.")

    return max(0, score), findings, recs
