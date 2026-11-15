"""schemas/fleet.py — Pydantic schemas for Multi-Server Fleet Overview & Estate Intelligence."""
from __future__ import annotations

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field

from app.schemas.servers import EnvironmentType


class ServerFleetStatus(str, Enum):
    HEALTHY = "HEALTHY"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"
    OFFLINE = "OFFLINE"


class BackupHealthStatus(str, Enum):
    OPTIMAL = "OPTIMAL"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class FleetServerItem(BaseModel):
    id: str = Field(..., description="Sunucu profil kimliği")
    name: str = Field(..., description="Sunucu/küme adı")
    host: str = Field(..., description="Bağlantı adresi veya IP")
    port: int = Field(default=1433, description="Port numarası")
    environment: EnvironmentType = Field(..., description="Ortam türü (Production, Replica, Staging vb.)")
    role: str = Field(default="Primary Node", description="Düğüm rolü")
    status: ServerFleetStatus = Field(default=ServerFleetStatus.HEALTHY, description="Filo sağlık durumu")
    health_score: int = Field(default=95, ge=0, le=100, description="Sağlık skoru (0-100)")
    cpu_pct: float = Field(default=25.0, description="Anlık CPU kullanım yüzdesi")
    memory_pct: float = Field(default=68.0, description="Bellek tüketim veya buffer doygunluğu (%)")
    disk_free_min_pct: float = Field(default=35.0, description="En düşük boş disk alanı (%)")
    active_connections: int = Field(default=45, description="Aktif oturum sayısı")
    blocking_sessions_count: int = Field(default=0, description="Engellenen oturum sayısı")
    deadlocks_24h: int = Field(default=0, description="Son 24 saatteki kilitlenme sayısı")
    critical_alerts_count: int = Field(default=0, description="Aktif kritik alarm sayısı")
    latency_ms: float = Field(default=1.5, description="Ağ ve TDS el sıkışma gecikmesi (ms)")
    sql_version: str = Field(default="SQL Server 2022", description="SQL Server sürümü")
    edition: str = Field(default="Enterprise Edition", description="Sürüm paketi")
    backup_health: BackupHealthStatus = Field(default=BackupHealthStatus.OPTIMAL, description="Yedekleme ve RPO durumu")
    is_active: bool = Field(default=False, description="Datapath panelinde şu an seçili olan aktif sunucu mu?")
    last_checked_at: str = Field(..., description="Son kontrol zamanı")
    verdict: str = Field(..., description="Kısa operasyonel durum özeti")


class FleetSummary(BaseModel):
    total_instances: int = Field(..., description="Filodaki toplam kayıtlı instance sayısı")
    healthy_count: int = Field(..., description="Stabil ve sağlıklı çalışan sunucular")
    warning_count: int = Field(..., description="Eşik uyarısı veren sunucular")
    critical_count: int = Field(..., description="Müdahale gerektiren kritik sunucular")
    offline_count: int = Field(..., description="Erişilemeyen sunucular")
    average_health_score: float = Field(..., description="Filo genel ortalama sağlık puanı")
    average_cpu_pct: float = Field(..., description="Filo genel ortalama CPU yükü (%)")
    total_active_connections: int = Field(..., description="Tüm filodaki toplam aktif bağlantı sayısı")
    total_blocking_count: int = Field(..., description="Tüm filodaki toplam bloklanmış oturum sayısı")
    total_critical_alerts: int = Field(..., description="Tüm filoda tetiklenen kritik alarm sayısı")


class FleetOverviewResponse(BaseModel):
    summary: FleetSummary
    servers: List[FleetServerItem]
    active_server_id: str
    evaluated_at: str
    top_risks: List[str] = Field(default_factory=list, description="Filo genelinde öne çıkan en kritik risk maddeleri")
