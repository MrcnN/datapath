"""api/io_heatmap.py — File IO Latency & Stall Heatmap Studio endpoints."""
from __future__ import annotations

import logging
from fastapi import APIRouter

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.io_heatmap import IOHeatmapResponse
from app.services.io_heatmap_service import get_file_io_heatmap

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/storage/io-heatmap", tags=["File IO Latency Heatmap"])


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


@router.get("", response_model=IOHeatmapResponse)
def read_file_io_heatmap():
    """sys.dm_io_virtual_file_stats üzerinden dosya bazlı okuma/yazma gecikmesi, I/O stall ve ısı haritasını getirir."""
    params = _get_connection_params()
    try:
        return get_file_io_heatmap(params=params)
    except Exception as exc:
        logger.warning("Live IO virtual file stats query failed (%s), falling back to offline mode", exc)
        return get_file_io_heatmap(params=None)
