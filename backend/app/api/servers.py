"""api/servers.py — Multi-server management and active instance switching endpoints."""
from __future__ import annotations

import logging
from typing import Dict
from fastapi import APIRouter, HTTPException, Path

from app.schemas.servers import (
    ServerPingResponse,
    ServerProfile,
    ServerProfileCreate,
    ServerProfileListResponse,
    ServerProfileUpdate,
)
from app.services.server_registry import server_registry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/servers", tags=["Multi-Server Profiles"])


@router.get("", response_model=ServerProfileListResponse)
def list_servers() -> ServerProfileListResponse:
    """Retrieve all registered SQL Server profiles and the current active server ID."""
    return server_registry.list_servers()


@router.get("/active", response_model=ServerProfile)
def get_active_server() -> ServerProfile:
    """Retrieve details of the currently active SQL Server profile."""
    return server_registry.get_active_server()


@router.post("", response_model=ServerProfile, status_code=201)
def add_server(payload: ServerProfileCreate) -> ServerProfile:
    """Register a new SQL Server profile in the registry."""
    try:
        return server_registry.add_server(payload)
    except Exception as exc:
        logger.error("Failed to add server profile: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc))


@router.put("/{server_id}", response_model=ServerProfile)
def update_server(
    server_id: str = Path(..., description="Güncellenecek sunucu kimliği"),
    payload: ServerProfileUpdate = ...,
) -> ServerProfile:
    """Update configurations for an existing server profile."""
    try:
        return server_registry.update_server(server_id, payload)
    except KeyError:
        raise HTTPException(status_code=404, detail="Sunucu profili bulunamadı.")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/{server_id}/activate", response_model=ServerProfile)
def activate_server(
    server_id: str = Path(..., description="Aktif yapılacak sunucu kimliği"),
) -> ServerProfile:
    """Switch the platform's active SQL Server instance across all modules and dashboards."""
    try:
        return server_registry.activate_server(server_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Sunucu profili bulunamadı.")


@router.post("/{server_id}/ping", response_model=ServerPingResponse)
def ping_server(
    server_id: str = Path(..., description="Bağlantısı test edilecek sunucu kimliği"),
) -> ServerPingResponse:
    """Measure network latency and verify TCP/TDS handshaking to the target server."""
    try:
        return server_registry.ping_server(server_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Sunucu profili bulunamadı.")


@router.delete("/{server_id}")
def delete_server(
    server_id: str = Path(..., description="Silinecek sunucu kimliği"),
) -> Dict[str, str]:
    """Remove a server profile from the registry."""
    try:
        server_registry.delete_server(server_id)
        return {"status": "success", "message": f"Sunucu profili '{server_id}' başarıyla silindi."}
    except KeyError:
        raise HTTPException(status_code=404, detail="Sunucu profili bulunamadı.")
