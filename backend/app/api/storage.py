"""api/storage.py — Endpoints for database storage, autogrowth tracking, and log space usage."""
from __future__ import annotations

import logging
from fastapi import APIRouter

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.storage import StorageSummary
from app.services.storage_service import get_storage_summary

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Storage & Files"])


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


@router.get("/storage", response_model=StorageSummary)
def read_storage_summary():
    """Retrieve database files, autogrowth status, log reuse wait descriptions, and Default Trace autogrowth events."""
    params = _get_connection_params()
    return get_storage_summary(params)
