"""api/autogrowth_audit.py — Auto-Growth and Auto-Shrink Risk Auditor API."""
from __future__ import annotations

import logging
from fastapi import APIRouter

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.autogrowth_audit import AutoGrowthAuditResponse
from app.services.autogrowth_audit_service import get_autogrowth_audit_analysis

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/toolkit", tags=["Toolkit & Best Practices"])


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


@router.get("/autogrowth-audit", response_model=AutoGrowthAuditResponse)
def read_autogrowth_audit():
    """Audit database files for harmful configuration such as AUTO_SHRINK,
    AUTO_CLOSE, percentage growth, small 1MB increments, and Instant File Initialization.
    """
    params = _get_connection_params()
    return get_autogrowth_audit_analysis(params)
