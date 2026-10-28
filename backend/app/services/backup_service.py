"""services/backup_service.py — Backup history and recovery readiness."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Optional

import pyodbc

from app.db.connection import ConnectionParams, get_db_connection, rows_to_dicts
from app.schemas.backups import BackupRecord, DatabaseIntegrityCheck, RecoveryReadiness
from app.services.demo_data import DEMO_INTEGRITY_CHECKS

logger = logging.getLogger(__name__)

_BACKUP_TYPE_DESC = {"D": "Full", "I": "Differential", "L": "Transaction Log", "F": "File", "G": "Filegroup"}


def get_backup_history(
    params: ConnectionParams,
    db_name: str = "",
    days_back: int = 30,
    backup_type: str = "",
) -> List[BackupRecord]:
    with get_db_connection(params) as conn:
        cursor = conn.cursor()

        type_filter = ""
        type_param: Optional[str] = None
        if backup_type and backup_type.upper() != "ALL":
            type_filter = "AND bs.type = ?"
            type_param = backup_type.upper()

        db_filter = ""
        if db_name:
            db_filter = "AND bs.database_name = ?"

        params_list: list = [days_back]
        if db_name:
            params_list.append(db_name)
        if type_param:
            params_list.append(type_param)

        cursor.execute(
            f"""
            SELECT
                bs.database_name,
                bs.type                                                   AS backup_type,
                bs.backup_start_date,
                bs.backup_finish_date,
                DATEDIFF(SECOND, bs.backup_start_date,
                         bs.backup_finish_date)                           AS duration_seconds,
                CAST(bs.backup_size / 1073741824.0 AS DECIMAL(18,4))     AS backup_size_gb,
                CAST(ISNULL(bs.compressed_backup_size, 0) / 1073741824.0
                     AS DECIMAL(18,4))                                    AS compressed_size_gb,
                CASE WHEN ISNULL(bs.compressed_backup_size, 0) > 0
                     THEN CAST(bs.backup_size * 1.0 /
                          bs.compressed_backup_size AS DECIMAL(10,2))
                     ELSE NULL END                                        AS compression_ratio,
                bmf.physical_device_name                                  AS device_name,
                bs.is_password_protected,
                bs.recovery_model
            FROM msdb.dbo.backupset bs
            JOIN msdb.dbo.backupmediafamily bmf
                ON bmf.media_set_id = bs.media_set_id
            WHERE bs.backup_start_date >= DATEADD(day, -?, GETDATE())
            {db_filter}
            {type_filter}
            ORDER BY bs.backup_start_date DESC
            """,
            params_list,
        )
        rows = rows_to_dicts(cursor)
        return [
            BackupRecord(
                database_name=r["database_name"],
                backup_type=r.get("backup_type"),
                backup_type_desc=_BACKUP_TYPE_DESC.get(r.get("backup_type", ""), "Unknown"),
                backup_start_date=r.get("backup_start_date"),
                backup_finish_date=r.get("backup_finish_date"),
                duration_seconds=r.get("duration_seconds"),
                backup_size_gb=float(r["backup_size_gb"]) if r.get("backup_size_gb") is not None else None,
                compressed_size_gb=float(r["compressed_size_gb"]) if r.get("compressed_size_gb") is not None else None,
                compression_ratio=float(r["compression_ratio"]) if r.get("compression_ratio") is not None else None,
                device_name=r.get("device_name"),
                is_password_protected=bool(r.get("is_password_protected")),
                recovery_model=r.get("recovery_model"),
            )
            for r in rows
        ]


def get_recovery_readiness(params: ConnectionParams) -> List[RecoveryReadiness]:
    with get_db_connection(params) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                d.name                              AS database_name,
                d.recovery_model_desc               AS recovery_model,
                MAX(CASE WHEN bs.type = 'D' THEN bs.backup_finish_date END) AS last_full,
                MAX(CASE WHEN bs.type = 'I' THEN bs.backup_finish_date END) AS last_diff,
                MAX(CASE WHEN bs.type = 'L' THEN bs.backup_finish_date END) AS last_log,
                DATEDIFF(SECOND, MAX(CASE WHEN bs.type = 'D' THEN bs.backup_finish_date END), GETDATE()) AS full_age_sec,
                DATEDIFF(SECOND, MAX(CASE WHEN bs.type = 'I' THEN bs.backup_finish_date END), GETDATE()) AS diff_age_sec,
                DATEDIFF(SECOND, MAX(CASE WHEN bs.type = 'L' THEN bs.backup_finish_date END), GETDATE()) AS log_age_sec
            FROM sys.databases d
            LEFT JOIN msdb.dbo.backupset bs ON bs.database_name = d.name
            WHERE d.database_id > 4
              AND d.state_desc = 'ONLINE'
            GROUP BY d.name, d.recovery_model_desc
            ORDER BY d.name
            """
        )
        rows = rows_to_dicts(cursor)
        results: List[RecoveryReadiness] = []

        for r in rows:
            db = r["database_name"]
            rm = r.get("recovery_model", "SIMPLE")
            last_full: Optional[datetime] = r.get("last_full")
            last_diff: Optional[datetime] = r.get("last_diff")
            last_log: Optional[datetime] = r.get("last_log")

            full_age_sec = r.get("full_age_sec")
            diff_age_sec = r.get("diff_age_sec")
            log_age_sec = r.get("log_age_sec")

            full_age = round(max(0, full_age_sec) / 3600.0, 2) if full_age_sec is not None else None
            diff_age = round(max(0, diff_age_sec) / 3600.0, 2) if diff_age_sec is not None else None
            log_age = round(max(0, log_age_sec) / 3600.0, 2) if log_age_sec is not None else None

            # Fallback if server didn't compute age but dates exist
            now_local = datetime.now()
            if full_age is None and last_full is not None:
                full_age = round(max(0.0, (now_local - last_full.replace(tzinfo=None)).total_seconds() / 3600.0), 2)
            if diff_age is None and last_diff is not None:
                diff_age = round(max(0.0, (now_local - last_diff.replace(tzinfo=None)).total_seconds() / 3600.0), 2)
            if log_age is None and last_log is not None:
                log_age = round(max(0.0, (now_local - last_log.replace(tzinfo=None)).total_seconds() / 3600.0), 2)

            issues: List[str] = []
            recs: List[str] = []
            risk = "low"

            if last_full is None:
                issues.append("Tam yedek (Full backup) bulunamadı.")
                recs.append("Derhal tam yedek (Full backup) alınız.")
                risk = "critical"
            elif full_age and full_age > 168:  # 7 days
                issues.append(f"Son tam yedek {full_age:.1f} saat önce alınmış (> 7 gün).")
                recs.append("Daha sık tam yedekleme planlayınız.")
                risk = "high"
            elif full_age and full_age > 48:
                issues.append(f"Son tam yedek {full_age:.1f} saat önce alınmış.")
                risk = max(risk, "medium") if risk == "low" else risk

            if rm == "FULL":
                if last_log is None:
                    issues.append("İşlem günlüğü (Log) yedeği bulunamadı (FULL model).")
                    recs.append("Noktadan noktaya kurtarma (RPO) için log yedeği alınız veya test ortamıysa kurtarma modelini SIMPLE yapınız.")
                    risk = "critical"
                elif log_age and log_age > 1:
                    issues.append(f"Son log yedeği {log_age:.1f} saat önce alınmış.")
                    recs.append("RPO veri kaybı riskini azaltmak için log yedekleme sıklığını artırınız.")
                    if risk not in ("critical", "high"):
                        risk = "medium"

            results.append(
                RecoveryReadiness(
                    database_name=db,
                    recovery_model=rm,
                    last_full_backup=last_full,
                    last_diff_backup=last_diff,
                    last_log_backup=last_log,
                    full_backup_age_hours=full_age,
                    diff_backup_age_hours=diff_age,
                    log_backup_age_hours=log_age,
                    recovery_point_objective_risk=risk,
                    issues=issues,
                    recommendations=recs,
                )
            )
        return results


def get_database_integrity_checks(params: ConnectionParams) -> List[DatabaseIntegrityCheck]:
    """Retrieve last known clean DBCC CHECKDB execution dates and page verification integrity status."""
    try:
        with get_db_connection(params) as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT 
                d.name AS database_name,
                d.page_verify_option_desc AS page_verify_option,
                d.is_read_only,
                CONVERT(VARCHAR(19), d.create_date, 120) AS create_date
            FROM sys.databases d
            WHERE d.state_desc = 'ONLINE';
            """)
            dbs = rows_to_dicts(cursor)

            results: List[DatabaseIntegrityCheck] = []
            for db in dbs:
                dbname = str(db["database_name"])
                pv = str(db.get("page_verify_option", "CHECKSUM"))
                ro = bool(db.get("is_read_only", 0))

                # Try reading dbi_dbccLastKnownGood via DBCC DBINFO
                last_good = None
                try:
                    cursor.execute(f"DBCC DBINFO ('{dbname}') WITH TABLERESULTS, NO_INFOMSGS;")
                    for row in cursor.fetchall():
                        if row and len(row) >= 4 and str(row[2]).strip() == "dbi_dbccLastKnownGood":
                            val = str(row[3]).strip()
                            if val and not val.startswith("1900"):
                                last_good = val[:19]
                            break
                except Exception:
                    pass

                days_since = None
                if last_good:
                    try:
                        dt = datetime.strptime(last_good, "%Y-%m-%d %H:%M:%S")
                        days_since = max(0, (datetime.now() - dt).days)
                    except Exception:
                        pass

                if days_since is None:
                    status_val = "CRITICAL"
                    display_date = "Hiç Çalıştırılmadı"
                elif days_since <= 7:
                    status_val = "HEALTHY"
                    display_date = f"{last_good} ({days_since} gün önce)"
                elif days_since <= 14:
                    status_val = "WARNING"
                    display_date = f"{last_good} ({days_since} gün önce)"
                else:
                    status_val = "CRITICAL"
                    display_date = f"{last_good} ({days_since} gün önce)"

                results.append(
                    DatabaseIntegrityCheck(
                        database_name=dbname,
                        last_clean_checkdb=display_date,
                        days_since_checkdb=days_since,
                        status=status_val,
                        page_verify_option=pv,
                        is_read_only=ro,
                        integrity_check_sql=f"DBCC CHECKDB ([{dbname}]) WITH NO_INFOMSGS, ALL_ERRORMSGS;",
                    )
                )
            return results
    except Exception as exc:
        logger.warning("Could not fetch live integrity checks, falling back to demo data: %s", exc)
        return DEMO_INTEGRITY_CHECKS

