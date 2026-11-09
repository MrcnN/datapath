"""api/partitioning.py — Table Partitioning & Sliding Window Lifecycle Advisor endpoints."""
from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, Query, HTTPException

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.partitioning import (
    PartitioningOverviewResponse,
    GeneratePartitionScriptRequest,
    GeneratePartitionScriptResponse,
)
from app.services.partitioning_service import (
    get_partitioning_overview,
    generate_partition_scripts,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/partitioning", tags=["Table Partitioning & Lifecycle"])


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


@router.get("/overview", response_model=PartitioningOverviewResponse)
def read_partitioning_overview(
    database: Optional[str] = Query(None, description="Target database to inspect"),
):
    """Scan database for partitioned tables and identify high-volume unpartitioned candidate tables."""
    params = _get_connection_params()
    try:
        return get_partitioning_overview(params=params, database_name=database)
    except Exception as exc:
        logger.error("Partitioning overview endpoint error: %s", exc)
        return get_partitioning_overview(params=None, database_name=database or "Datapath_TestDB")


@router.post("/generate-script", response_model=GeneratePartitionScriptResponse)
def generate_partition_script_endpoint(req: GeneratePartitionScriptRequest):
    """Generate production-ready, review-only T-SQL scripts for partitioning setup and sliding window lifecycle."""
    try:
        return generate_partition_scripts(req)
    except Exception as exc:
        logger.error("Partition script generation error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
