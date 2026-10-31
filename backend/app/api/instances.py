"""api/instances.py — SQL Server instance metadata, sessions, and blocking."""
from __future__ import annotations

import logging
from typing import List, Optional
from fastapi import APIRouter, Query, Response, HTTPException

from app.core.config import settings
from app.core.exceptions import DatabaseConnectionError, PermissionDeniedError
from app.db.connection import ConnectionParams
from app.services.server_registry import server_registry
from app.schemas.instances import (
    BlockingResponse,
    DatabaseInfo,
    ServerMetadata,
    SessionInfo,
    ServerConfigurationSummary,
    LiveProcessSummary,
)
from app.services.instance_service import (
    get_blocking,
    get_databases,
    get_server_metadata,
    get_sessions,
    get_server_configurations,
    get_live_process_summary,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Instances"])


def _get_connection_params(database: Optional[str] = None) -> ConnectionParams:
    params = server_registry.get_connection_params_for_active_server()
    if database:
        params.database = database
    return params


@router.get("/instance/metadata", response_model=ServerMetadata)
@router.get("/instances/metadata", response_model=ServerMetadata)
def read_instance_metadata(response: Response):
    """Retrieve SQL Server instance version, memory, CPU, and database overview."""
    params = _get_connection_params()
    try:
        return get_server_metadata(params)
    except Exception as exc:
        logger.error("Live metadata unavailable: %s", exc)
        raise HTTPException(
            status_code=503,
            detail=f"Sunucu meta verisi alınamadı: {str(exc)}",
        )


@router.get("/instance/databases", response_model=List[DatabaseInfo])
@router.get("/instances/databases", response_model=List[DatabaseInfo])
def read_instance_databases(response: Response):
    """List databases with state, recovery model, and sizes."""
    params = _get_connection_params()
    try:
        return get_databases(params)
    except Exception as exc:
        logger.warning("Live databases query failed: %s", exc)
        return []


@router.get("/sessions", response_model=List[SessionInfo])
@router.get("/instance/sessions", response_model=List[SessionInfo])
@router.get("/instances/sessions", response_model=List[SessionInfo])
def read_sessions(
    response: Response,
    active_only: bool = Query(True, description="Filter out sleeping sessions"),
    include_system: bool = Query(False, description="Include system sessions"),
    min_duration_ms: int = Query(0, ge=0, description="Minimum wait duration in ms"),
):
    """Retrieve active SQL Server sessions with resource usage and SQL text."""
    params = _get_connection_params()
    try:
        return get_sessions(
            params,
            include_sleeping=not active_only,
            min_duration_ms=min_duration_ms,
        )
    except Exception as exc:
        logger.warning("Live sessions query failed: %s", exc)
        return []


@router.get("/sessions/live", response_model=LiveProcessSummary)
def read_live_process_summary(
    active_only: bool = Query(True, description="Filter out sleeping sessions"),
    min_duration_ms: int = Query(0, ge=0, description="Minimum wait duration in ms"),
):
    """Retrieve active sessions with real-time KPI aggregates and sp_WhoIsActive-grade diagnostics."""
    params = _get_connection_params()
    return get_live_process_summary(params, active_only=active_only, min_duration_ms=min_duration_ms)


@router.get("/blocking", response_model=BlockingResponse)
@router.get("/instance/blocking", response_model=BlockingResponse)
@router.get("/instances/blocking", response_model=BlockingResponse)
def read_blocking_chains(response: Response):
    """Identify active head blockers and blocked session chains."""
    params = _get_connection_params()
    try:
        return get_blocking(params)
    except Exception as exc:
        logger.warning("Live blocking query failed: %s", exc)
        return BlockingResponse(root_blockers=[], blocked_sessions=[])


@router.get("/instance/configurations", response_model=ServerConfigurationSummary)
@router.get("/instances/configurations", response_model=ServerConfigurationSummary)
def read_server_configurations(response: Response):
    """Retrieve SQL Server sp_configure settings and audit them against DBA best practice guidelines."""
    params = _get_connection_params()
    try:
        return get_server_configurations(params)
    except Exception as exc:
        logger.warning("Live configurations query failed: %s", exc)
        return ServerConfigurationSummary(
            compliance_score=100,
            total_configurations=0,
            optimal_count=0,
            warning_count=0,
            critical_count=0,
            items=[],
            remediation_script="",
            is_demo=False,
        )
