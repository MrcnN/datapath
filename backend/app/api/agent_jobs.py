"""api/agent_jobs.py — Endpoints for SQL Server Agent jobs, schedules, and step failure diagnostics."""
from __future__ import annotations

import logging
from typing import List
from fastapi import APIRouter, Path

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.agent_jobs import AgentJobsSummary, JobStepHistory
from app.services.agent_jobs_service import get_agent_jobs_summary, get_job_step_history

logger = logging.getLogger(__name__)

router = APIRouter(tags=["SQL Agent Jobs"])


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


@router.get("/agent-jobs/summary", response_model=AgentJobsSummary)
def read_agent_jobs_summary():
    """Retrieve SQL Server Agent status, jobs list, last execution statuses, and failure details."""
    params = _get_connection_params()
    return get_agent_jobs_summary(params)


@router.get("/agent-jobs/{job_id}/history", response_model=List[JobStepHistory])
def read_job_step_history(job_id: str = Path(..., description="Job unique identifier")):
    """Retrieve step-by-step execution history and log messages for a specific job."""
    params = _get_connection_params()
    return get_job_step_history(job_id, params)
