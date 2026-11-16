"""services/error_log_forensics_service.py — SQL Server Error Log & Security Incident Forensic Service."""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import List, Dict, Tuple, Optional
import pyodbc

from app.db.connection import ConnectionParams, get_db_connection
from app.schemas.error_log_forensics import (
    LoginFailureDetail,
    ErrorLogCategoryCount,
    ClassifiedErrorLogEntry,
    ErrorLogForensicsSummary,
    ErrorLogForensicsResponse,
)

logger = logging.getLogger(__name__)

STATE_DESCRIPTIONS = {
    1: "Ek bilgi yok / Genel kimlik doğrulama hatası",
    2: "Kullanıcı adı bulunamadı (User ID not found)",
    5: "Kullanıcı adı geçersiz veya Windows hesabı tanınmadı",
    6: "Windows hesabı ile SQL Authentication denenmeye çalışıldı",
    7: "Hesap devre dışı bırakılmış (Login is disabled)",
    8: "Hatalı şifre girildi (Password did not match)",
    9: "Şifre güvenlik ilkesine uygun değil (Invalid password)",
    11: "Giriş başarılı fakat sunucuya bağlanma izni yok (Connect SQL izni eksik)",
    12: "Giriş geçerli fakat hesap kilitli (Account locked out)",
    16: "Veritabanı erişim izni yok",
    18: "Şifrenin süresi dolmuş (Password expired)",
    38: "İstenen veritabanı açılamadı veya kullanıcı erişimi yok",
    65: "Kullanıcı hesabı geçici olarak askıya alınmış",
}

LOGIN_FAILED_REGEX = re.compile(
    r"Login failed for user ['\"]?(?P<user>[^'\" ]+)['\"]?\. Reason: (?P<reason>[^.\[]+)(?:\.|\s)*\[CLIENT: (?P<client>[^\]]+)\]",
    re.IGNORECASE
)
STATE_REGEX = re.compile(r"State: (?P<state>\d+)", re.IGNORECASE)


def get_error_log_forensics_analysis(params: ConnectionParams, max_rows: int = 1000) -> ErrorLogForensicsResponse:
    """Read SQL Server Error Log (Log 0) via xp_readerrorlog and classify entries into
    security, corruption, memory dump, and system categories.
    """
    classified_entries: List[ClassifiedErrorLogEntry] = []
    login_failures_map: Dict[Tuple[str, str, int], Dict] = {}
    audit_level_str = "Başarısız Girişler (Failed Logins Only)"

    category_counts: Dict[str, int] = {
        "Giriş Başarısızlığı (Login Failure)": 0,
        "Donanım & I/O Bozulması (823/824/825)": 0,
        "Bellek Dökümü / Çökme (Stack Dump)": 0,
        "Ölümcül Motor Hatası (Fatal Engine)": 0,
        "Kilitlenme (Deadlock)": 0,
        "Yedekleme & Bakım (Backup/DBCC)": 0,
        "Sistem Bilgisi (Informational)": 0,
    }

    try:
        with get_db_connection(params) as conn:
            cursor = conn.cursor()

            # 1. Audit Level Inspection
            try:
                cursor.execute("SELECT CAST(SERVERPROPERTY('AuditLevel') AS INT);")
                r = cursor.fetchone()
                if r and r[0] is not None:
                    lvl = int(r[0])
                    if lvl == 0:
                        audit_level_str = "Denetim Kapalı (None)"
                    elif lvl == 1:
                        audit_level_str = "Yalnızca Başarılı Girişler"
                    elif lvl == 2:
                        audit_level_str = "Yalnızca Başarısız Girişler (Önerilen)"
                    elif lvl == 3:
                        audit_level_str = "Tüm Girişler (Başarılı & Başarısız)"
            except Exception:
                pass

            # 2. Read Error Log via xp_readerrorlog
            cursor.execute("EXEC xp_readerrorlog 0, 1;")
            rows = cursor.fetchall()

            entry_id = 1
            for row in rows[-max_rows:]:
                log_dt = row[0]
                dt_str = str(log_dt) if log_dt else ""
                proc_info = str(row[1] or "")
                text = str(row[2] or "").strip()

                cat = "Sistem Bilgisi (Informational)"
                sev = "INFO"
                client_ip: Optional[str] = None
                user_name: Optional[str] = None

                # A. Check for Login Failures (Error 18456)
                if "Login failed for user" in text:
                    cat = "Giriş Başarısızlığı (Login Failure)"
                    sev = "WARNING"
                    category_counts[cat] += 1

                    match = LOGIN_FAILED_REGEX.search(text)
                    state_code = 8  # default to bad password if unspecified
                    state_match = STATE_REGEX.search(text)
                    if state_match:
                        try:
                            state_code = int(state_match.group("state"))
                        except Exception:
                            pass

                    if match:
                        user_name = match.group("user")
                        client_ip = match.group("client")
                    else:
                        user_name = "Bilinmeyen"
                        client_ip = "Yerel / Belirtilmemiş"

                    key = (user_name, client_ip, state_code)
                    if key not in login_failures_map:
                        login_failures_map[key] = {
                            "user_name": user_name,
                            "client_ip": client_ip,
                            "state_code": state_code,
                            "state_description": STATE_DESCRIPTIONS.get(state_code, f"State {state_code}"),
                            "count": 0,
                            "first_attempt": dt_str,
                            "last_attempt": dt_str,
                        }
                    login_failures_map[key]["count"] += 1
                    login_failures_map[key]["last_attempt"] = dt_str

                # B. Hardware I/O and Corruption Errors
                elif any(err in text for err in ["Error: 823", "Error: 824", "Error: 825", "torn page", "bad checksum", "I/O error"]):
                    cat = "Donanım & I/O Bozulması (823/824/825)"
                    sev = "CRITICAL"
                    category_counts[cat] += 1

                # C. Memory / Stack Dumps
                elif any(m in text for m in ["Stack Dump", "dump.mdmp", "EXCEPTION_ACCESS_VIOLATION", "Non-yielding Scheduler"]):
                    cat = "Bellek Dökümü / Çökme (Stack Dump)"
                    sev = "CRITICAL"
                    category_counts[cat] += 1

                # D. Fatal Severity
                elif any(f in text for f in ["Severity: 17", "Severity: 18", "Severity: 19", "Severity: 20", "Severity: 21", "Severity: 22", "Severity: 23", "Severity: 24", "Severity: 25"]):
                    cat = "Ölümcül Motor Hatası (Fatal Engine)"
                    sev = "CRITICAL"
                    category_counts[cat] += 1

                # E. Deadlocks
                elif "deadlock" in text.lower():
                    cat = "Kilitlenme (Deadlock)"
                    sev = "HIGH"
                    category_counts[cat] += 1

                # F. Backup & DBCC Maintenance
                elif any(b in text for b in ["Database backed up", "DBCC CHECKDB", "BACKUP DATABASE", "RESTORE DATABASE"]):
                    cat = "Yedekleme & Bakım (Backup/DBCC)"
                    sev = "INFO"
                    category_counts[cat] += 1

                else:
                    category_counts["Sistem Bilgisi (Informational)"] += 1

                if sev in ("CRITICAL", "HIGH", "WARNING"):
                    classified_entries.append(ClassifiedErrorLogEntry(
                        id=entry_id,
                        log_date=dt_str,
                        process_info=proc_info,
                        category=cat,
                        severity=sev,
                        message=text,
                        client_ip=client_ip,
                        user_name=user_name,
                    ))
                entry_id += 1

    except Exception as exc:
        logger.error("Failed to read SQL Server Error Log: %s", exc)

    # Convert Top Failed Logins
    top_failed: List[LoginFailureDetail] = []
    for item in sorted(login_failures_map.values(), key=lambda x: x["count"], reverse=True)[:25]:
        top_failed.append(LoginFailureDetail(
            user_name=item["user_name"],
            client_ip=item["client_ip"],
            state_code=item["state_code"],
            state_description=item["state_description"],
            failure_count=item["count"],
            first_attempt=item["first_attempt"],
            last_attempt=item["last_attempt"],
        ))

    # Categories list
    categories_list: List[ErrorLogCategoryCount] = []
    for c_name, count in category_counts.items():
        if count > 0:
            if "Donanım" in c_name or "Bellek" in c_name or "Ölümcül" in c_name:
                c_sev = "CRITICAL"
            elif "Kilitlenme" in c_name:
                c_sev = "HIGH"
            elif "Giriş" in c_name:
                c_sev = "WARNING"
            else:
                c_sev = "INFO"

            categories_list.append(ErrorLogCategoryCount(
                category=c_name,
                count=count,
                severity=c_sev,
            ))

    unique_ips = len(set(f.client_ip for f in top_failed if f.client_ip and f.client_ip != "Yerel / Belirtilmemiş"))
    total_entries = sum(category_counts.values())
    error_cnt = sum(c.count for c in categories_list if c.severity in ("CRITICAL", "HIGH", "WARNING"))

    summary = ErrorLogForensicsSummary(
        total_log_entries=total_entries,
        error_count=error_cnt,
        login_failures_count=category_counts["Giriş Başarısızlığı (Login Failure)"],
        corruption_events_count=category_counts["Donanım & I/O Bozulması (823/824/825)"],
        memory_dump_count=category_counts["Bellek Dökümü / Çökme (Stack Dump)"],
        unique_attacking_ips=unique_ips,
        audit_level=audit_level_str,
        evaluated_at=datetime.now(timezone.utc).isoformat(),
    )

    # Prescriptive Remediation Runbook
    remediation_runbook = f"""/*
================================================================================
 DATAPATH — HATA GÜNLÜĞÜ VE GÜVENLİK ADLİ BİLİŞİM İYİLEŞTİRME REÇETESİ
 Toplam Başarısız Giriş: {summary.login_failures_count} | Farklı Saldıran IP Sayısı: {summary.unique_attacking_ips}
================================================================================
*/

-- 1. 'sa' Hesabını Güvene Alın (Mümkünse Devre Dışı Bırakın veya Yeniden Adlandırın)
-- 'sa' hesabı kaba kuvvet (brute-force) saldırılarının birincil hedefidir.
IF EXISTS (SELECT name FROM sys.server_principals WHERE name = 'sa' AND is_disabled = 0)
BEGIN
    -- Şifre politikasını ve hesap kilitlemeyi zorunlu kılın:
    ALTER LOGIN [sa] WITH CHECK_POLICY = ON, CHECK_EXPIRATION = ON;
    PRINT '[sa] hesabı için Windows parola ve hesap kilitleme ilkesi zorunlu kılındı.';
    
    -- Öneri: Özel DBA yetkili hesabı oluşturulduktan sonra sa devre dışı bırakılmalıdır:
    -- ALTER LOGIN [sa] DISABLE;
END;

-- 2. SQL Server Giriş Denetimi Seviyesini Doğrulayın (Default = 2: Failed logins only)
-- 0 = None, 1 = Success only, 2 = Failed only, 3 = Both
-- Değişiklik için SQL Server servisinin yeniden başlatılması gerekebilir.
EXEC xp_instance_regwrite 
    N'HKEY_LOCAL_MACHINE', 
    N'Software\\Microsoft\\MSSQLServer\\MSSQLServer', 
    N'AuditLevel', 
    REG_DWORD, 
    2;
PRINT 'Giriş denetimi başarısız denemelere (Failed logins only) ayarlandı.';

-- 3. Hata Günlüğünde En Son Tetiklenen Kritik Hataları Doğrulayın
EXEC xp_readerrorlog 0, 1, 'Login failed';
EXEC xp_readerrorlog 0, 1, 'Error: 82';
"""

    return ErrorLogForensicsResponse(
        summary=summary,
        categories=categories_list,
        top_failed_logins=top_failed,
        recent_critical_entries=classified_entries[-100:],
        remediation_runbook=remediation_runbook,
    )
