"""api/instances.py — SQL Server instance metadata, sessions, and blocking."""
from __future__ import annotations

import logging
from typing import List, Optional
from fastapi import APIRouter, Query, Response

from app.core.config import settings
from app.core.exceptions import DatabaseConnectionError, PermissionDeniedError
from app.db.connection import ConnectionParams
from app.schemas.instances import (
    BlockingResponse,
    DatabaseInfo,
    ServerMetadata,
    SessionInfo,
)
from app.services.instance_service import (
    get_blocking,
    get_databases,
    get_server_metadata,
    get_sessions,
)
from app.services.demo_data import (
    DEMO_BLOCKING,
    DEMO_DATABASES,
    DEMO_METADATA,
    DEMO_SESSIONS,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Instances"])


def _get_connection_params(database: Optional[str] = None) -> ConnectionParams:
    return ConnectionParams(
        server=settings.DB_SERVER,
        database=database or settings.DB_DATABASE,
        username=settings.DB_USERNAME or None,
        password=settings.DB_PASSWORD or None,
        trusted_connection=settings.DB_TRUSTED_CONNECTION,
        driver=settings.DB_DRIVER,
        timeout=settings.DB_TIMEOUT,
    )


@router.get("/instance/metadata", response_model=ServerMetadata)
@router.get("/instances/metadata", response_model=ServerMetadata)
def read_instance_metadata(response: Response):
    """Retrieve SQL Server instance version, memory, CPU, and database overview.
    
    Falls back to clearly labeled demo data if no live instance is connected.
    """
    params = _get_connection_params()
    try:
        return get_server_metadata(params)
    except Exception as exc:
        logger.debug("Live metadata unavailable (%s), returning demo data.", exc)
        response.headers["X-Traceforge-Demo"] = "true"
        return DEMO_METADATA


@router.get("/instance/databases", response_model=List[DatabaseInfo])
@router.get("/instances/databases", response_model=List[DatabaseInfo])
def read_instance_databases(response: Response):
    """List databases with state, recovery model, and sizes.
    
    Falls back to demo databases if live connection is unavailable.
    """
    params = _get_connection_params()
    try:
        return get_databases(params)
    except Exception as exc:
        logger.debug("Live databases unavailable (%s), returning demo data.", exc)
        response.headers["X-Traceforge-Demo"] = "true"
        return DEMO_DATABASES


@router.get("/sessions", response_model=List[SessionInfo])
@router.get("/instance/sessions", response_model=List[SessionInfo])
@router.get("/instances/sessions", response_model=List[SessionInfo])
def read_sessions(
    response: Response,
    active_only: bool = Query(True, description="Filter out sleeping sessions"),
    include_system: bool = Query(False, description="Include system sessions"),
    min_duration_ms: int = Query(0, ge=0, description="Minimum wait duration in ms"),
):
    """Retrieve active SQL Server sessions with resource usage and SQL text.
    
    Falls back to demo sessions if no live SQL Server is connected.
    """
    params = _get_connection_params()
    try:
        return get_sessions(
            params,
            include_sleeping=not active_only,
            min_duration_ms=min_duration_ms,
        )
    except Exception as exc:
        logger.debug("Live sessions unavailable (%s), returning demo data.", exc)
        response.headers["X-Traceforge-Demo"] = "true"
        return DEMO_SESSIONS


@router.get("/blocking", response_model=BlockingResponse)
@router.get("/instance/blocking", response_model=BlockingResponse)
@router.get("/instances/blocking", response_model=BlockingResponse)
def read_blocking_chains(response: Response):
    """Identify active head blockers and blocked session chains.
    
    Falls back to demo blocking chain if no live SQL Server is connected.
    """
    params = _get_connection_params()
    try:
        return get_blocking(params)
    except Exception as exc:
        logger.debug("Live blocking unavailable (%s), returning demo data.", exc)
        response.headers["X-Traceforge-Demo"] = "true"
        return DEMO_BLOCKING
