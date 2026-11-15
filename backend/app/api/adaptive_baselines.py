"""api/adaptive_baselines.py — Endpoint for Adaptive Query Performance Baselines & Regression Warning Engine."""
from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, Query

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.adaptive_baselines import AdaptiveBaselineResponse
from app.services.adaptive_baselines_service import get_adaptive_baselines

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


@router.get("/query-performance/adaptive-baselines", response_model=AdaptiveBaselineResponse)
def read_adaptive_baselines(
    database: Optional[str] = Query(None, description="Optional target database filter"),
    window_hours: int = Query(24, ge=1, le=168, description="Recent analysis window in hours"),
    min_executions: int = Query(3, ge=1, description="Minimum executions to consider"),
    severity: Optional[str] = Query(None, description="Severity filter: CRITICAL, HIGH, MODERATE or ALL"),
):
    """Retrieve adaptive query performance baselines, standard deviation bands,
    detected performance regressions, root cause diagnostics, and plan forcing scripts.
    """
    params = _get_connection_params()
    return get_adaptive_baselines(
        params=params,
        database=database,
        window_hours=window_hours,
        min_executions=min_executions,
        severity_filter=severity,
    )
