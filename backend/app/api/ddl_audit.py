"""api/ddl_audit.py — DDL Audit & Schema Change Timeline API endpoints."""
from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, Query

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.ddl_audit import DDLActionType, DDLAuditResponse
from app.services.ddl_audit_service import get_ddl_audit_events

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ddl-audit", tags=["DDL Audit & Schema Timeline"])


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


@router.get("/events", response_model=DDLAuditResponse)
def read_ddl_audit_events(
    database: Optional[str] = Query(None, description="Opsiyonel veritabanı adı filtresi"),
    action_type: Optional[DDLActionType] = Query(None, description="CREATE, ALTER veya DROP filtresi"),
    limit: int = Query(100, ge=1, le=500, description="Döndürülecek maksimum olay sayısı"),
):
    """SQL Server Default Trace ve şema denetim günlüğü üzerinden DDL değişiklik geçmişini listeler."""
    params = _get_connection_params()
    try:
        return get_ddl_audit_events(
            params=params,
            database=database,
            action_type=action_type,
            limit=limit,
        )
    except Exception as exc:
        logger.warning("Error querying DDL events from trace (%s), falling back to audit history", exc)
        return get_ddl_audit_events(
            params=None,
            database=database,
            action_type=action_type,
            limit=limit,
        )
