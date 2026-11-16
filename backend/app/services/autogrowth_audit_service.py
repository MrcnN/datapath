"""services/autogrowth_audit_service.py — Database Auto-Growth & Auto-Shrink Risk Auditor Service."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List
import pyodbc

from app.db.connection import ConnectionParams, get_db_connection, rows_to_dicts
from app.schemas.autogrowth_audit import (
    DatabaseFileGrowthRiskItem,
    AutoGrowthAuditSummary,
    AutoGrowthAuditResponse,
)

logger = logging.getLogger(__name__)


def get_autogrowth_audit_analysis(params: ConnectionParams) -> AutoGrowthAuditResponse:
    """Audit all database data and transaction log files for toxic configuration
    (AUTO_SHRINK, AUTO_CLOSE, percentage growth, tiny 1MB chunks) and Instant File Initialization.
    """
    items: List[DatabaseFileGrowthRiskItem] = []
    ifi_enabled = False
    auto_shrink_dbs = set()
    auto_close_dbs = set()
    percent_growth_count = 0
    tiny_growth_count = 0

    try:
        with get_db_connection(params) as conn:
            cursor = conn.cursor()

            # 1. Inspect Instant File Initialization (IFI)
            try:
                cursor.execute("""
                SELECT instant_file_initialization_enabled 
                FROM sys.dm_server_services 
                WHERE servicename LIKE 'SQL Server (%';
                """)
                row = cursor.fetchone()
                if row and str(row[0]).upper() in ('Y', '1', 'TRUE'):
                    ifi_enabled = True
            except Exception:
                pass

            # 2. Inspect all master files and database properties
            query = """
            SELECT 
                d.name AS database_name,
                mf.name AS logical_name,
                mf.type_desc AS file_type,
                mf.physical_name,
                ROUND(mf.size * 8.0 / 1024.0, 2) AS current_size_mb,
                mf.is_percent_growth,
                mf.growth,
                d.is_auto_shrink_on,
                d.is_auto_close_on
            FROM sys.master_files mf
            INNER JOIN sys.databases d ON mf.database_id = d.database_id
            WHERE d.state_desc = 'ONLINE'
              AND d.database_id > 4 -- exclude system databases
            ORDER BY d.is_auto_shrink_on DESC, mf.is_percent_growth DESC, mf.size DESC;
            """
            cursor.execute(query)
            rows = rows_to_dicts(cursor)

            for r in rows:
                db_name = str(r.get("database_name") or "")
                log_name = str(r.get("logical_name") or "")
                f_type = str(r.get("file_type") or "ROWS")
                phys_name = str(r.get("physical_name") or "")
                sz_mb = float(r.get("current_size_mb") or 0.0)
                is_pct = bool(r.get("is_percent_growth", 0))
                growth_raw = int(r.get("growth") or 0)
                is_shrink = bool(r.get("is_auto_shrink_on", 0))
                is_close = bool(r.get("is_auto_close_on", 0))

                if is_shrink:
                    auto_shrink_dbs.add(db_name)
                if is_close:
                    auto_close_dbs.add(db_name)

                # Calculate effective growth in MB
                if is_pct:
                    percent_growth_count += 1
                    growth_str = f"%{growth_raw}"
                    eff_growth_mb = round(sz_mb * (growth_raw / 100.0), 2)
                else:
                    eff_growth_mb = round(growth_raw * 8.0 / 1024.0, 2)
                    growth_str = f"{eff_growth_mb:.0f} MB"
                    if eff_growth_mb < 64.0:
                        tiny_growth_count += 1

                # Risk determination
                risk_lvl = "HEALTHY"
                reasons = []

                if is_shrink:
                    risk_lvl = "CRITICAL"
                    reasons.append("AUTO_SHRINK AÇIK! İndeksleri ağır şekilde parçalar ve I/O krizine yol açar.")

                if is_pct:
                    if risk_lvl != "CRITICAL":
                        risk_lvl = "HIGH"
                    reasons.append(f"Yüzdesel büyüme ({growth_str}). Dosya büyüdükçe tek büyümede {eff_growth_mb:.0f} MB tahsis etmeye çalışarak zaman aşımına sebep olur.")
                elif eff_growth_mb <= 8.0:
                    risk_lvl = "CRITICAL"
                    reasons.append(f"Çok küçük büyüme artışı ({eff_growth_mb:.0f} MB). Sürekli I/O kilitlenmelerine ve aşırı VLF oluşumuna yol açar.")
                elif eff_growth_mb < 64.0:
                    if risk_lvl == "HEALTHY":
                        risk_lvl = "WARNING"
                    reasons.append(f"Düşük büyüme artışı ({eff_growth_mb:.0f} MB). Önerilen: Veri için en az 512-1024 MB, Log için 256-512 MB.")

                if is_close:
                    if risk_lvl == "HEALTHY":
                        risk_lvl = "HIGH"
                    reasons.append("AUTO_CLOSE AÇIK! Her bağlantı kapandığında bellek temizlenir; yeniden bağlanırken gecikme yaratır.")

                if not reasons:
                    reasons.append(f"Sabit boyutlu dengeli büyüme ({growth_str}).")

                # Prescriptive remediation T-SQL
                recommended_growth = 1024 if f_type == "ROWS" else 512
                remediation_lines = []
                if is_shrink:
                    remediation_lines.append(f"ALTER DATABASE [{db_name}] SET AUTO_SHRINK OFF;")
                if is_close:
                    remediation_lines.append(f"ALTER DATABASE [{db_name}] SET AUTO_CLOSE OFF;")
                if is_pct or eff_growth_mb < 64.0:
                    remediation_lines.append(f"ALTER DATABASE [{db_name}] MODIFY FILE (NAME = N'{log_name}', FILEGROWTH = {recommended_growth}MB);")

                remediation_tsql = "\n".join(remediation_lines) if remediation_lines else "-- Mevcut yapılandırma sağlıklı; müdahale gerekmez."

                items.append(DatabaseFileGrowthRiskItem(
                    database_name=db_name,
                    logical_name=log_name,
                    file_type=f_type,
                    physical_name=phys_name,
                    current_size_mb=sz_mb,
                    is_percent_growth=is_pct,
                    growth_setting=growth_str,
                    effective_growth_mb=eff_growth_mb,
                    is_auto_shrink_on=is_shrink,
                    is_auto_close_on=is_close,
                    risk_level=risk_lvl,
                    risk_reason=" • ".join(reasons),
                    remediation_tsql=remediation_tsql,
                ))

    except Exception as exc:
        logger.error("Error executing autogrowth audit: %s", exc)

    critical_count = sum(1 for i in items if i.risk_level == "CRITICAL")
    high_count = sum(1 for i in items if i.risk_level == "HIGH")

    overall = "CRITICAL" if critical_count > 0 else "WARNING" if high_count > 0 else "HEALTHY"

    summary = AutoGrowthAuditSummary(
        total_files_audited=len(items),
        critical_risk_files=critical_count,
        percent_growth_files=percent_growth_count,
        tiny_growth_files=tiny_growth_count,
        auto_shrink_databases=len(auto_shrink_dbs),
        auto_close_databases=len(auto_close_dbs),
        instant_file_initialization_enabled=ifi_enabled,
        overall_health=overall,
        evaluated_at=datetime.now(timezone.utc).isoformat(),
    )

    # Batch Remediation Script
    remediation_script_lines = [
        "/*",
        "================================================================================",
        " DATAPATH — VERİTABANI AUTO-GROWTH & AUTO-SHRINK TOPLU İYİLEŞTİRME REÇETESİ",
        f" İncelenen Dosya: {len(items)} | Kritik Dosya: {critical_count} | Yüzdesel Büyüme: {percent_growth_count}",
        "================================================================================",
        "*/\n"
    ]

    for item in items:
        if item.risk_level in ("CRITICAL", "HIGH", "WARNING") and item.remediation_tsql.strip() and not item.remediation_tsql.startswith("--"):
            remediation_script_lines.append(f"-- [{item.database_name}] - {item.logical_name} ({item.risk_reason})")
            remediation_script_lines.append(item.remediation_tsql)
            remediation_script_lines.append("")

    if len(remediation_script_lines) <= 6:
        remediation_script_lines.append("-- Tüm veritabanı dosyaları ideal sabit artış boyutlarına ve güvenli ayarlara sahip.")

    remediation_batch = "\n".join(remediation_script_lines)

    return AutoGrowthAuditResponse(
        summary=summary,
        items=items,
        remediation_batch_script=remediation_batch,
    )
