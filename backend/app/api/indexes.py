"""api/indexes.py — Endpoints for Index Intelligence, Missing Indexes, and Fragmentation."""
from __future__ import annotations

import logging
from typing import List, Optional
from fastapi import APIRouter, Query

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.indexes import (
    IndexFragmentation,
    IndexSummary,
    MissingIndex,
    UnusedIndex,
)
from app.services.index_service import (
    get_index_fragmentation,
    get_index_summary,
    get_missing_indexes,
    get_unused_indexes,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Indexes"])


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


@router.get("/indexes/summary", response_model=IndexSummary)
def read_index_summary(
    database: Optional[str] = Query(None, description="Database name filter")
):
    """Retrieve overall KPI summary for index health and optimization opportunities."""
    params = _get_connection_params()
    return get_index_summary(params, database)


@router.get("/indexes/missing", response_model=List[MissingIndex])
def read_missing_indexes(
    database: Optional[str] = Query(None, description="Database name filter")
):
    """Retrieve top missing index recommendations from SQL Server DMVs with impact scores."""
    params = _get_connection_params()
    return get_missing_indexes(params, database)


@router.get("/indexes/unused", response_model=List[UnusedIndex])
def read_unused_indexes(
    database: Optional[str] = Query(None, description="Database name filter")
):
    """Retrieve unused non-clustered indexes that incur write penalty with zero read benefit."""
    params = _get_connection_params()
    return get_unused_indexes(params, database)


@router.get("/indexes/fragmentation", response_model=List[IndexFragmentation])
def read_index_fragmentation(
    database: Optional[str] = Query(None, description="Database name filter")
):
    """Retrieve index fragmentation stats and reorganization / rebuild recommendations."""
    params = _get_connection_params()
    return get_index_fragmentation(params, database)
