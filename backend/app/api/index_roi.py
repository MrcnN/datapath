from fastapi import APIRouter, Query
from typing import Optional
import logging

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.index_roi import IndexRoiOverview
from app.services.index_roi_service import get_index_roi_overview

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/index-roi", tags=["Index ROI & Write Penalty"])


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


@router.get("/overview", response_model=IndexRoiOverview)
def read_index_roi_overview(
    database: Optional[str] = Query(None, description="Hedef veritabanı adı")
):
    """İndekslerin okuma/yazma oranlarını, write penalty cezasını ve net ROI puanlarını getirir."""
    params = _get_connection_params()
    try:
        return get_index_roi_overview(params=params, database_name=database)
    except Exception as exc:
        logger.warning("Error fetching index ROI overview (%s), falling back to demo", exc)
        return get_index_roi_overview(params=None, database_name=database or "Datapath_TestDB")
