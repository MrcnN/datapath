"""api/config_drift.py — API endpoint for Multi-Environment Configuration Drift."""
from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, Query

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.config_drift import ConfigDriftResponse
from app.services.config_drift_service import get_configuration_drift_analysis

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Configuration"])


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


@router.get("/configuration/drift", response_model=ConfigDriftResponse)
def read_configuration_drift(
    baseline: Optional[str] = Query("ENTERPRISE_PROD_STANDARD", description="Karşılaştırılacak Golden Baseline profili"),
):
    """Retrieve configuration drift assessment comparing the server's sp_configure
    and database options against corporate Golden Baselines.
    """
    params = _get_connection_params()
    return get_configuration_drift_analysis(params, baseline_key=baseline)
