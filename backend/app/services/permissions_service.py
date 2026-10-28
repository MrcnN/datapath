"""services/permissions_service.py — Server logins, DB users, roles."""
from __future__ import annotations

import logging
from typing import List, Optional

import pyodbc

from app.core.exceptions import PermissionDeniedError
from app.db.connection import ConnectionParams, get_db_connection, rows_to_dicts
from app.schemas.permissions import DatabaseUser, RoleMember, ServerLogin, ServerRole

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
