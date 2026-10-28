"""api/query_performance.py — Query Store metrics, expensive queries, and regressions."""
from __future__ import annotations

import logging
from typing import List, Optional
from fastapi import APIRouter, Query, HTTPException

from app.core.config import settings
from app.core.exceptions import FeatureUnavailableError
from app.db.connection import ConnectionParams
from app.schemas.query_performance import (
    ExpensiveQuery,
    QueryStoreOverview,
    RegressionResult,
)
from app.services.query_performance_service import (
    get_expensive_queries,
    get_query_store_overview,
    get_regressions,
)

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


@router.get("/query-store/overview", response_model=QueryStoreOverview)
@router.get("/query-performance/overview", response_model=QueryStoreOverview)
def read_query_store_overview(
    database: Optional[str] = Query(None, description="Specific database to check"),
):
    """Retrieve Query Store operational state, capture mode, and storage size."""
    params = _get_connection_params()
    if database:
        params.database = database
    try:
        return get_query_store_overview(params)
    except Exception as exc:
        logger.error("Query Store overview error: %s", exc)
        return QueryStoreOverview(enabled=False, databases_with_qs=[])


@router.get("/query-store/expensive", response_model=List[ExpensiveQuery])
@router.get("/query-performance/expensive", response_model=List[ExpensiveQuery])
@router.get("/query-performance/expensive-queries", response_model=List[ExpensiveQuery])
def read_expensive_queries(
    database: str = Query(..., description="Target database with Query Store enabled"),
    metric: str = Query("cpu_time", description="Metric to sort by: cpu_time, duration, execution_count, logical_reads"),
    top_n: int = Query(25, ge=1, le=100, description="Top N queries to return"),
    time_range_hours: int = Query(24, ge=1, le=720, description="History window in hours"),
):
    """Identify top expensive queries using Query Store runtime statistics."""
    params = _get_connection_params()
    try:
        return get_expensive_queries(
            params,
            db_name=database,
            metric=metric,
            top_n=top_n,
            time_range_hours=time_range_hours,
        )
    except FeatureUnavailableError:
        return []
    except Exception as exc:
        logger.debug("Expensive queries unavailable: %s", exc)
        return []


@router.get("/query-store/regressions", response_model=List[RegressionResult])
@router.get("/query-performance/regressions", response_model=List[RegressionResult])
@router.get("/query-performance/regression", response_model=List[RegressionResult])
def read_query_regressions(
    database: str = Query(..., description="Target database"),
    window_hours: int = Query(24, ge=1, le=168, description="Comparison window in hours"),
    min_exec_count: int = Query(5, ge=1, description="Minimum executions to consider"),
):
    """Detect performance regressions comparing recent interval against prior baseline."""
    params = _get_connection_params()
    try:
        return get_regressions(
            params,
            db_name=database,
            window_hours=window_hours,
            min_exec_count=min_exec_count,
        )
    except FeatureUnavailableError:
        return []
    except Exception as exc:
        logger.debug("Regressions unavailable: %s", exc)
        return []
