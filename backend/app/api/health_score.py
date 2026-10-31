"""api/health_score.py — Cumulative Database Health Score API endpoint."""
from __future__ import annotations

from fastapi import APIRouter
from app.schemas.health_score import HealthScoreResponse
from app.services.health_score_service import calculate_health_score

router = APIRouter(prefix="/health-score", tags=["Health Score"])


@router.get("", response_model=HealthScoreResponse)
def get_health_score() -> HealthScoreResponse:
    """Calculate and return cumulative database health score (0-100) across 5 core pillars."""
    return calculate_health_score()
