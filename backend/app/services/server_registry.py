"""services/server_registry.py — Multi-server registry and active server connection manager."""
from __future__ import annotations

import logging
import socket
import threading
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional
import uuid

from app.core.config import settings
from app.db.connection import ConnectionParams
from app.schemas.servers import (
    EnvironmentType,
    ServerPingResponse,
    ServerProfile,
    ServerProfileCreate,
    ServerProfileListResponse,
    ServerProfileUpdate,
)

logger = logging.getLogger(__name__)


class ServerRegistry:
    """Thread-safe multi-server registry using only configured server data."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._passwords: Dict[str, Optional[str]] = {}
        self._servers: Dict[str, ServerProfile] = {}
        self._active_server_id: str = "srv-default"
        self._initialize_default_profile()

    def _initialize_default_profile(self) -> None:
        """Initialize registry exclusively with the actual configured server from settings."""
        host = settings.DB_SERVER or "localhost"
        port = 1433
        if "," in host:
            parts = host.split(",", 1)
            host = parts[0].strip()
            try:
                port = int(parts[1].strip())
            except ValueError:
                port = 1433
        elif ":" in host:
            parts = host.split(":", 1)
            host = parts[0].strip()
            try:
                port = int(parts[1].strip())
            except ValueError:
                port = 1433

        server_id = "srv-default"
        default_profile = ServerProfile(
            id=server_id,
            name=settings.DB_SERVER or "localhost",
            host=host,
            port=port,
            default_database=settings.DB_DATABASE or "master",
            username=settings.DB_USERNAME or None,
            use_windows_auth=settings.DB_TRUSTED_CONNECTION,
            environment=EnvironmentType.PRODUCTION,
            role="Varsayılan Sunucu",
            driver=settings.DB_DRIVER,
            timeout=settings.DB_TIMEOUT,
            description=None,
            is_active=True,
            is_online=True,
            latency_ms=None,
            version=None,
            edition=None,
            cpu_count=None,
            total_memory_gb=None,
        )
        self._servers[server_id] = default_profile
        self._passwords[server_id] = settings.DB_PASSWORD or None
        self._active_server_id = server_id

    def list_servers(self) -> ServerProfileListResponse:
        """Return all registered servers with the active server indicator."""
        with self._lock:
            server_list = list(self._servers.values())
            for s in server_list:
                s.is_active = (s.id == self._active_server_id)
            return ServerProfileListResponse(
                active_server_id=self._active_server_id,
                total_count=len(server_list),
                servers=server_list,
            )

    def get_server(self, server_id: str) -> Optional[ServerProfile]:
        with self._lock:
            s = self._servers.get(server_id)
            if s:
                s_copy = s.model_copy()
                s_copy.is_active = (s_copy.id == self._active_server_id)
                return s_copy
            return None

    def get_active_server(self) -> ServerProfile:
        with self._lock:
            s = self._servers.get(self._active_server_id)
            if not s:
                if self._servers:
                    self._active_server_id = next(iter(self._servers.keys()))
                    s = self._servers[self._active_server_id]
                else:
                    self._initialize_default_profile()
                    s = self._servers[self._active_server_id]
            s_copy = s.model_copy()
            s_copy.is_active = True
            return s_copy

    def activate_server(self, server_id: str) -> ServerProfile:
        """Set the active server for all subsequent queries and operations."""
        with self._lock:
            if server_id not in self._servers:
                raise KeyError(f"Sunucu profili bulunamadı: {server_id}")
            self._active_server_id = server_id
            for s in self._servers.values():
                s.is_active = (s.id == server_id)
            logger.info("Aktif SQL Server profili değiştirildi: %s (%s)", self._servers[server_id].name, server_id)
            return self._servers[server_id].model_copy()

    def add_server(self, data: ServerProfileCreate) -> ServerProfile:
        """Register a new user-provided server profile."""
        with self._lock:
            server_id = f"srv-{uuid.uuid4().hex[:8]}"
            profile = ServerProfile(
                id=server_id,
                name=data.name,
                host=data.host,
                port=data.port,
                default_database=data.default_database,
                username=data.username,
                use_windows_auth=data.use_windows_auth,
                environment=data.environment,
                role=data.role,
                driver=data.driver,
                timeout=data.timeout,
                description=data.description,
                is_active=False,
                is_online=True,
                latency_ms=None,
                version=None,
                edition=None,
                cpu_count=None,
                total_memory_gb=None,
            )
            self._servers[server_id] = profile
            if data.password:
                self._passwords[server_id] = data.password
            logger.info("Yeni sunucu profili kaydedildi: %s (%s)", profile.name, server_id)
            return profile

    def update_server(self, server_id: str, data: ServerProfileUpdate) -> ServerProfile:
        """Update an existing server profile."""
        with self._lock:
            if server_id not in self._servers:
                raise KeyError(f"Sunucu profili bulunamadı: {server_id}")
            current = self._servers[server_id]
            updated_dict = current.model_dump()
            for k, v in data.model_dump(exclude_unset=True).items():
                if k != "password" and v is not None:
                    updated_dict[k] = v
            updated_profile = ServerProfile(**updated_dict)
            self._servers[server_id] = updated_profile
            if data.password is not None:
                self._passwords[server_id] = data.password
            return updated_profile

    def delete_server(self, server_id: str) -> bool:
        """Remove a server profile. If the deleted server is active, switch to another."""
        with self._lock:
            if server_id not in self._servers:
                raise KeyError(f"Sunucu profili bulunamadı: {server_id}")
            del self._servers[server_id]
            if server_id in self._passwords:
                del self._passwords[server_id]
            if self._active_server_id == server_id:
                if self._servers:
                    self._active_server_id = next(iter(self._servers.keys()))
                else:
                    self._initialize_default_profile()
            return True

    def ping_server(self, server_id: str) -> ServerPingResponse:
        """Real TCP connectivity check to the target host and port."""
        with self._lock:
            server = self._servers.get(server_id)
            if not server:
                raise KeyError(f"Sunucu profili bulunamadı: {server_id}")

            host = server.host
            port = server.port
            start = time.perf_counter()
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            timeout = min(max(server.timeout, 1), 3)
            sock.settimeout(timeout)
            is_online = False
            latency = 0.0
            try:
                sock.connect((host, port))
                latency = round((time.perf_counter() - start) * 1000, 1)
                server.latency_ms = latency
                server.is_online = True
                is_online = True
                msg = f"{host}:{port} bağlantısı başarılı."
            except Exception as exc:
                latency = round((time.perf_counter() - start) * 1000, 1)
                server.latency_ms = None
                server.is_online = False
                is_online = False
                msg = f"{host}:{port} bağlantı kurulamadı: {exc}"
            finally:
                try:
                    sock.close()
                except Exception:
                    pass

            now_str = datetime.now(timezone.utc).isoformat()
            return ServerPingResponse(
                server_id=server.id,
                server_name=server.name,
                is_online=is_online,
                latency_ms=latency,
                message=msg,
                checked_at=now_str,
            )

    def get_connection_params_for_active_server(self) -> ConnectionParams:
        """Build ConnectionParams for the currently active server profile."""
        active = self.get_active_server()
        pwd = self._passwords.get(active.id) or settings.DB_PASSWORD or None
        return ConnectionParams(
            server=f"{active.host},{active.port}" if active.port != 1433 else active.host,
            database=active.default_database,
            username=active.username,
            password=pwd,
            trusted_connection=active.use_windows_auth,
            driver=active.driver,
            timeout=active.timeout,
        )


# Global singleton instance
server_registry = ServerRegistry()
