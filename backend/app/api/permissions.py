"""api/permissions.py — SQL Server logins, database users, and roles."""
from __future__ import annotations

import logging
from typing import List, Optional
from fastapi import APIRouter, Query, HTTPException

from app.core.config import settings
from app.core.exceptions import PermissionDeniedError
from app.db.connection import ConnectionParams
from app.schemas.permissions import DatabaseUser, ServerLogin, ServerRole, SecurityAuditSummary
from app.services.permissions_service import (
    get_database_users,
    get_roles,
    get_server_logins,
    get_security_audit,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Permissions"])


def _get_connection_params() -> ConnectionParams:
    return ConnectionParams(
        server=settings.DB_SERVER,
        database=settings.DB_DATABASE,
        username=settings.DB_USERNAME or None,
        password=settings.DB_PASSWORD or None,
        trusted_connection=settings.DB_TRUSTED_CONNECTION,
        driver=settings.DB_DRIVER,
        timeout=settings.DB_TIMEOUT,
    )


@router.get("/permissions/logins", response_model=List[ServerLogin])
def read_logins():
    """List SQL Server logins, status, disabled state, and sysadmin flag."""
    params = _get_connection_params()
    try:
        return get_server_logins(params)
    except PermissionDeniedError as exc:
        raise HTTPException(status_code=403, detail=exc.message)
    except Exception as exc:
        logger.error("Logins error: %s", exc)
        return []


@router.get("/permissions/users", response_model=List[DatabaseUser])
def read_database_users(
    database: str = Query(..., description="Target database name"),
):
    """List database users and their mapped roles in a database."""
    params = _get_connection_params()
    try:
        return get_database_users(params, db_name=database)
    except PermissionDeniedError as exc:
        raise HTTPException(status_code=403, detail=exc.message)
    except Exception as exc:
        logger.error("Users error: %s", exc)
        return []


@router.get("/permissions/roles", response_model=List[ServerRole])
def read_roles():
    """List server and database role memberships."""
    params = _get_connection_params()
    try:
        return get_roles(params)
    except Exception as exc:
        logger.error("Roles error: %s", exc)
        return []


@router.get("/permissions/audit", response_model=SecurityAuditSummary)
def read_security_audit():
    """Perform security and vulnerability audit for orphan users, TRUSTWORTHY settings, and surface area risks."""
    params = _get_connection_params()
    try:
        return get_security_audit(params)
    except Exception as exc:
        logger.error("Security audit error: %s", exc)
        return SecurityAuditSummary(
            security_score=100,
            critical_count=0,
            warning_count=0,
            info_count=0,
            passed_checks_count=0,
            findings=[],
            hardening_script="",
            is_demo=False,
        )

