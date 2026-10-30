"""api/storage.py — Endpoints for database storage, autogrowth tracking, log space usage, and open transactions."""
from __future__ import annotations

import logging
from fastapi import APIRouter

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.storage import StorageSummary, OpenTransactionsSummary
from app.services.server_registry import server_registry
from app.services.storage_service import get_storage_summary, get_open_transactions_summary

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Storage & Files"])


def _get_connection_params() -> ConnectionParams:
    return server_registry.get_connection_params_for_active_server()


@router.get("/storage", response_model=StorageSummary)
def read_storage_summary():
    """Retrieve database files, autogrowth status, log reuse wait descriptions, and Default Trace autogrowth events."""
    params = _get_connection_params()
    return get_storage_summary(params)


@router.get("/storage/open-transactions", response_model=OpenTransactionsSummary)
def read_open_transactions_summary():
    """Retrieve active open transactions, dormant uncommitted transactions, and log reuse wait blockers."""
    params = _get_connection_params()
    return get_open_transactions_summary(params)

