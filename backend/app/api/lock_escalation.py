"""api/lock_escalation.py — API endpoint for Lock Escalation and Contention Heatmap."""
from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, Query

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.lock_escalation import LockEscalationResponse
from app.services.lock_escalation_service import get_lock_escalation_analysis

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Incidents"])


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


@router.get("/incidents/lock-escalation", response_model=LockEscalationResponse)
def read_lock_escalation(
    database: Optional[str] = Query(None, description="Analiz edilecek veritabanı adı"),
):
    """Retrieve lock contention, wait statistics, and table lock escalation metrics
    from sys.dm_db_index_operational_stats.
    """
    params = _get_connection_params()
    return get_lock_escalation_analysis(params, database_name=database)
