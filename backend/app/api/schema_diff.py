"""api/schema_diff.py — Database schema comparison and review-only change scripts."""
from __future__ import annotations

import logging
from typing import List
from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.schema_diff import (
    SchemaDiffRequest,
    SchemaDiffResponse,
)
from app.services.schema_diff_service import compare_schemas, list_databases

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Schema Diff"])


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


@router.get("/schema-diff/databases", response_model=List[str])
def read_schema_diff_databases():
    """List databases available for schema comparison."""
    params = _get_connection_params()
    try:
        return list_databases(params)
    except Exception as exc:
        logger.error("List databases error: %s", exc)
        return []


@router.post("/schema-diff/compare", response_model=SchemaDiffResponse)
def compare_database_schemas(request: SchemaDiffRequest):
    """Compare two database schemas and generate a review-only change script.
    
    Safety rule: The generated script is never executed automatically.
    """
    params = _get_connection_params()
    try:
        return compare_schemas(params, request)
    except Exception as exc:
        logger.error("Schema compare error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
