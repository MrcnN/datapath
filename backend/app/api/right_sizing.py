"""api/right_sizing.py — Endpoint for Resource Right-Sizing and Cost Optimization Advisor."""
from __future__ import annotations

import logging
from fastapi import APIRouter

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.right_sizing import RightSizingResponse
from app.services.right_sizing_service import get_right_sizing_advisor

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Instances"])


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


@router.get("/instances/right-sizing", response_model=RightSizingResponse)
def read_right_sizing_advisor():
    """Retrieve hardware resource right-sizing assessment, CPU/Memory utilization,
    cloud cost optimization opportunities, and server configuration prescriptions.
    """
    params = _get_connection_params()
    return get_right_sizing_advisor(params)
