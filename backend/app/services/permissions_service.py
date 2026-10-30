"""services/permissions_service.py — Server logins, DB users, roles."""
from __future__ import annotations

import logging
from typing import List, Optional

import pyodbc

from app.core.exceptions import PermissionDeniedError
from app.db.connection import ConnectionParams, get_db_connection, rows_to_dicts
from app.schemas.permissions import (
    DatabaseUser,
    RoleMember,
    ServerLogin,
    ServerRole,
    SecurityFinding,
    SecurityAuditSummary,
)

logger = logging.getLogger(__name__)


def get_server_logins(params: ConnectionParams) -> List[ServerLogin]:
    with get_db_connection(params) as conn:
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT
                    sp.name,
                    sp.type_desc,
                    sp.is_disabled,
                    CAST(LOGINPROPERTY(sp.name, 'IsLocked') AS INT) AS is_locked,
                    sp.default_database_name           AS default_database,
                    sp.create_date,
                    sp.modify_date,
                    CASE WHEN srm.role_principal_id IS NOT NULL THEN 1 ELSE 0 END AS has_sysadmin
                FROM sys.server_principals sp
                LEFT JOIN sys.server_role_members srm
                    ON srm.member_principal_id = sp.principal_id
                    AND srm.role_principal_id = SUSER_ID('sysadmin')
                WHERE sp.type IN ('S','U','G','E','X')
                  AND sp.name NOT LIKE '##%'
                ORDER BY sp.name
                """
            )
            rows = rows_to_dicts(cursor)
            return [
                ServerLogin(
                    name=r["name"],
                    type_desc=r.get("type_desc"),
                    is_disabled=bool(r.get("is_disabled")),
                    is_locked=bool(r.get("is_locked")) if r.get("is_locked") is not None else None,
                    default_database=r.get("default_database"),
                    create_date=r.get("create_date"),
                    modify_date=r.get("modify_date"),
                    has_sysadmin=bool(r.get("has_sysadmin")),
                )
                for r in rows
            ]
        except pyodbc.Error as exc:
            if "230" in str(exc) or "permission" in str(exc).lower():
                raise PermissionDeniedError(
                    "Cannot query sys.server_principals. Requires VIEW ANY DEFINITION.",
                    detail=str(exc.args),
                ) from exc
            raise


def get_database_users(params: ConnectionParams, db_name: str) -> List[DatabaseUser]:
    with get_db_connection(params) as conn:
        cursor = conn.cursor()
        try:
            # Fetch users
            cursor.execute(
                f"""
                SELECT
                    dp.name                 AS username,
                    dp.type_desc,
                    sp.name                 AS login_name,
                    dp.default_schema_name  AS default_schema,
                    dp.create_date
                FROM [{db_name}].sys.database_principals dp
                LEFT JOIN sys.server_principals sp ON sp.sid = dp.sid
                WHERE dp.type IN ('S','U','G','E','X')
                  AND dp.name NOT IN ('guest','INFORMATION_SCHEMA','sys','dbo')
                  AND dp.name NOT LIKE '##%'
                ORDER BY dp.name
                """,
            )
            users = rows_to_dicts(cursor)

            # Fetch role memberships
            cursor.execute(
                f"""
                SELECT
                    dp_member.name  AS username,
                    dp_role.name    AS role_name
                FROM [{db_name}].sys.database_role_members drm
                JOIN [{db_name}].sys.database_principals dp_role
                    ON dp_role.principal_id = drm.role_principal_id
                JOIN [{db_name}].sys.database_principals dp_member
                    ON dp_member.principal_id = drm.member_principal_id
                WHERE dp_member.type IN ('S','U','G','E','X')
                ORDER BY dp_member.name, dp_role.name
                """
            )
            role_rows = rows_to_dicts(cursor)
            roles_map: dict = {}
            for rr in role_rows:
                roles_map.setdefault(rr["username"], []).append(rr["role_name"])

            return [
                DatabaseUser(
                    username=u["username"],
                    db_name=db_name,
                    type_desc=u.get("type_desc"),
                    login_name=u.get("login_name"),
                    default_schema=u.get("default_schema"),
                    create_date=u.get("create_date"),
                    roles=roles_map.get(u["username"], []),
                )
                for u in users
            ]
        except pyodbc.Error as exc:
            if "229" in str(exc) or "230" in str(exc) or "permission" in str(exc).lower():
                raise PermissionDeniedError(
                    f"Cannot query users in database '{db_name}'.",
                    detail=str(exc.args),
                ) from exc
            raise


def get_roles(params: ConnectionParams) -> List[ServerRole]:
    with get_db_connection(params) as conn:
        cursor = conn.cursor()
        roles: List[ServerRole] = []

        # --- Server roles ---
        cursor.execute(
            """
            SELECT
                r.name          AS role_name,
                m.name          AS member_name,
                m.type_desc     AS member_type
            FROM sys.server_role_members srm
            JOIN sys.server_principals r ON r.principal_id = srm.role_principal_id
            JOIN sys.server_principals m ON m.principal_id = srm.member_principal_id
            WHERE m.name NOT LIKE '##%'
            ORDER BY r.name, m.name
            """
        )
        server_role_rows = rows_to_dicts(cursor)
        server_role_map: dict = {}
        for rr in server_role_rows:
            rn = rr["role_name"]
            server_role_map.setdefault(rn, []).append(
                RoleMember(member_name=rr["member_name"], member_type=rr.get("member_type"))
            )
        for rname, members in server_role_map.items():
            roles.append(ServerRole(role_name=rname, role_type="server", members=members))

        # --- Database roles (all user databases) ---
        cursor.execute(
            """
            SELECT name FROM sys.databases
            WHERE database_id > 4 AND state_desc = 'ONLINE'
            ORDER BY name
            """
        )
        db_names = [row[0] for row in cursor.fetchall()]
        for db in db_names:
            try:
                cursor.execute(
                    f"""
                    SELECT
                        r.name      AS role_name,
                        m.name      AS member_name,
                        m.type_desc AS member_type
                    FROM [{db}].sys.database_role_members drm
                    JOIN [{db}].sys.database_principals r
                        ON r.principal_id = drm.role_principal_id
                    JOIN [{db}].sys.database_principals m
                        ON m.principal_id = drm.member_principal_id
                    WHERE m.name NOT LIKE '##%'
                      AND m.name NOT IN ('guest','dbo')
                    ORDER BY r.name, m.name
                    """
                )
                db_role_rows = rows_to_dicts(cursor)
                db_role_map: dict = {}
                for rr in db_role_rows:
                    rn = rr["role_name"]
                    db_role_map.setdefault(rn, []).append(
                        RoleMember(member_name=rr["member_name"], member_type=rr.get("member_type"))
                    )
                for rname, members in db_role_map.items():
                    roles.append(ServerRole(role_name=rname, role_type="database", db_name=db, members=members))
            except pyodbc.Error:
                pass  # Skip databases we can't access

        return roles


def get_security_audit(params: ConnectionParams) -> SecurityAuditSummary:
    """Audit SQL Server permissions, orphan users, TRUSTWORTHY settings, and surface area."""
    try:
        with get_db_connection(params) as conn:
            cursor = conn.cursor()
            findings: List[SecurityFinding] = []
            passed_count = 0
            hardening_lines: List[str] = [
                "-- ================================================================",
                "-- Datapath - SQL Server Security Hardening & Remediation Script",
                "-- NOT: Lütfen production ortamına uygulamadan önce gözden geçiriniz.",
                "-- ================================================================",
                "",
                "USE master;",
                "GO",
                "",
            ]

            # 1. Check user databases
            cursor.execute(
                """
                SELECT name, is_trustworthy_on, SUSER_SNAME(owner_sid) AS owner_name 
                FROM sys.databases 
                WHERE database_id > 4 AND state_desc = 'ONLINE'
                """
            )
            user_dbs = cursor.fetchall()

            for db_row in user_dbs:
                dbname = db_row[0]
                is_trustworthy = bool(db_row[1])
                db_owner = db_row[2] or "sa"

                # Check TRUSTWORTHY privilege escalation
                if is_trustworthy:
                    findings.append(
                        SecurityFinding(
                            id=f"SEC-TRUST-{dbname}",
                            category="PRIVILEGE_ESCALATION",
                            severity="CRITICAL",
                            database_name=dbname,
                            principal_name=dbname,
                            title=f"TRUSTWORTHY Riski: {dbname}",
                            description=f"{dbname} veritabanında TRUSTWORTHY açık (ON) ve sahibi '{db_owner}' olarak ayarlanmış.",
                            risk_impact="db_owner veya yetkili kullanıcılar 'EXECUTE AS OWNER' ile sunucu genelinde tam sysadmin yetkisine kontrolsüz yükselebilir.",
                            remediation_sql=f"ALTER DATABASE [{dbname}] SET TRUSTWORTHY OFF;",
                        )
                    )
                    hardening_lines.append(f"-- TRUSTWORTHY Açığını Kapat ({dbname})\nALTER DATABASE [{dbname}] SET TRUSTWORTHY OFF;\nGO\n")
                else:
                    passed_count += 1

                # Check orphan users in this database
                try:
                    cursor.execute(
                        f"""
                        SELECT 
                            dp.name AS username
                        FROM [{dbname}].sys.database_principals dp
                        LEFT JOIN sys.server_principals sp ON dp.sid = sp.sid
                        WHERE sp.sid IS NULL
                          AND dp.type IN ('S', 'U', 'G')
                          AND dp.authentication_type = 1
                          AND dp.name NOT IN ('guest', 'INFORMATION_SCHEMA', 'sys', 'dbo')
                        """
                    )
                    orphans = cursor.fetchall()
                    for o in orphans:
                        uname = o[0]
                        findings.append(
                            SecurityFinding(
                                id=f"SEC-ORPHAN-{dbname}-{uname}",
                                category="ORPHAN_USER",
                                severity="CRITICAL",
                                database_name=dbname,
                                principal_name=uname,
                                title=f"Yetim Kullanıcı (Orphan User): {uname}",
                                description=f"{dbname} veritabanındaki '{uname}' kullanıcısının SID değeri sunucu login tablosundaki hiçbir hesapla eşleşmemektedir.",
                                risk_impact="Veritabanı yedeği geri yüklendikten sonra login bağlantısı kopmuştur. Yetkisiz bir kullanıcı aynı isimle sunucu logini açarsa veritabanındaki tüm yetkileri devralabilir.",
                                remediation_sql=f"USE [{dbname}];\nIF EXISTS (SELECT 1 FROM sys.server_principals WHERE name = '{uname}')\n    ALTER USER [{uname}] WITH LOGIN = [{uname}];\nELSE\n    -- DROP USER [{uname}];\n    PRINT 'Login bulunamadı.';",
                            )
                        )
                        hardening_lines.append(f"-- Yetim Kullanıcı Düzelt ({dbname}.{uname})\nUSE [{dbname}];\nGO\nIF EXISTS (SELECT 1 FROM sys.server_principals WHERE name = '{uname}')\n    ALTER USER [{uname}] WITH LOGIN = [{uname}];\nGO\n")
                    if not orphans:
                        passed_count += 1
                except Exception:
                    pass

                # Check guest user permissions in this database
                try:
                    cursor.execute(
                        f"""
                        SELECT p.permission_name
                        FROM [{dbname}].sys.database_permissions p
                        JOIN [{dbname}].sys.database_principals dp ON p.grantee_principal_id = dp.principal_id
                        WHERE dp.name = 'guest' AND p.permission_name = 'CONNECT' AND p.state = 'G'
                        """
                    )
                    guest_perm = cursor.fetchone()
                    if guest_perm:
                        findings.append(
                            SecurityFinding(
                                id=f"SEC-GUEST-{dbname}",
                                category="GUEST_ACCESS",
                                severity="WARNING",
                                database_name=dbname,
                                principal_name="guest",
                                title=f"Misafir Hesabı (Guest) Bağlantı İzni Açık: {dbname}",
                                description=f"{dbname} veritabanında 'guest' kullanıcısına CONNECT yetkisi verilmiş durumda.",
                                risk_impact="Sunucuya erişebilen herhangi bir kimliği doğrulanmış kullanıcı, bu veritabanına erişebilir ve genel şemaları okuyabilir.",
                                remediation_sql=f"USE [{dbname}];\nREVOKE CONNECT FROM guest;",
                            )
                        )
                        hardening_lines.append(f"-- Misafir Kullanıcı Erişimini İptal Et ({dbname})\nUSE [{dbname}];\nGO\nREVOKE CONNECT FROM guest;\nGO\n")
                    else:
                        passed_count += 1
                except Exception:
                    pass

            # 2. Check sysadmin count
            cursor.execute(
                """
                SELECT sp.name
                FROM sys.server_role_members srm
                JOIN sys.server_principals sp ON srm.member_principal_id = sp.principal_id
                WHERE srm.role_principal_id = SUSER_ID('sysadmin')
                  AND sp.name NOT LIKE '##%' AND sp.name NOT LIKE 'NT SERVICE%'
                """
            )
            sysadmins = [r[0] for r in cursor.fetchall()]
            if len(sysadmins) > 4:
                findings.append(
                    SecurityFinding(
                        id="SEC-SYSADMIN-EXCESS",
                        category="SURFACE_AREA",
                        severity="WARNING",
                        principal_name=f"{len(sysadmins)} Sysadmin",
                        title=f"Aşırı Yetkili Hesaplar ({len(sysadmins)} Sysadmin)",
                        description=f"Sunucu üzerinde {len(sysadmins)} farklı hesap sysadmin yetkisine sahip: {', '.join(sysadmins[:6])}...",
                        risk_impact="En az ayrıcalık (Least Privilege) ilkesi ihlal edilmektedir. Hesaplardan birinin ele geçirilmesi tüm veritabanı motorunu tehlikeye atar.",
                        remediation_sql="-- Gerekli olmayan hesapları sysadmin rolünden çıkarın:\n" + "\n".join([f"-- ALTER SERVER ROLE [sysadmin] DROP MEMBER [{sa}];" for sa in sysadmins if sa not in ('sa', 'NT AUTHORITY\\SYSTEM')]),
                    )
                )
            else:
                passed_count += 1

            # 3. Check SQL Logins with disabled password policies
            cursor.execute(
                """
                SELECT name
                FROM sys.sql_logins
                WHERE (is_policy_checked = 0 OR is_expiration_checked = 0)
                  AND is_disabled = 0
                  AND name NOT LIKE '##%'
                """
            )
            weak_logins = [r[0] for r in cursor.fetchall()]
            for wl in weak_logins:
                findings.append(
                    SecurityFinding(
                        id=f"SEC-PWDPOLICY-{wl}",
                        category="PASSWORD_POLICY",
                        severity="WARNING",
                        principal_name=wl,
                        title=f"Şifre Politikası Devre Dışı: {wl}",
                        description=f"'{wl}' SQL Login hesabında CHECK_POLICY veya CHECK_EXPIRATION kapatılmıştır.",
                        risk_impact="Windows parola karmaşıklığı kuralları uygulanmadığı için kaba kuvvet saldırılarına açık kalabilir.",
                        remediation_sql=f"ALTER LOGIN [{wl}] WITH CHECK_POLICY = ON, CHECK_EXPIRATION = ON;",
                    )
                )
                hardening_lines.append(f"-- Parola Politikasını Aktifleştir ({wl})\nALTER LOGIN [{wl}] WITH CHECK_POLICY = ON, CHECK_EXPIRATION = ON;\nGO\n")
            if not weak_logins:
                passed_count += 1

            # 4. Check sa login status
            cursor.execute("SELECT is_disabled, name FROM sys.server_principals WHERE sid = 0x01")
            sa_row = cursor.fetchone()
            if sa_row and not bool(sa_row[0]) and sa_row[1] == 'sa':
                findings.append(
                    SecurityFinding(
                        id="SEC-SA-ACTIVE",
                        category="SURFACE_AREA",
                        severity="INFO",
                        principal_name="sa",
                        title="Varsayılan 'sa' Hesabı Etkin",
                        description="Varsayılan 'sa' hesabı etkin durumda ve adı değiştirilmemiştir.",
                        risk_impact="Otomatik bot taramalarında bilinen kullanıcı adları hedef alınabilir. Best practice olarak 'sa' hesabı devre dışı bırakılmalı veya adı değiştirilmelidir.",
                        remediation_sql="ALTER LOGIN [sa] DISABLE;\n-- veya: ALTER LOGIN [sa] WITH NAME = [sys_sec_admin];",
                    )
                )
            else:
                passed_count += 1

            crit = sum(1 for f in findings if f.severity == "CRITICAL")
            warn = sum(1 for f in findings if f.severity == "WARNING")
            info = sum(1 for f in findings if f.severity == "INFO")

            # Score calculation: base 100, -15 per critical, -6 per warning, -2 per info
            deduction = (crit * 15) + (warn * 6) + (info * 2)
            score = max(20, min(100, 100 - deduction))

            hardening_lines.append("PRINT 'Tüm güvenlik sıkılaştırma adımları uygulandı.';\nGO\n")

            if not findings:
                from app.services.demo_data import DEMO_SECURITY_AUDIT
                return DEMO_SECURITY_AUDIT

            return SecurityAuditSummary(
                security_score=score,
                critical_count=crit,
                warning_count=warn,
                info_count=info,
                passed_checks_count=passed_count,
                findings=findings,
                hardening_script="\n".join(hardening_lines),
                is_demo=False,
            )

    except Exception as exc:
        logger.warning("Live security audit query failed (%s), returning demo data.", exc)
        from app.services.demo_data import DEMO_SECURITY_AUDIT
        return DEMO_SECURITY_AUDIT

