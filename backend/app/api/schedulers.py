"""api/schedulers.py — CPU SOS Schedulers & Worker Thread Pool API."""
from __future__ import annotations

import logging
from fastapi import APIRouter

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.schedulers import SchedulersResponse
from app.services.schedulers_service import get_schedulers_analysis

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/instances", tags=["Instances"])


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


@router.get("/schedulers", response_model=SchedulersResponse)
def read_schedulers_analysis():
    """Retrieve SQL Server CPU SOS Schedulers, Worker Thread Pool saturation,
    runnable task queues, and NUMA node workload metrics from sys.dm_os_schedulers.
    """
    params = _get_connection_params()
    return get_schedulers_analysis(params)
