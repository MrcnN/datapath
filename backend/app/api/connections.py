"""api/connections.py — SQL Server connection test endpoints."""
from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException

from app.schemas.connections import ConnectionTestRequest, ConnectionTestResponse
from app.services.connection_service import test_connection

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Connections"])


@router.post("/connection/test", response_model=ConnectionTestResponse)
@router.post("/connections/test", response_model=ConnectionTestResponse)
def test_sql_connection(request: ConnectionTestRequest) -> ConnectionTestResponse:
    """Validate and test SQL Server connectivity.
    
    Safe by design: never logs credentials or raw connection strings.
    """
    try:
        return test_connection(request)
    except Exception as exc:
        logger.error("Connection test error: %s", str(exc))
        return ConnectionTestResponse(
            success=False,
            message=f"Bağlantı hatası: {str(exc)}",
            server_info=None,
        )
