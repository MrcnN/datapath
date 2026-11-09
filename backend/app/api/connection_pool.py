from fastapi import APIRouter, Query, HTTPException
from typing import Optional
import logging

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.connection_pool import ConnectionPoolSummary
from app.services.connection_pool_service import (
    get_connection_pool_summary,
    get_kill_session_script,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/connection-sentinel", tags=["Connection Sentinel & Session Leaks"])


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


@router.get("/summary", response_model=ConnectionPoolSummary)
def read_connection_pool_summary(
    database: Optional[str] = Query(None, description="Opsiyonel veritabanı filtresi")
):
    """Canlı bağlantı havuzu durumunu, istemci dağılımını ve başıboş açık işlemleri (Zombie Transactions) getirir."""
    params = _get_connection_params()
    try:
        return get_connection_pool_summary(params=params, database=database)
    except Exception as exc:
        logger.warning("Error fetching live connection summary (%s), falling back to demo", exc)
        return get_connection_pool_summary(params=None, database=database)


@router.get("/kill-script/{session_id}")
def read_kill_session_script(session_id: int):
    """Belirtilen oturum için inceleme ve güvenli sonlandırma (KILL) betiği üretir."""
    if session_id <= 50:
        raise HTTPException(
            status_code=400,
            detail="SPID 50 ve altı SQL Server sistem süreçleridir ve sonlandırılamaz.",
        )
    return get_kill_session_script(session_id)
