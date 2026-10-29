"""api/extended_events.py — Extended Events (XE) sessions, ring buffer extraction, and templates."""
from __future__ import annotations

import logging
from typing import List
from fastapi import APIRouter

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.extended_events import ExtendedEventsSummary, XETemplate
from app.services.extended_events_service import get_extended_events_summary
from app.services.demo_data import DEMO_XE_TEMPLATES

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Extended Events"])


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


@router.get("/extended-events", response_model=ExtendedEventsSummary)
@router.get("/extended-events/summary", response_model=ExtendedEventsSummary)
def read_extended_events_summary():
    """Retrieve all configured and running Extended Events sessions, ring buffer telemetry, and diagnostic templates."""
    params = _get_connection_params()
    return get_extended_events_summary(params)


@router.get("/extended-events/templates", response_model=List[XETemplate])
def read_extended_events_templates():
    """Retrieve pre-built, production-safe Extended Events session templates."""
    return DEMO_XE_TEMPLATES
