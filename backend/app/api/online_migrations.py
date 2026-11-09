"""api/online_migrations.py — Endpoints for Zero-Downtime Online Schema Migration & Shadow Evolution Studio."""
from __future__ import annotations

import logging
from typing import List, Optional
from fastapi import APIRouter, Query, HTTPException

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.online_migration import (
    CandidateTableInfo,
    TableSchemaInspection,
    GenerateMigrationRunbookRequest,
    MigrationRunbookResponse,
)
from app.services.online_migration_service import (
    list_candidate_tables,
    inspect_table_for_migration,
    generate_migration_runbook,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/online-migrations", tags=["Zero-Downtime Online Migrations"])


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


@router.get("/tables", response_model=List[CandidateTableInfo])
def get_candidate_tables_endpoint(
    database: Optional[str] = Query(None, description="Target database to inspect"),
):
    """Retrieve tables sorted by row count and evaluate online migration risk level."""
    params = _get_connection_params()
    try:
        return list_candidate_tables(params=params, database_name=database)
    except Exception as exc:
        logger.error("Error retrieving candidate tables for migration: %s", exc)
        return list_candidate_tables(params=None, database_name=database or "Datapath_TestDB")


@router.get("/table-details", response_model=TableSchemaInspection)
def get_table_details_endpoint(
    table: str = Query(..., description="Target table name"),
    schema: str = Query("dbo", description="Target schema name"),
    database: Optional[str] = Query(None, description="Target database name"),
):
    """Inspect columns, types, nullability, and indexes of a specific table."""
    params = _get_connection_params()
    target_db = database or settings.DB_DATABASE or "Datapath_TestDB"
    try:
        return inspect_table_for_migration(
            params=params,
            database_name=target_db,
            table_name=table,
            schema_name=schema,
        )
    except Exception as exc:
        logger.error("Error inspecting table schema: %s", exc)
        return inspect_table_for_migration(
            params=None,
            database_name=target_db,
            table_name=table,
            schema_name=schema,
        )


@router.post("/generate-runbook", response_model=MigrationRunbookResponse)
def generate_runbook_endpoint(req: GenerateMigrationRunbookRequest):
    """Generate production-grade 5-phase zero-downtime T-SQL runbook for schema migration."""
    try:
        return generate_migration_runbook(req)
    except Exception as exc:
        logger.error("Error generating online migration runbook: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
