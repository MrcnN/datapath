"""api/wait_stats.py — Endpoints for SQL Server Wait Statistics & CPU Scheduling Pressure."""
from __future__ import annotations

import logging
from fastapi import APIRouter

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.wait_stats import WaitStatsSummary
from app.services.wait_stats_service import get_wait_statistics

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Wait Statistics"])


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


@router.get("/waits", response_model=WaitStatsSummary)
def read_wait_statistics():
    """Retrieve categorized SQL Server wait statistics and CPU scheduling pressure metrics."""
    params = _get_connection_params()
    return get_wait_statistics(params)
