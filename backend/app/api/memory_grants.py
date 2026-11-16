"""api/memory_grants.py — API endpoint for Memory Grant Starvation & Resource Semaphore Studio."""
from __future__ import annotations

import logging
from fastapi import APIRouter

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.memory_grants import MemoryGrantResponse
from app.services.memory_grants_service import get_memory_grants_analysis

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Query Performance"])


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


@router.get("/query-performance/memory-grants", response_model=MemoryGrantResponse)
def read_memory_grants():
    """Retrieve SQL Server memory grant allocation, RESOURCE_SEMAPHORE queue status,
    active query memory grants, and plan cache memory grant wasters/spills.
    """
    params = _get_connection_params()
    return get_memory_grants_analysis(params)
