"""api/triage.py — 1-Click emergency incident triage endpoint."""
from __future__ import annotations

from fastapi import APIRouter
from app.schemas.triage import TriageResponse
from app.services.triage_service import run_emergency_triage

router = APIRouter(prefix="/incidents/triage", tags=["Emergency Triage"])


@router.get("", response_model=TriageResponse)
def get_emergency_triage() -> TriageResponse:
    """Run concurrent 7-pillar emergency incident triage and formulate root-cause verdict."""
    return run_emergency_triage()
