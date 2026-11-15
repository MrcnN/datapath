"""api/query_fingerprint.py — Endpoint for Query Fingerprinting and Signature Normalization."""
from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, Query

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.query_fingerprint import QueryFingerprintResponse
from app.services.query_fingerprint_service import get_query_fingerprints

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


@router.get("/query-performance/fingerprints", response_model=QueryFingerprintResponse)
def read_query_fingerprints(
    metric: str = Query("duration", description="Sorting metric: duration, cpu, reads, or executions"),
    limit: int = Query(50, ge=1, le=200, description="Max query signatures to return"),
    search: Optional[str] = Query(None, description="Optional text filter across query signature or hash"),
):
    """Retrieve normalized query fingerprints / signatures grouped by query_hash,
    identifying high-impact query families, plan variants, and unparameterized cache bloat.
    """
    params = _get_connection_params()
    return get_query_fingerprints(
        params=params,
        metric=metric,
        limit=limit,
        search=search,
    )
