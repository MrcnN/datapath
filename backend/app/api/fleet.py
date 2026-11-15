"""api/fleet.py — Multi-Server Fleet Overview & Estate Intelligence API endpoints."""
from __future__ import annotations

import logging
from fastapi import APIRouter

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.fleet import FleetOverviewResponse
from app.services.fleet_service import get_fleet_overview

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/fleet", tags=["Multi-Server Fleet Overview"])


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


@router.get("/overview", response_model=FleetOverviewResponse)
def read_fleet_overview():
    """Tüm bağlı ve kayıtlı SQL Server instance'larının genel filo sağlık matrisini ve özet metriklerini getirir."""
    params = _get_connection_params()
    try:
        return get_fleet_overview(params=params)
    except Exception as exc:
        logger.warning("Live fleet metrics collection failed (%s), falling back to offline mode", exc)
        return get_fleet_overview(params=None)
