"""api/tempdb_forensics.py — Endpoint for TempDB Space Hog & Spill Forensic Investigator."""
from __future__ import annotations

import logging
from fastapi import APIRouter

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.tempdb_forensics import TempDBForensicsResponse
from app.services.tempdb_forensics_service import get_tempdb_forensics

logger = logging.getLogger(__name__)

router = APIRouter(tags=["TempDB & Memory"])


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


@router.get("/tempdb/forensics", response_model=TempDBForensicsResponse)
@router.get("/tempdb-memory/forensics", response_model=TempDBForensicsResponse)
def read_tempdb_forensics():
    """Retrieve in-depth TempDB space consumption forensics:
    Sort/Hash warning spills from query stats, session & task space hogs,
    and active temporary tables in tempdb.sys.tables.
    """
    params = _get_connection_params()
    return get_tempdb_forensics(params)
