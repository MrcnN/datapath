"""api/anomaly_radar.py - FastAPI router for Predictive Anomaly Radar."""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Query
from app.schemas.anomaly_radar import AnomalyRadarResponse
from app.services.anomaly_radar_service import get_anomaly_radar

router = APIRouter(prefix="/anomaly-radar", tags=["Anomaly Radar"])


@router.get("", response_model=AnomalyRadarResponse)
def get_radar_telemetry(
    server_id: Optional[str] = Query(None, description="Optional target server profile ID")
):
    """Returns predictive statistical anomaly metrics, Z-score series, and active crisis alerts."""
    return get_anomaly_radar(server_id)
