"""api/plan_poisoning.py — Parameter Sniffing & Surgical Plan Eviction API."""
from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, Query

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.plan_poisoning import PlanPoisoningResponse
from app.services.plan_poisoning_service import get_plan_poisoning_analysis

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/query-performance", tags=["Query Performance"])


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


@router.get("/plan-poisoning", response_model=PlanPoisoningResponse)
def read_plan_poisoning(
    database: Optional[str] = Query(None, description="Filtrelenecek veritabanı adı"),
    min_variance: float = Query(5.0, description="Minimum süre varyans oranı eşiği (max / min)"),
):
    """Detect cached execution plans suffering from parameter sniffing with extreme
    execution time or CPU variance, and produce surgical eviction (DBCC FREEPROCCACHE) runbooks.
    """
    params = _get_connection_params()
    return get_plan_poisoning_analysis(params, database_name=database, min_variance_ratio=min_variance)
