"""api/high_availability.py — Always On Availability Group status."""
from __future__ import annotations

import logging
from fastapi import APIRouter

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.high_availability import HAStatusResponse, AGLagAnalysisResponse
from app.services.ha_service import get_ha_status, get_ag_lag_telemetry

logger = logging.getLogger(__name__)

router = APIRouter(tags=["High Availability"])


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


@router.get("/high-availability/status", response_model=HAStatusResponse)
@router.get("/ha/status", response_model=HAStatusResponse)
def read_ha_status():
    """Retrieve Always On Availability Groups, replica health, and sync states."""
    params = _get_connection_params()
    try:
        return get_ha_status(params)
    except Exception as exc:
        logger.error("HA status error: %s", exc)
        return HAStatusResponse(
            available=False,
            reason=f"Yüksek erişilebilirlik durumu alınamadı: {str(exc)}",
            groups=[],
        )


@router.get("/high-availability/lag-telemetry", response_model=AGLagAnalysisResponse)
@router.get("/ha/lag-telemetry", response_model=AGLagAnalysisResponse)
def read_ag_lag_telemetry():
    """Retrieve AlwaysOn AG log send queue, redo lag, RPO (data loss) and RTO (recovery time) metrics."""
    params = _get_connection_params()
    try:
        return get_ag_lag_telemetry(params)
    except Exception as exc:
        logger.error("AG lag telemetry error: %s", exc)
        from app.services.ha_service import _get_demo_ag_telemetry
        return _get_demo_ag_telemetry(is_live_unavailable=True)
