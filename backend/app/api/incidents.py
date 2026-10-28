"""api/incidents.py — Incident Center: Deadlocks, Agent Jobs, Error Logs, Timeline."""
from __future__ import annotations

import logging
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Query, HTTPException

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.incidents import (
    AgentJobResponse,
    DeadlockInfo,
    ErrorLogEntry,
    TimelineEvent,
)
from app.services.incident_service import (
    get_agent_jobs,
    get_error_log,
    get_incident_timeline,
    parse_deadlock_xml,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Incidents"])


class DeadlockParseRequest(BaseModel):
    xml_content: str


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


@router.post("/deadlocks/parse", response_model=DeadlockInfo)
@router.post("/incidents/deadlock", response_model=DeadlockInfo)
def parse_deadlock(request: DeadlockParseRequest):
    """Parse a SQL Server deadlock graph (XDL format) into structured entities."""
    try:
        return parse_deadlock_xml(request.xml_content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Deadlock parsing error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Deadlock ayrıştırma hatası: {str(exc)}")


@router.get("/agent-jobs", response_model=AgentJobResponse)
@router.get("/incidents/agent-jobs", response_model=AgentJobResponse)
def read_agent_jobs(
    days_back: int = Query(7, ge=1, le=90, description="Days of history to search"),
    failed_only: bool = Query(True, description="Filter only failed executions"),
):
    """Retrieve SQL Server Agent job history, filtering by outcome and date."""
    params = _get_connection_params()
    try:
        return get_agent_jobs(params, days_back=days_back, include_successful=not failed_only)
    except Exception as exc:
        logger.error("Agent jobs fetch error: %s", exc)
        return AgentJobResponse(available=False, reason=str(exc), jobs=[])


@router.get("/error-log", response_model=List[ErrorLogEntry])
@router.get("/incidents/error-log", response_model=List[ErrorLogEntry])
def read_error_log(
    search: Optional[str] = Query(None, description="Search keyword in error log"),
    log_number: int = Query(0, ge=0, description="Log archive number (0 = current)"),
    rows: int = Query(100, ge=1, le=1000, description="Max rows to return"),
):
    """Retrieve entries from the SQL Server error log."""
    params = _get_connection_params()
    try:
        return get_error_log(params, search_text=search or "", log_number=log_number, rows=rows)
    except Exception as exc:
        logger.debug("Error log unavailable: %s", exc)
        return []


@router.get("/incident-timeline", response_model=List[TimelineEvent])
@router.get("/incidents/timeline", response_model=List[TimelineEvent])
def read_incident_timeline(
    hours_back: int = Query(24, ge=1, le=168, description="Hours of timeline events"),
):
    """Aggregated timeline of incidents, deadlocks, and failed jobs."""
    params = _get_connection_params()
    try:
        return get_incident_timeline(params, hours_back=hours_back)
    except Exception as exc:
        logger.error("Timeline fetch error: %s", exc)
        return []
