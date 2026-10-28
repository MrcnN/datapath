"""api/tempdb_memory.py — Endpoints for TempDB allocation, contention, and Buffer Pool / Memory Intelligence."""
from __future__ import annotations

import logging
from fastapi import APIRouter

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.tempdb_memory import TempDBMemorySummary
from app.services.tempdb_memory_service import get_tempdb_memory_summary

logger = logging.getLogger(__name__)

router = APIRouter(tags=["TempDB & Memory"])


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


@router.get("/tempdb-memory", response_model=TempDBMemorySummary)
def read_tempdb_memory_summary():
    """Retrieve TempDB space breakdown, allocation contention, Page Life Expectancy (PLE), and Memory Clerks."""
    params = _get_connection_params()
    return get_tempdb_memory_summary(params)
