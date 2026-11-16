"""api/latch_spinlock.py — API endpoint for Latch and Spinlock Contention Studio."""
from __future__ import annotations

import logging
from fastapi import APIRouter

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.latch_spinlock import LatchSpinlockResponse
from app.services.latch_spinlock_service import get_latch_spinlock_analysis

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


@router.get("/wait-stats/latches-spinlocks", response_model=LatchSpinlockResponse)
def read_latch_spinlock_stats():
    """Retrieve SQL Server kernel latch wait statistics (sys.dm_os_latch_stats)
    and spinlock collision metrics (sys.dm_os_spinlock_stats).
    """
    params = _get_connection_params()
    return get_latch_spinlock_analysis(params)
