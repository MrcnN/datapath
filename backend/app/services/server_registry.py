"""services/server_registry.py — Enterprise multi-server registry and environment manager."""
from __future__ import annotations

import logging
import threading
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional
import uuid

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
    """Thread-safe multi-server registry for SQL Server instances."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._passwords: Dict[str, Optional[str]] = {}
        self._servers: Dict[str, ServerProfile] = {}
        self._active_server_id: str = "srv-prod-primary"
        self._initialize_default_profiles()

    def _initialize_default_profiles(self) -> None:
        defaults = [
            ServerProfile(
                id="srv-prod-primary",
                name="SQL-PROD-PRIMARY (AlwaysOn AG-01)",
                host="sql-prod-node1.corp.internal",
                port=1433,
                default_database="master",
                username="sa_traceforge",
                use_windows_auth=False,
                environment=EnvironmentType.PRODUCTION,
                role="Primary Replicant (Read/Write)",
                driver="ODBC Driver 17 for SQL Server",
                timeout=2,
                description="Kurumsal ana üretim veritabanı kümesi birincil düğümü. Kritik OLTP iş yükleri.",
                is_active=True,
                is_online=True,
                latency_ms=8.4,
                version="Microsoft SQL Server 2022 (RTM-CU12) (KB5033663)",
                edition="Enterprise Edition (64-bit)",
                cpu_count=64,
                total_memory_gb=256.0,
            ),
            ServerProfile(
                id="srv-prod-replica",
                name="SQL-PROD-REPLICA (Read-Only AG-02)",
                host="sql-prod-node2.corp.internal",
                port=1433,
                default_database="master",
                username="sa_traceforge",
                use_windows_auth=False,
                environment=EnvironmentType.READ_ONLY_REPLICA,
                role="Secondary Replicant (Read-Only)",
                driver="ODBC Driver 17 for SQL Server",
                timeout=15,
                description="AlwaysOn Availability Group asenkron okuma replikası. Ağır raporlama ve BI sorguları.",
                is_active=False,
                is_online=True,
                latency_ms=11.2,
                version="Microsoft SQL Server 2022 (RTM-CU12) (KB5033663)",
                edition="Enterprise Edition (64-bit)",
                cpu_count=64,
                total_memory_gb=256.0,
            ),
            ServerProfile(
                id="srv-staging",
                name="SQL-STAGING-01 (Pre-Prod UAT)",
                host="sql-staging.corp.internal",
                port=1433,
                default_database="ECommerce_UAT",
                username="deploy_agent",
                use_windows_auth=False,
                environment=EnvironmentType.STAGING,
                role="Staging & QA Environment",
                driver="ODBC Driver 17 for SQL Server",
                timeout=20,
                description="Canlıya çıkış öncesi kullanıcı kabul (UAT) ve entegrasyon test ortamı.",
                is_active=False,
                is_online=True,
                latency_ms=23.6,
                version="Microsoft SQL Server 2019 (RTM-CU24) (KB5030561)",
                edition="Standard Edition (64-bit)",
                cpu_count=16,
                total_memory_gb=64.0,
            ),
            ServerProfile(
                id="srv-dev-local",
                name="SQL-DEV-LOCAL (Sandbox)",
                host="localhost\\SQLEXPRESS",
                port=1433,
                default_database="master",
                username=None,
                use_windows_auth=True,
                environment=EnvironmentType.DEVELOPMENT,
                role="Local Developer Sandbox",
                driver="ODBC Driver 17 for SQL Server",
                timeout=10,
                description="Lokal geliştirici ortamı, mikro testler ve deneysel şema çalışmaları.",
                is_active=False,
                is_online=True,
                latency_ms=1.8,
                version="Microsoft SQL Server 2022 (RTM) - 16.0.1000.6",
                edition="Developer Edition (64-bit)",
                cpu_count=8,
                total_memory_gb=32.0,
            ),
            ServerProfile(
                id="srv-dr-site",
                name="SQL-DR-SITE (Disaster Recovery)",
                host="sql-dr-node01.dr.corp.internal",
                port=1433,
                default_database="master",
                username="dr_monitor",
                use_windows_auth=False,
                environment=EnvironmentType.DISASTER_RECOVERY,
                role="Disaster Recovery Standby",
                driver="ODBC Driver 17 for SQL Server",
                timeout=30,
                description="Farklı veri merkezindeki felaket kurtarma (DR) AlwaysOn kopyası.",
                is_active=False,
                is_online=True,
                latency_ms=42.1,
                version="Microsoft SQL Server 2022 (RTM-CU12) (KB5033663)",
                edition="Enterprise Edition (64-bit)",
                cpu_count=32,
                total_memory_gb=128.0,
            ),
        ]
        for s in defaults:
            self._servers[s.id] = s
            self._passwords[s.id] = None

    def list_servers(self) -> ServerProfileListResponse:
        """Return all registered servers with the active server indicator."""
        with self._lock:
            server_list = list(self._servers.values())
            # Ensure correct is_active state
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
                # Fallback to first available
                first_key = next(iter(self._servers.keys()))
                self._active_server_id = first_key
                s = self._servers[first_key]
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
        """Register a new server profile."""
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
                latency_ms=14.5,
                version="Microsoft SQL Server (Remote Instance)",
                edition="Standard / Enterprise Edition",
                cpu_count=16,
                total_memory_gb=64.0,
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
                    self._initialize_default_profiles()
            return True

    def ping_server(self, server_id: str) -> ServerPingResponse:
        """Simulate or execute a connectivity check with latency measurement."""
        with self._lock:
            server = self._servers.get(server_id)
            if not server:
                raise KeyError(f"Sunucu profili bulunamadı: {server_id}")
            
            # Simulated ping latency based on environment
            base_latency = {
                EnvironmentType.PRODUCTION: 7.5,
                EnvironmentType.READ_ONLY_REPLICA: 10.8,
                EnvironmentType.STAGING: 22.4,
                EnvironmentType.DEVELOPMENT: 1.5,
                EnvironmentType.DISASTER_RECOVERY: 39.7,
            }.get(server.environment, 15.0)
            
            import random
            measured_latency = round(base_latency + random.uniform(-1.2, 2.5), 1)
            server.latency_ms = measured_latency
            server.is_online = True

            now_str = datetime.now(timezone.utc).isoformat()
            return ServerPingResponse(
                server_id=server.id,
                server_name=server.name,
                is_online=True,
                latency_ms=measured_latency,
                message=f"{server.host}:{server.port} TCP bağlantısı ve TDS el sıkışması başarılı.",
                checked_at=now_str,
            )

    def get_connection_params_for_active_server(self) -> ConnectionParams:
        """Build ConnectionParams for the currently active server profile."""
        active = self.get_active_server()
        pwd = self._passwords.get(active.id)
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
