"""api/memory_clerks.py — Memory Clerks, Plan Cache Bloat & OS Memory API."""
from __future__ import annotations

import logging
from fastapi import APIRouter

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.memory_clerks import MemoryClerksResponse
from app.services.memory_clerks_service import get_memory_clerks_analysis

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/storage", tags=["Storage & Memory"])


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


@router.get("/memory-clerks", response_model=MemoryClerksResponse)
def read_memory_clerks():
    """Retrieve SQL Server memory clerks allocation, plan cache bloat from
    single-use ad-hoc queries, and OS physical memory pressure indicators.
    """
    params = _get_connection_params()
    return get_memory_clerks_analysis(params)
