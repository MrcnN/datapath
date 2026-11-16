"""api/error_log_forensics.py — Error Log & Security Incident Forensic API."""
from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, Query

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.error_log_forensics import ErrorLogForensicsResponse
from app.services.error_log_forensics_service import get_error_log_forensics_analysis

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/incidents", tags=["Incidents"])


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


@router.get("/error-log-forensics", response_model=ErrorLogForensicsResponse)
def read_error_log_forensics(
    max_rows: int = Query(1000, description="İncelenecek maksimum log satırı sayısı"),
):
    """Retrieve categorized SQL Server Error Log forensic telemetry,
    including Error 18456 login failure sentinel and hardware/corruption analysis.
    """
    params = _get_connection_params()
    return get_error_log_forensics_analysis(params, max_rows=max_rows)
