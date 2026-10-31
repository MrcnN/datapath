"""api/backups.py — Backup history and recovery readiness."""
from __future__ import annotations

import logging
from typing import List, Optional
from fastapi import APIRouter, Query, HTTPException

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.backups import (
    BackupRecord,
    RecoveryReadiness,
    DatabaseIntegrityCheck,
    IntegrityAndCorruptionSummary,
)
from app.services.backup_service import (
    get_backup_history,
    get_recovery_readiness,
    get_database_integrity_checks,
    get_integrity_and_corruption_summary,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Backups"])


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


@router.get("/backups/history", response_model=List[BackupRecord])
def read_backup_history(
    database: Optional[str] = Query(None, description="Database name filter"),
    days_back: int = Query(30, ge=1, le=365, description="Number of days to search"),
    backup_type: Optional[str] = Query(None, description="Backup type: D (Full), I (Diff), L (Log), or ALL"),
):
    """Retrieve database backup history with sizes, compression, and durations."""
    params = _get_connection_params()
    try:
        return get_backup_history(
            params,
            db_name=database or "",
            days_back=days_back,
            backup_type=backup_type or "",
        )
    except Exception as exc:
        logger.debug("Backup history unavailable: %s", exc)
        return []


@router.get("/backups/recovery-readiness", response_model=List[RecoveryReadiness])
def read_recovery_readiness():
    """Evaluate recovery readiness and RPO risks across all online databases."""
    params = _get_connection_params()
    try:
        return get_recovery_readiness(params)
    except Exception as exc:
        logger.error("Recovery readiness error: %s", exc)
        return []


@router.get("/backups/integrity", response_model=List[DatabaseIntegrityCheck])
def read_database_integrity():
    """Check last clean DBCC CHECKDB execution dates and page verification options."""
    params = _get_connection_params()
    try:
        return get_database_integrity_checks(params)
    except Exception as exc:
        logger.error("Database integrity check error: %s", exc)
        return []


@router.get("/backups/integrity-summary", response_model=IntegrityAndCorruptionSummary)
def read_integrity_summary():
    """Check database integrity status along with msdb.dbo.suspect_pages physical corruption detection."""
    params = _get_connection_params()
    try:
        return get_integrity_and_corruption_summary(params)
    except Exception as exc:
        logger.error("Database integrity summary error: %s", exc)
        return IntegrityAndCorruptionSummary(
            total_databases=0,
            healthy_checkdb_count=0,
            stale_checkdb_count=0,
            critical_checkdb_count=0,
            suspect_pages_count=0,
            has_active_corruption=False,
            checkdb_list=[],
            suspect_pages=[],
            is_demo=False,
        )


