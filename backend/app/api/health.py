"""api/health.py — Health check endpoint."""
from __future__ import annotations

from datetime import datetime, timezone
from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(tags=["Health"])


@router.get("/health")
def get_health():
    """Return platform health and API status."""
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": settings.APP_VERSION,
        "product": "Datapath",
    }
