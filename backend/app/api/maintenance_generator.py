"""api/maintenance_generator.py — Ola Hallengren and Native Maintenance Generator API."""
from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, Query

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.maintenance_generator import (
    MaintenanceStatusResponse,
    MaintenanceJobGenerateRequest,
    MaintenanceJobScriptResponse,
)
from app.services.maintenance_generator_service import (
    get_maintenance_status,
    generate_maintenance_scripts,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])


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


@router.get("/status", response_model=MaintenanceStatusResponse)
def read_maintenance_status(
    target_database: Optional[str] = Query("master", description="Ola Hallengren nesnelerinin arandığı veritabanı"),
):
    """Inspect whether Ola Hallengren stored procedures, CommandLog, and existing
    Agent maintenance jobs are active on the SQL Server instance.
    """
    params = _get_connection_params()
    return get_maintenance_status(params, target_db=target_database or "master")


@router.post("/generate-jobs", response_model=MaintenanceJobScriptResponse)
def create_maintenance_jobs(
    request: MaintenanceJobGenerateRequest,
):
    """Generate production-ready, idempotent T-SQL scripts for SQL Server Agent
    maintenance jobs (Ola Hallengren or Native T-SQL).
    """
    return generate_maintenance_scripts(request)
