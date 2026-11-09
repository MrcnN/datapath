"""api/time_travel.py — Endpoints for Workload Time-Travel Correlator & Spike Detective."""
from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, Query, HTTPException

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.time_travel import (
    TimeTravelCorrelatorOverview,
    TimeTravelSnapshotDetail,
)
from app.services.time_travel_service import (
    get_time_travel_overview,
    get_interval_snapshot,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/time-travel", tags=["Workload Time-Travel Correlator"])


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


@router.get("/overview", response_model=TimeTravelCorrelatorOverview)
def get_time_travel_overview_endpoint(
    database: Optional[str] = Query(None, description="Target database to inspect"),
    time_range: str = Query("24H", description="Time window: 1H, 6H, 24H"),
):
    """Retrieve temporal metrics timeline, detected performance spikes, and initial correlated snapshot."""
    params = _get_connection_params()
    try:
        return get_time_travel_overview(params=params, database_name=database, time_range=time_range)
    except Exception as exc:
        logger.error("Error retrieving time-travel overview: %s", exc)
        return get_time_travel_overview(params=None, database_name=database or "Datapath_TestDB", time_range=time_range)


@router.get("/snapshot", response_model=TimeTravelSnapshotDetail)
def get_interval_snapshot_endpoint(
    interval_id: int = Query(..., description="Query Store runtime stats interval ID"),
    database: Optional[str] = Query(None, description="Target database name"),
):
    """Retrieve correlated queries, wait breakdown, and infrastructure events for a specific minute."""
    params = _get_connection_params()
    target_db = database or settings.DB_DATABASE or "Datapath_TestDB"
    try:
        return get_interval_snapshot(params=params, database_name=target_db, interval_id=interval_id)
    except Exception as exc:
        logger.error("Error retrieving interval snapshot: %s", exc)
        return get_interval_snapshot(params=None, database_name=target_db, interval_id=interval_id)
